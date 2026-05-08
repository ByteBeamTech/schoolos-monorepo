import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma, BloodGroup, Gender, GuardianRelation } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';
import {
  CreateStudentDto,
  UpdateStudentDto,
  CreateGuardianDto,
  LinkGuardianDto,
} from '../dto/student.dto';

function sanitizeStudent(student: any) {
  if (!student) return null;
  const { passwordHash, refreshToken, ...safe } = student;
  return safe;
}

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Helper to map DTO string blood groups to Prisma Enums
   */
  private mapBloodGroup(bg: string): BloodGroup | null {
    const map: Record<string, BloodGroup> = {
      'A+': BloodGroup.A_POS,
      'A-': BloodGroup.A_NEG,
      'B+': BloodGroup.B_POS,
      'B-': BloodGroup.B_NEG,
      'AB+': BloodGroup.AB_POS,
      'AB-': BloodGroup.AB_NEG,
      'O+': BloodGroup.O_POS,
      'O-': BloodGroup.O_NEG,
    };
    return map[bg] || (bg as BloodGroup); // Fallback to direct enum if already mapped
  }

  async create(tenantId: string, dto: CreateStudentDto, actorId: string) {
    const existing = await this.prisma.student.findFirst({
      where: { tenantId, admissionNumber: dto.admissionNumber },
    });

    if (existing) {
      throw new ConflictException(
        `Admission number "${dto.admissionNumber}" already exists.`,
      );
    }

    const student = await this.prisma.student.create({
      data: {
        tenantId,
        branchId:        dto.branchId,
        admissionNumber: dto.admissionNumber,
        firstName:       dto.firstName,
        lastName:        dto.lastName,
        academicYear:    dto.academicYear,
        dateOfBirth:     dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender:          dto.gender as Gender,
        bloodGroup:      dto.bloodGroup ? this.mapBloodGroup(dto.bloodGroup) : null,
        sectionId:       dto.sectionId ?? null,
        rollNumber:      dto.rollNumber ?? null,
        isActive:        true,
      } satisfies Prisma.StudentUncheckedCreateInput,
      include: { section: { include: { class: true } } },
    });

    await this.audit.logCreate({
      tenantId, actorId,
      entityType: 'Student',
      entityId: student.id,
      after: {
        admissionNumber: student.admissionNumber,
        name: `${student.firstName} ${student.lastName}`,
      },
    });

    return sanitizeStudent(student);
  }

  async findAll(tenantId: string, filters: {
    academicYear?: string;
    sectionId?:    string;
    branchId?:     string;
    isActive?:     boolean;
    search?:       string;
    page?:         number;
    limit?:        number;
  } = {}) {
    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 20;
    const where: Prisma.StudentWhereInput = { tenantId };

    if (filters.academicYear) where.academicYear = filters.academicYear;
    if (filters.sectionId)    where.sectionId    = filters.sectionId;
    if (filters.branchId)     where.branchId     = filters.branchId;
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
          isActive: true,
          section: { include: { class: true } },
          guardianLinks: { include: { guardian: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    const sanitizedData = data.map(sanitizeStudent);

    return {
      data: sanitizedData,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  async findById(tenantId: string, id: string) {
    const student = await this.prisma.student.findFirst({
      where:   { id, tenantId },
      include: {
        section:       { include: { class: true } },
        guardianLinks: { include: { guardian: true }, orderBy: { isPrimary: 'desc' } },
      },
    });

    if (!student) throw new NotFoundException(`Student not found: ${id}`);

    return sanitizeStudent(student);
  }

  async update(tenantId: string, id: string, dto: UpdateStudentDto, actorId: string) {
    await this.findById(tenantId, id);

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.firstName   !== undefined && { firstName:   dto.firstName   }),
        ...(dto.lastName    !== undefined && { lastName:    dto.lastName    }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.gender      !== undefined && { gender:      dto.gender as Gender }),
        ...(dto.bloodGroup  !== undefined && { bloodGroup:  this.mapBloodGroup(dto.bloodGroup) }),
        ...(dto.sectionId   !== undefined && { sectionId:   dto.sectionId   }),
        ...(dto.rollNumber  !== undefined && { rollNumber:  dto.rollNumber  }),
        ...(dto.isActive    !== undefined && { isActive:    dto.isActive    }),
      } satisfies Prisma.StudentUncheckedUpdateInput,
      include: { section: { include: { class: true } } },
    });

    await this.audit.logUpdate({
      tenantId, actorId,
      entityType: 'Student',
      entityId: id,
      before: { admissionNumber: updated.admissionNumber },
      after:  dto,
    });

    return sanitizeStudent(updated);
  }

  async getStats(tenantId: string, academicYear: string) {
    const [total, active, boys, girls] = await Promise.all([
      this.prisma.student.count({ where: { tenantId, academicYear } }),
      this.prisma.student.count({ where: { tenantId, academicYear, isActive: true } }),
      this.prisma.student.count({ where: { tenantId, academicYear, gender: Gender.MALE } }),
      this.prisma.student.count({ where: { tenantId, academicYear, gender: Gender.FEMALE } }),
    ]);
    return { total, active, inactive: total - active, boys, girls };
  }

  async createGuardian(tenantId: string, dto: CreateGuardianDto, actorId: string) {
    const existing = await this.prisma.guardian.findFirst({
      where: { tenantId, phone: dto.phone },
    });
    if (existing) {
      throw new ConflictException(
        `Guardian with phone ${dto.phone} already exists in this school.`,
      );
    }

    const guardian = await this.prisma.guardian.create({
      data: {
        tenantId,
        firstName:  dto.firstName,
        lastName:   dto.lastName,
        phone:      dto.phone,
        email:      dto.email      ?? null,
        occupation: dto.occupation ?? null,
        altPhone:   dto.altPhone   ?? null,
      },
    });

    await this.audit.logCreate({
      tenantId, actorId,
      entityType: 'Guardian',
      entityId:   guardian.id,
      after: { name: `${guardian.firstName} ${guardian.lastName}`, phone: guardian.phone },
    });

    return guardian;
  }

  async linkGuardian(
    tenantId:  string,
    studentId: string,
    dto:       LinkGuardianDto,
    actorId:   string,
  ) {
    await this.findById(tenantId, studentId);

    const guardian = await this.prisma.guardian.findFirst({
      where: { id: dto.guardianId, tenantId },
    });
    if (!guardian) throw new NotFoundException(`Guardian not found: ${dto.guardianId}`);

    if (dto.isPrimary) {
      await this.prisma.guardianStudent.updateMany({
        where: { studentId, isPrimary: true },
        data:  { isPrimary: false },
      });
    }

    const link = await this.prisma.guardianStudent.upsert({
      where:  { guardianId_studentId: { guardianId: dto.guardianId, studentId } },
      create: {
        guardianId: dto.guardianId,
        studentId,
        relation:   dto.relation as GuardianRelation,
        isPrimary:  dto.isPrimary ?? false,
      },
      update: {
        relation:  dto.relation as GuardianRelation,
        isPrimary: dto.isPrimary ?? false,
      },
    });

    await this.audit.logCreate({
      tenantId, actorId,
      entityType: 'GuardianLink',
      entityId:   link.id,
      after: { studentId, guardianId: dto.guardianId, relation: dto.relation },
    });

    return link;
  }

  async getGuardians(tenantId: string, studentId: string) {
    await this.findById(tenantId, studentId);

    return this.prisma.guardianStudent.findMany({
      where:   { studentId },
      include: { guardian: true },
      orderBy: { isPrimary: 'desc' },
    });
  }
}
