import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma.service';
import {
  PromotionRuleDto,
  PromoteStudentDto,
  BulkPromoteDto,
  MigrateStudentDto,
  ApproveMigrationDto,
  GenerateIDCardDto,
  BulkGenerateIDCardsDto,
  IDCardTemplateDto,
  CreateAlumniDto,
  AlumniQueryDto,
  ApproveAdmissionDto,
  RejectAdmissionDto,
} from '../dto/promotion.dto';
import * as crypto from 'crypto';

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ========== PROMOTION RULES ==========

  async createPromotionRule(tenantId: string, dto: PromotionRuleDto, userId: string) {
    return this.prisma.promotionRule.upsert({
      where: {
        tenantId_sessionId_fromClassId: {
          tenantId,
          sessionId: dto.sessionId,
          fromClassId: dto.fromClassId,
        },
      },
      create: {
        tenantId,
        sessionId: dto.sessionId,
        fromClassId: dto.fromClassId,
        toClassId: dto.toClassId,
        passingMarks: dto.passingMarks || 33,
        requireAllPass: dto.requireAllPass || false,
        autoPromote: dto.autoPromote || false,
        createdBy: userId,
      },
      update: {
        toClassId: dto.toClassId,
        passingMarks: dto.passingMarks,
        requireAllPass: dto.requireAllPass,
        autoPromote: dto.autoPromote,
      },
    });
  }

  async getPromotionRules(tenantId: string, sessionId: string) {
    return this.prisma.promotionRule.findMany({
      where: { tenantId, sessionId },
    });
  }

  // ========== STUDENT PROMOTION ==========

  async promoteStudent(tenantId: string, dto: PromoteStudentDto, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId },
      include: { section: { include: { class: true } } },
    });

    if (!student) throw new NotFoundException('Student not found');
    if (!student.sectionId) throw new BadRequestException('Student not assigned to any section');

    // Get current session
    const currentSession = await this.prisma.academicSession.findFirst({
      where: { tenantId, isCurrent: true },
    });

    if (!currentSession) throw new BadRequestException('No active academic session');

    // Create promotion record
    const promotion = await this.prisma.studentPromotion.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        fromSessionId: currentSession.id,
        toSessionId: dto.toSessionId,
        fromSectionId: student.sectionId,
        toSectionId: dto.toSectionId,
        promotionType: (dto.promotionType as any) || 'PROMOTED',
        status: 'PENDING',
        remarks: dto.remarks,
        processedBy: userId,
      },
    });

    // If toSectionId provided, update student
    if (dto.toSectionId) {
      await this.prisma.student.update({
        where: { id: dto.studentId },
        data: {
          sectionId: dto.toSectionId,
          academicYear: dto.toSessionId,
        },
      });

      await this.prisma.studentPromotion.update({
        where: { id: promotion.id },
        data: { status: 'PROMOTED', processedAt: new Date() },
      });
    }

    this.logger.log(`Student ${dto.studentId} promoted to session ${dto.toSessionId}`);
    return promotion;
  }

  async bulkPromote(tenantId: string, dto: BulkPromoteDto, userId: string) {
    // Get students in the section
    let students = await this.prisma.student.findMany({
      where: {
        tenantId,
        sectionId: dto.fromSectionId,
        isActive: true,
        ...(dto.studentIds?.length ? { id: { in: dto.studentIds } } : {}),
      },
    });

    // If minMarks filter provided, get student marks and filter
    if (dto.minMarks) {
      if (students.length === 0) {
        return { total: 0, success: 0, failed: [] };
      }

      // Get average marks from gradebook/exams
      const studentIds = students.map((s: { id: string }) => s.id);
      const placeholders = studentIds.map(() => '?').join(', ');
      const marksData = await this.prisma.$queryRawUnsafe(
        `
          SELECT "studentId", AVG("marksObtained") as "avgMarks"
          FROM "Mark"
          WHERE "tenantId" = ?
          AND "studentId" IN (${placeholders})
          GROUP BY "studentId"
          HAVING AVG("marksObtained") >= ?
        `,
        tenantId,
        ...studentIds,
        dto.minMarks,
      ) as Array<{ studentId: string; avgMarks: number }>;

      const eligibleIds = marksData.map((m: { studentId: string }) => m.studentId);
      students = students.filter((s: { id: string }) => eligibleIds.includes(s.id));
    }

    // Promote each student
    const results = await Promise.all(
      students.map((student: { id: string }) =>
        this.promoteStudent(
          tenantId,
          {
            studentId: student.id,
            toSessionId: dto.toSessionId,
            toSectionId: dto.toSectionId,
            promotionType: 'PROMOTED',
          },
          userId,
        ).catch((e) => ({ error: e.message, studentId: student.id })),
      ),
    );

    return {
      total: students.length,
      success: results.filter((r: any) => !('error' in r)).length,
      failed: results.filter((r: any) => 'error' in r),
    };
  }

  async getPromotionHistory(tenantId: string, studentId?: string) {
    const where: any = { tenantId };
    if (studentId) where.studentId = studentId;

    return this.prisma.studentPromotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ========== STUDENT MIGRATION ==========

  async createMigrationRequest(tenantId: string, dto: MigrateStudentDto, _userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId },
    });

    if (!student) throw new NotFoundException('Student not found');

    return this.prisma.studentMigration.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        targetSchoolName: dto.targetSchoolName,
        targetSchoolCode: dto.targetSchoolCode,
        migrationDate: new Date(dto.migrationDate),
        reason: dto.reason,
        status: 'PENDING',
      },
    });
  }

  async approveMigration(tenantId: string, id: string, dto: ApproveMigrationDto, userId: string) {
    const migration = await this.prisma.studentMigration.findFirst({
      where: { id, tenantId },
    });

    if (!migration) throw new NotFoundException('Migration request not found');
    if (migration.status !== 'PENDING') {
      throw new BadRequestException('Migration already processed');
    }

    // Update migration status
    await this.prisma.studentMigration.update({
      where: { id },
      data: {
        status: 'APPROVED',
        transferCertUrl: dto.transferCertUrl,
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    // Mark student as inactive
    await this.prisma.student.update({
      where: { id: migration.studentId },
      data: {
        isActive: false,
        leftAt: migration.migrationDate,
      },
    });

    // Create alumni record
    const student = await this.prisma.student.findUnique({
      where: { id: migration.studentId },
      include: { section: { include: { class: true } } },
    });

    if (student) {
      await this.prisma.alumni.create({
        data: {
          tenantId,
          studentId: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          graduationYear: new Date().getFullYear(),
          lastClass: student.section?.class?.name || 'Unknown',
          lastSection: student.section?.name,
          dateOfBirth: student.dateOfBirth,
          gender: student.gender,
          photoUrl: student.photoUrl,
        },
      });
    }

    return this.prisma.studentMigration.findUnique({ where: { id } });
  }

  async getMigrationRequests(tenantId: string, status?: string) {
    const where: any = { tenantId };
    if (status) where.status = status;

    return this.prisma.studentMigration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ========== ID CARD ==========

  private generateCardNumber(): string {
    return `ID-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private generateQRCode(data: any): string {
    // Create encrypted QR data
    const payload = JSON.stringify(data);
    return Buffer.from(payload).toString('base64');
  }

  async generateIDCard(tenantId: string, dto: GenerateIDCardDto, _userId: string) {
    const cardNumber = this.generateCardNumber();

    // Get entity details
    let photoUrl: string | null = null;
    if (dto.entityType === 'STUDENT') {
      const student = await this.prisma.student.findFirst({
        where: { id: dto.entityId, tenantId },
      });
      if (!student) throw new NotFoundException('Student not found');
      photoUrl = student.photoUrl;
    } else {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.entityId, tenantId },
      });
      if (!user) throw new NotFoundException('Staff not found');
      photoUrl = user.avatarUrl;
    }

    // Generate QR code data
    const qrCode = this.generateQRCode({
      cardNumber,
      entityId: dto.entityId,
      entityType: dto.entityType,
      tenantId,
    });

    return this.prisma.iDCard.create({
      data: {
        tenantId,
        entityType: dto.entityType as any,
        entityId: dto.entityId,
        cardNumber,
        qrCode,
        issueDate: new Date(),
        expiryDate: new Date(dto.expiryDate),
        templateId: dto.templateId,
        photoUrl,
        status: 'ACTIVE',
      },
    });
  }

  async bulkGenerateIDCards(tenantId: string, dto: BulkGenerateIDCardsDto, userId: string) {
    const results = await Promise.all(
      dto.entityIds.map((entityId) =>
        this.generateIDCard(
          tenantId,
          {
            entityType: dto.entityType,
            entityId,
            templateId: dto.templateId,
            expiryDate: dto.expiryDate,
          },
          userId,
        ).catch((e) => ({ error: e.message, entityId })),
      ),
    );

    return {
      total: dto.entityIds.length,
      success: results.filter((r: any) => !('error' in r)).length,
      failed: results.filter((r: any) => 'error' in r),
    };
  }

  async getIDCard(tenantId: string, id: string) {
    const card = await this.prisma.iDCard.findFirst({
      where: { id, tenantId },
    });

    if (!card) throw new NotFoundException('ID card not found');
    return card;
  }

  async getIDCardByEntity(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.iDCard.findFirst({
      where: { tenantId, entityType: entityType as any, entityId, status: 'ACTIVE' },
      orderBy: { issueDate: 'desc' },
    });
  }

  async verifyIDCard(qrCode: string) {
    const card = await this.prisma.iDCard.findFirst({
      where: { qrCode },
    });

    if (!card) return { valid: false, message: 'Card not found' };
    if (card.status !== 'ACTIVE') return { valid: false, message: `Card is ${card.status}` };
    if (new Date() > card.expiryDate) return { valid: false, message: 'Card expired' };

    return { valid: true, card };
  }

  // ========== ID CARD TEMPLATES ==========

  async createIDCardTemplate(tenantId: string, dto: IDCardTemplateDto, userId: string) {
    // If setting as default, unset others
    if (dto.isDefault) {
      await this.prisma.iDCardTemplate.updateMany({
        where: { tenantId, type: dto.type as any, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.iDCardTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type as any,
        frontDesign: dto.frontDesign,
        backDesign: dto.backDesign,
        width: dto.width || 86,
        height: dto.height || 54,
        isDefault: dto.isDefault || false,
        createdBy: userId,
      },
    });
  }

  async getIDCardTemplates(tenantId: string, type?: string) {
    const where: any = { tenantId };
    if (type) where.type = type;

    return this.prisma.iDCardTemplate.findMany({ where });
  }

  // ========== ALUMNI ==========

  async createAlumni(tenantId: string, dto: CreateAlumniDto) {
    return this.prisma.alumni.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        graduationYear: dto.graduationYear,
        lastClass: dto.lastClass,
        lastSection: dto.lastSection,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender as any,
        photoUrl: dto.photoUrl,
        currentOccupation: dto.currentOccupation,
        currentCompany: dto.currentCompany,
        currentCity: dto.currentCity,
        linkedInUrl: dto.linkedInUrl,
        achievements: dto.achievements,
      },
    });
  }

  async getAlumni(tenantId: string, query: AlumniQueryDto) {
    const where: any = { tenantId };
    if (query.graduationYear) where.graduationYear = query.graduationYear;
    if (query.lastClass) where.lastClass = query.lastClass;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.alumni.findMany({
      where,
      orderBy: [{ graduationYear: 'desc' }, { firstName: 'asc' }],
    });
  }

  async getAlumniById(tenantId: string, id: string) {
    const alumni = await this.prisma.alumni.findFirst({
      where: { id, tenantId },
    });

    if (!alumni) throw new NotFoundException('Alumni not found');
    return alumni;
  }

  async verifyAlumni(_tenantId: string, id: string, userId: string) {
    return this.prisma.alumni.update({
      where: { id },
      data: { isVerified: true, verifiedBy: userId },
    });
  }

  // ========== ADMISSION APPROVAL ==========

  async approveAdmission(tenantId: string, admissionId: string, dto: ApproveAdmissionDto, userId: string) {
    const admission = await this.prisma.admission.findFirst({
      where: { id: admissionId, tenantId },
    });

    if (!admission) throw new NotFoundException('Admission not found');
    if (admission.status === 'ENROLLED') {
      throw new BadRequestException('Admission already enrolled');
    }

    // Create student record
    const admissionNumber = `ADM-${Date.now().toString(36).toUpperCase()}`;
    const student = await this.prisma.student.create({
      data: {
        tenantId,
        admissionNumber,
        firstName: admission.firstName,
        lastName: admission.lastName,
        dateOfBirth: admission.dateOfBirth,
        gender: admission.gender,
        sectionId: dto.assignedSectionId,
        academicYear: admission.academicYear,
        address: admission.addressLine || admission.city || admission.state || admission.pincode
          ? {
              addressLine: admission.addressLine,
              city: admission.city,
              state: admission.state,
              pincode: admission.pincode,
            }
          : undefined,
        isActive: true,
      },
    });

    if (admission.parentFirstName && admission.parentPhone) {
      const guardian = await this.prisma.guardian.create({
        data: {
          tenantId,
          firstName: admission.parentFirstName,
          lastName: admission.parentLastName ?? '',
          phone: admission.parentPhone,
          altPhone: admission.alternatePhone ?? null,
          email: admission.parentEmail ?? null,
          address: admission.addressLine || admission.city || admission.state || admission.pincode
            ? {
                addressLine: admission.addressLine,
                city: admission.city,
                state: admission.state,
                pincode: admission.pincode,
              }
            : undefined,
        },
      });

      await this.prisma.guardianStudent.create({
        data: {
          guardianId: guardian.id,
          studentId: student.id,
          relation: 'LEGAL_GUARDIAN',
          isPrimary: true,
        },
      });
    }

    // Update admission status
    await this.prisma.admission.update({
      where: { id: admissionId },
      data: {
        status: 'ENROLLED',
        enrolledStudentId: student.id,
        notes: dto.notes,
      },
    });

    // Log activity
    await this.prisma.admissionActivity.create({
      data: {
        admissionId,
        tenantId,
        actorId: userId,
        action: 'APPROVED',
        note: dto.notes,
      },
    });

    this.logger.log(`Admission ${admissionId} approved, student ${student.id} created`);
    const freshAdmission = await this.prisma.admission.findUniqueOrThrow({
      where: { id: admissionId },
      include: { activities: { orderBy: { createdAt: 'desc' } } },
    });
    return { admission: freshAdmission, student };
  }

  async rejectAdmission(tenantId: string, admissionId: string, dto: RejectAdmissionDto, userId: string) {
    const admission = await this.prisma.admission.findFirst({
      where: { id: admissionId, tenantId },
    });

    if (!admission) throw new NotFoundException('Admission not found');

    await this.prisma.admission.update({
      where: { id: admissionId },
      data: {
        status: 'REJECTED',
        rejectionReason: dto.reason,
      },
    });

    await this.prisma.admissionActivity.create({
      data: {
        admissionId,
        tenantId,
        actorId: userId,
        action: 'REJECTED',
        note: dto.reason,
      },
    });

    return this.prisma.admission.findUnique({ where: { id: admissionId } });
  }
}
