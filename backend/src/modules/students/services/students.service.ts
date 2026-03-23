import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/database/prisma.service';
import { AuditService }  from '../../../core/compliance/audit.service';
import {
  CreateStudentDto,
  UpdateStudentDto,
  CreateGuardianDto,
  LinkGuardianDto,
} from '../dto/student.dto';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────

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
        gender:          dto.gender      ?? null,
        bloodGroup:      dto.bloodGroup  ?? null,
        sectionId:       dto.sectionId   ?? null,
        rollNumber:      dto.rollNumber  ?? null,
        isActive:        true,
      } satisfies Prisma.StudentUncheckedCreateInput,
      include: { section: { include: { class: true } } },
    });

    await this.audit.logCreate({
      tenantId, actorId,
      entityType: 'Student', entityId: student.id,
      after: { admissionNumber: student.admissionNumber, name: `${student.firstName} ${student.lastName}` },
    });

    this.logger.log(`Student created: ${student.admissionNumber} | tenant: ${tenantId}`);
    return student;
  }

  // ── Find all ──────────────────────────────────────────────────────────────

  async findAll(tenantId: string, filters: {
    academicYear?: string;
    sectionId?:    string;
    branchId?:     string;
    isActive?:     boolean;
    search?:       string;
  } = {}) {
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

    return this.prisma.student.findMany({
      where,
      include: {
        section:       { include: { class: true } },
        guardianLinks: { include: { guardian: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  // ── Find by ID ────────────────────────────────────────────────────────────

  async findById(tenantId: string, id: string) {
    const student = await this.prisma.student.findFirst({
      where:   { id, tenantId },
      include: {
        section:       { include: { class: true } },
        guardianLinks: { include: { guardian: true }, orderBy: { isPrimary: 'desc' } },
      },
    });
    if (!student) throw new NotFoundException(`Student not found: ${id}`);
    return student;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(
    tenantId: string, id: string,
    dto: UpdateStudentDto, actorId: string,
  ) {
    const student = await this.findById(tenantId, id);

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.firstName   !== undefined && { firstName:   dto.firstName   }),
        ...(dto.lastName    !== undefined && { lastName:    dto.lastName    }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.gender      !== undefined && { gender:      dto.gender      }),
        ...(dto.bloodGroup  !== undefined && { bloodGroup:  dto.bloodGroup  }),
        ...(dto.sectionId   !== undefined && { sectionId:   dto.sectionId   }),
        ...(dto.rollNumber  !== undefined && { rollNumber:  dto.rollNumber  }),
        ...(dto.isActive    !== undefined && { isActive:    dto.isActive    }),
      } satisfies Prisma.StudentUncheckedUpdateInput,
      include: { section: { include: { class: true } } },
    });

    await this.audit.logUpdate({
      tenantId, actorId,
      entityType: 'Student', entityId: id,
      before: { firstName: student.firstName, lastName: student.lastName },
      after:  dto,
    });

    return updated;
  }

  // ── Guardians ─────────────────────────────────────────────────────────────

  async createGuardian(tenantId: string, dto: CreateGuardianDto, actorId: string) {
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
      entityType: 'Guardian', entityId: guardian.id,
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
    if (!guardian) {
      throw new NotFoundException(`Guardian not found: ${dto.guardianId}`);
    }

    const existing = await this.prisma.guardianStudent.findFirst({
      where: { guardianId: dto.guardianId, studentId },
    });
    if (existing) {
      throw new ConflictException('Guardian is already linked to this student.');
    }

    if (dto.isPrimary) {
      await this.prisma.guardianStudent.updateMany({
        where: { studentId, isPrimary: true },
        data:  { isPrimary: false },
      });
    }

    const link = await this.prisma.guardianStudent.create({
      data: {
        guardianId: dto.guardianId,
        studentId,
        relation:   dto.relation,
        isPrimary:  dto.isPrimary ?? false,
      },
      include: { guardian: true },
    });

    await this.audit.logCreate({
      tenantId, actorId,
      entityType: 'GuardianStudent', entityId: link.id,
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

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(tenantId: string, academicYear: string) {
    const [total, active, bySectionRaw] = await Promise.all([
      this.prisma.student.count({ where: { tenantId, academicYear } }),
      this.prisma.student.count({ where: { tenantId, academicYear, isActive: true } }),
      this.prisma.student.groupBy({
        by:    ['sectionId'],
        where: { tenantId, academicYear },
        _count: true,
      }),
    ]);

    return { total, active, inactive: total - active, bySectionRaw };
  }
}
