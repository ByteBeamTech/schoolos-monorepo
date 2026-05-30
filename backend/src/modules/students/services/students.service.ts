
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, BloodGroup, Gender, Student } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';
import {
  CreateStudentDto,
  UpdateStudentDto,
  CreateGuardianDto,
  LinkGuardianDto,
} from '../dto/student.dto';

export type SafeStudent = Omit<Student, 'passwordHash' | 'refreshToken'>;

/**
 * 🛡️ TYPE-SAFE GENERIC SANITIZER
 */
function sanitizeStudent<T extends object>(student: T | null): Omit<T, 'passwordHash' | 'refreshToken'> | null {
  if (!student) return null;
  const { passwordHash, refreshToken, ...safeStudent } = student as Record<string, any>;
  return safeStudent as Omit<T, 'passwordHash' | 'refreshToken'>;
}

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Helper to map DTO string blood groups to Prisma Enums with runtime validation
   */
  private mapBloodGroup(bg: string): BloodGroup | null {
    if (!bg) return null;
    const map: Record<string, BloodGroup> = {
      'A+': BloodGroup.A_POS, 'A-': BloodGroup.A_NEG,
      'B+': BloodGroup.B_POS, 'B-': BloodGroup.B_NEG,
      'AB+': BloodGroup.AB_POS, 'AB-': BloodGroup.AB_NEG,
      'O+': BloodGroup.O_POS, 'O-': BloodGroup.O_NEG,
    };

    const matched = map[bg];
    if (!matched) {
      throw new BadRequestException(`Bhai, invalid Blood Group value [${bg}] pass hui hai!`);
    }
    return matched;
  }

  /**
   * 🛡️ ATOMIC STUDENT REGISTRATION ENGINE (CONCURRENCY HARDENED)
   */
  async create(tenantId: string, branchId: string, dto: CreateStudentDto, actorId: string) {
    if (!tenantId || !branchId) throw new BadRequestException('Tenant aur Branch context identifiers mandatory hain!');

    return this.prisma.$transaction(async (tx) => {
      // 1. Structural Validation
      const targetClass = await tx.class.findFirst({
        where: { id: dto.classId, tenantId, branchId }
      });
      if (!targetClass) {
        throw new NotFoundException('Provided Class structure campus layout mein valid nahi hai.');
      }

      // 2. Concurrency Safety Layer for Section Allocation
      if (dto.sectionId) {
        const targetSection = await tx.section.findFirst({
          where: { id: dto.sectionId, tenantId, branchId, classId: dto.classId }
        });
        if (!targetSection) {
          throw new NotFoundException('Target Section branch layout mein valid nahi hai ya hierarchy mismatch hai.');
        }

        // 🟢 Enforced row-level pessimistic lock to serialize concurrent insertions
        await tx.$executeRaw`
          SELECT id FROM "Section"
          WHERE id = ${dto.sectionId}
            AND "tenantId" = ${tenantId}
            AND "branchId" = ${branchId}
          FOR UPDATE;
        `;

        const currentSectionStrength = await tx.student.count({
          where: { tenantId, branchId, sectionId: dto.sectionId, isActive: true }
        });
        if (currentSectionStrength + 1 > targetSection.capacity) {
          throw new BadRequestException(`Section capacity overflow! Max allowed slots: ${targetSection.capacity}`);
        }
      }
const year = new Date().getFullYear();

const studentCount = await tx.student.count({
  where: { tenantId },
});

const generatedAdmissionNumber =
  `ADM-${year}-${String(studentCount + 1).padStart(5, '0')}`;
      try {
        // 3. Database Execution - 🟢 classId is explicitly bound to secure validation
        const student = await tx.student.create({
          data: {
            tenantId,
            branchId,
            classId:         dto.classId,
            sectionId:       dto.sectionId ?? null,
            academicYear:    dto.academicYear,
            admissionNumber: dto.admissionNumber?.trim().toUpperCase() ?? generatedAdmissionNumber,
            firstName:       dto.firstName.trim(),
            lastName:        dto.lastName ? dto.lastName.trim() : '',
            dateOfBirth:     dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            gender:          dto.gender ?? null,
            bloodGroup:      dto.bloodGroup ? this.mapBloodGroup(dto.bloodGroup) : null,
            rollNumber:      dto.rollNumber ?? null,
            isActive:        true,
          },
          include: { section: { include: { class: true } } },
        });

        await this.audit.logCreate({
          tenantId, actorId,
          entityType: 'Student',
          entityId: student.id,
          after: {
            admissionNumber: student.admissionNumber,
            name: `${student.firstName} ${student.lastName}`,
            branchId,
          },
        });

        return sanitizeStudent(student);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException(`Admission Number [${dto.admissionNumber}] pehle se uniquely live hai!`);
        }
        throw err;
      }
    }, { timeout: 15000 });
  }

  /**
   * 🏎️ LIGHTWEIGHT LIST PROJECTION PATH (BLOAT REMOVED)
   */
  async findAll(tenantId: string, branchId: string, filters: {
    academicYear?: string;
    classId?:      string;
    sectionId?:    string;
    isActive?:     boolean;
    search?:       string;
    page?:         number;
    limit?:        number;
  } = {}) {
    if (!tenantId || !branchId) throw new BadRequestException('Branch configuration parameters verified missing.');

    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 20;
    const where: Prisma.StudentWhereInput = { tenantId, branchId };

    if (filters.academicYear) where.academicYear = filters.academicYear;
    if (filters.classId)   where.classId   = filters.classId;
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    if (filters.search) {
      where.OR = [
        { firstName:       { contains: filters.search, mode: 'insensitive' } },
        { lastName:        { contains: filters.search, mode: 'insensitive' } },
        { admissionNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          academicYear: true,
          classId: true,
          sectionId: true,
          isActive: true,
          section: {
            select: {
              id: true,
              name: true,
              class: { select: { id: true, name: true } }
            }
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: data.map(s => sanitizeStudent(s as unknown as Student)),
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  /**
   * 🛡️ SECURE LOOKUP BOUNDARIES (AGGREGATE HYDRATION POINT)
   */
  async findById(tenantId: string, branchId: string, id: string) {
    if (!branchId) throw new BadRequestException('Branch isolation context parameter is mandatory.');

    const student = await this.prisma.student.findFirst({
      where:   { id, tenantId, branchId },
      include: {
        section: { include: { class: true } },
        guardianLinks: { include: { guardian: true }, orderBy: { isPrimary: 'desc' } },
      },
    });

    if (!student) throw new NotFoundException(`Student profile lookup invalid inside this campus branch perimeter.`);
    return sanitizeStudent(student);
  }

  
  /**
   * 📝 MUTATION CORE WITH RECONCILIATION DRIVES (SIGNATURE STANDARDIZED)
   * 🟢 FIX #1: Reshaped parameters to: tenantId, branchId, id to match system-wide canonical layout
   */
  async update(tenantId: string, branchId: string, id: string, dto: UpdateStudentDto, actorId: string) {
    const baseline = await this.prisma.student.findFirst({
      where: { id, tenantId, branchId }
    });
    if (!baseline) throw new NotFoundException('Target Student profile is campus branch mein nahi mila.');

    return this.prisma.$transaction(async (tx) => {
      const resolvedClassId = dto.classId ?? baseline.classId;
      const resolvedSectionId = dto.sectionId !== undefined ? dto.sectionId : baseline.sectionId;

      if (resolvedSectionId) {
        const targetSection = await tx.section.findFirst({
          where: { id: resolvedSectionId, tenantId, branchId }
        });
        if (!targetSection) throw new NotFoundException('Selected target Section structure matches zero configurations.');
        if (targetSection.classId !== resolvedClassId) {
          throw new BadRequestException('Hierarchy Violation: Proposed Section does not belong to evaluated Class parent context.');
        }

        if (resolvedSectionId !== baseline.sectionId) {
          await tx.$executeRaw`
            SELECT id FROM "Section" WHERE id = ${resolvedSectionId} AND "tenantId" = ${tenantId} AND "branchId" = ${branchId} FOR UPDATE;
          `;

          const sectionStrength = await tx.student.count({
            where: { tenantId, branchId, sectionId: resolvedSectionId, isActive: true }
          });
          if (sectionStrength + 1 > targetSection.capacity) {
            throw new BadRequestException(`Target Section capacity full! Shift transaction blocked.`);
          }
        }
      }

      const updated = await tx.student.update({
        where: { id },
        data: {
          ...(dto.firstName   !== undefined && { firstName:   dto.firstName.trim() }),
          ...(dto.lastName    !== undefined && { lastName:    dto.lastName ? dto.lastName.trim() : null }), // 🟢 FIX #5: Clean data governance null fallback representation
          ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
          ...(dto.gender      !== undefined && { gender:      dto.gender ?? null }), 
          ...(dto.bloodGroup  !== undefined && { bloodGroup:  dto.bloodGroup ? this.mapBloodGroup(dto.bloodGroup) : null }),
          ...(dto.classId     !== undefined && { classId:     dto.classId }),
          ...(dto.sectionId   !== undefined && { sectionId:   dto.sectionId ?? null }),
          ...(dto.rollNumber  !== undefined && { rollNumber:  dto.rollNumber ?? null }),
          ...(dto.isActive    !== undefined && { isActive:    dto.isActive }),
        },
        include: { section: { include: { class: true } } },
      });

      await this.audit.logUpdate({
        tenantId, actorId,
        entityType: 'Student',
        entityId: id,
        before: { admissionNumber: baseline.admissionNumber, name: `${baseline.firstName} ${baseline.lastName}` },
        after: dto,
      });

      return sanitizeStudent(updated);
    });
  }

  /**
   * 📊 TRUTHFUL DEMOGRAPHICS CALCULATOR
   */
  async getStats(tenantId: string, branchId: string, academicYear: string) {
    if (!tenantId || !branchId || !academicYear) throw new BadRequestException('Context tracking metrics parameters missing.');

    const [total, active, boys, girls] = await Promise.all([
      this.prisma.student.count({ where: { tenantId, branchId, academicYear } }),
      this.prisma.student.count({ where: { tenantId, branchId, academicYear, isActive: true } }),
      this.prisma.student.count({ where: { tenantId, branchId, academicYear, gender: Gender.MALE } }),
      this.prisma.student.count({ where: { tenantId, branchId, academicYear, gender: Gender.FEMALE } }),
    ]);
    return { total, active, inactive: total - active, boys, girls };
  }

  /**
   * 👥 GUARDIAN MODULE ENGINE BOUNDARY
   */
  async createGuardian(tenantId: string, dto: CreateGuardianDto, actorId: string) {
    try {
      const guardian = await this.prisma.guardian.create({
        data: {
          tenantId,
          firstName:  dto.firstName.trim(),
          lastName:   dto.lastName ? dto.lastName.trim() : '',
          phone:      dto.phone.trim(),
          email:      dto.email ?? null,
          occupation: dto.occupation ?? null,
          altPhone:   dto.altPhone ?? null,
        },
      });

      await this.audit.logCreate({
        tenantId, actorId,
        entityType: 'Guardian',
        entityId:   guardian.id,
        after: { name: `${guardian.firstName} ${guardian.lastName}`, phone: guardian.phone },
      });

      return guardian;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Guardian with phone identity [${dto.phone}] already exists in this registry.`);
      }
      throw err;
    }
  }

  async linkGuardian(tenantId: string, branchId: string, studentId: string, dto: LinkGuardianDto, actorId: string) {
    if (!branchId) throw new BadRequestException('Branch identity scope verification parameter missing.');

    const baseline = await this.prisma.student.findFirst({ where: { id: studentId, tenantId, branchId } });
    if (!baseline) throw new NotFoundException('Student profile is branch context registry mein nahi mila.');

    const guardian = await this.prisma.guardian.findFirst({
      where: { id: dto.guardianId, tenantId },
    });
    if (!guardian) throw new NotFoundException(`Guardian entity configuration missing parameters.`);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.guardianStudent.updateMany({
          where: { studentId, isPrimary: true },
          data:  { isPrimary: false },
        });
      }

      const link = await tx.guardianStudent.upsert({
        where:  { guardianId_studentId: { guardianId: dto.guardianId, studentId } },
        create: {
          guardianId: dto.guardianId,
          studentId,
          relation:   dto.relation,
          isPrimary:  dto.isPrimary ?? false,
        },
        update: {
          relation:   dto.relation,
          isPrimary:  dto.isPrimary ?? false,
        },
      });

      await this.audit.logCreate({
        tenantId, actorId,
        entityType: 'GuardianLink',
        entityId:   link.id,
        after: { studentId, guardianId: dto.guardianId, relation: dto.relation },
      });

      return link;
    });
  }

  async getGuardians(tenantId: string, branchId: string, studentId: string) {
    if (!branchId) throw new BadRequestException('Branch isolation parameter validation missing.');

    const baseline = await this.prisma.student.findFirst({ where: { id: studentId, tenantId, branchId } });
    if (!baseline) throw new NotFoundException('Student profile lookup constraints mismatched inside this branch pipeline.');

    return this.prisma.guardianStudent.findMany({
      where:   { studentId },
      include: { guardian: true },
      orderBy: { isPrimary: 'desc' },
    });
  }
}
