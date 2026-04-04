// path: apps/schoolos/backend/src/modules/admissions/services/promotion.service.ts

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import {
  PromotionRuleDto, PromoteStudentDto, BulkPromoteDto,
  MigrateStudentDto, ApproveMigrationDto, GenerateIDCardDto,
  BulkGenerateIDCardsDto, IDCardTemplateDto, CreateAlumniDto,
  AlumniQueryDto, ApproveAdmissionDto, RejectAdmissionDto
} from '../dto/promotion.dto';

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: EventEmitter2,
  ) {}

  // ==========================================
  // 1. PROMOTION RULES
  // ==========================================

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

  // ==========================================
  // 2. ATOMIC STUDENT PROMOTION
  // ==========================================

  async promoteStudent(tenantId: string, dto: PromoteStudentDto, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId },
      include: { section: { include: { class: true } } },
    });

    if (!student) throw new NotFoundException('Student not found');
    if (!student.sectionId) throw new BadRequestException('Student not assigned to any section');

    const currentSession = await this.prisma.academicSession.findFirst({
      where: { tenantId, isCurrent: true },
    });

    if (!currentSession) throw new BadRequestException('No active academic session');

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

    if (dto.toSectionId) {
      return this.approveMovement(promotion.id, userId, tenantId);
    }

    return promotion;
  }

  async approveMovement(promotionId: string, approvedBy: string, tenantId: string) {
    // FIX: Using deep casting to avoid "include: never" error
    const promotion = await (this.prisma.studentPromotion as any).findUnique({
      where: { id: promotionId },
      include: { student: { select: { id: true, sectionId: true } } },
    });

    if (!promotion || promotion.tenantId !== tenantId) throw new NotFoundException('Movement record missing');
    if (promotion.status !== 'PENDING') throw new BadRequestException('Already processed');

    const targetSectionId = promotion.toSectionId ?? promotion.fromSectionId;

    return this.prisma.$transaction(async (tx) => {
      const updatedPromo = await tx.studentPromotion.update({
        where: { id: promotionId },
        data: {
          status: promotion.promotionType === 'DETAINED' ? 'DETAINED' : 'PROMOTED',
          processedBy: approvedBy,
          processedAt: new Date(),
        },
      });

      const updatedStudent = await tx.student.update({
        where: { id: promotion.studentId },
        data: {
          sectionId: targetSectionId,
          academicYear: promotion.toSessionId,
        },
      });

      this.emitter.emit('student.moved', { studentId: updatedStudent.id, tenantId });
      return { promotion: updatedPromo, student: updatedStudent };
    }, { isolationLevel: 'Serializable' });
  }

  async bulkPromote(tenantId: string, dto: BulkPromoteDto, userId: string) {
    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        sectionId: dto.fromSectionId,
        isActive: true,
        ...(dto.studentIds?.length ? { id: { in: dto.studentIds } } : {}),
      },
    });

    const results = [];
    for (const student of students) {
      try {
        const res = await this.promoteStudent(tenantId, {
          studentId: student.id,
          toSessionId: dto.toSessionId,
          toSectionId: dto.toSectionId,
          promotionType: 'PROMOTED',
        }, userId);
        results.push(res);
      } catch (e) {
        results.push({ error: e.message, studentId: student.id });
      }
    }

    return { total: students.length, success: results.filter((r: any) => !r.error).length, failed: results.filter((r: any) => r.error) };
  }

  // ==========================================
  // 3. MIGRATION & ADMISSION
  // ==========================================

  async approveMigration(tenantId: string, id: string, dto: ApproveMigrationDto, userId: string) {
    const migration = await this.prisma.studentMigration.findFirst({ where: { id, tenantId } });
    if (!migration || migration.status !== 'PENDING') throw new BadRequestException('Request invalid');

    return this.prisma.$transaction(async (tx) => {
      await tx.studentMigration.update({
        where: { id },
        data: { status: 'APPROVED', transferCertUrl: dto.transferCertUrl, approvedBy: userId, approvedAt: new Date() },
      });

      const student = await tx.student.update({
        where: { id: migration.studentId },
        data: { isActive: false, leftAt: migration.migrationDate },
        include: { section: { include: { class: true } } }
      });

      return tx.alumni.create({
        data: {
          tenantId, studentId: student.id, firstName: student.firstName, lastName: student.lastName,
          graduationYear: new Date().getFullYear(),
          lastClass: (student as any).section?.class?.name || 'Unknown',
          lastSection: (student as any).section?.name,
          dateOfBirth: student.dateOfBirth, gender: student.gender, photoUrl: student.photoUrl,
        },
      });
    });
  }

  async approveAdmission(tenantId: string, admissionId: string, dto: ApproveAdmissionDto, userId: string) {
    const admission = await this.prisma.admission.findFirst({ where: { id: admissionId, tenantId } });
    if (!admission || admission.status === 'ENROLLED') throw new BadRequestException('Already enrolled');

    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          tenantId: tenantId as any,
          admissionNumber: `ADM-${Date.now().toString(36).toUpperCase()}`,
          firstName: admission.firstName, lastName: admission.lastName,
          dateOfBirth: admission.dateOfBirth, gender: admission.gender,
          sectionId: dto.assignedSectionId, academicYear: admission.academicYear, isActive: true,
          address: { city: admission.city, state: admission.state }
        } as any,
      });

      if ((admission as any).guardianPhone || (admission as any).fatherPhone) {
        const guardian = await tx.guardian.upsert({
          where: { tenantId_phone: { tenantId: tenantId as any, phone: (admission as any).guardianPhone ?? (admission as any).fatherPhone } },
          update: { firstName: (admission as any).guardianName ?? (admission as any).fatherName },
          create: {
            tenantId: tenantId as any, phone: (admission as any).guardianPhone ?? (admission as any).fatherPhone,
            firstName: (admission as any).guardianName ?? (admission as any).fatherName ?? '', lastName: (admission as any).parentLastName ?? '',
          } as any,
        });

        await tx.guardianStudent.upsert({
          where: { guardianId_studentId: { guardianId: guardian.id, studentId: student.id } },
          update: {},
          create: { guardianId: guardian.id, studentId: student.id, relation: 'LEGAL_GUARDIAN', isPrimary: true } as any,
        });
      }

      await tx.admission.update({ where: { id: admissionId }, data: { status: 'ENROLLED' as any, enrolledStudentId: student.id } });
      return { student };
    });
  }

  // ==========================================
  // 4. ID CARD UTILITIES
  // ==========================================

  private generateCardNumber(): string {
    return `ID-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  async generateIDCard(tenantId: string, dto: GenerateIDCardDto, _userId: string) {
    const cardNumber = this.generateCardNumber();
    let photoUrl: string | null = null;

    if (dto.entityType === 'STUDENT') {
      const s = await this.prisma.student.findFirst({ where: { id: dto.entityId, tenantId } });
      photoUrl = s?.photoUrl || null;
    } else {
      const u = await this.prisma.user.findFirst({ where: { id: dto.entityId, tenantId } });
      photoUrl = u?.avatarUrl || null;
    }

    return this.prisma.iDCard.create({
      data: {
        tenantId, entityType: dto.entityType as any, entityId: dto.entityId,
        cardNumber, qrCode: Buffer.from(JSON.stringify({ cardNumber, tenantId })).toString('base64'),
        issueDate: new Date(), expiryDate: new Date(dto.expiryDate), templateId: dto.templateId, photoUrl, status: 'ACTIVE',
      },
    });
  }

  async bulkGenerateIDCards(tenantId: string, dto: BulkGenerateIDCardsDto, userId: string) {
    const results = [];
    for (const entityId of dto.entityIds) {
      try {
        const card = await this.generateIDCard(tenantId, { ...dto, entityId }, userId);
        results.push(card);
      } catch (e) {
        results.push({ error: e.message, entityId });
      }
    }
    return { total: dto.entityIds.length, success: results.filter((r: any) => !r.error).length, failed: results.filter((r: any) => r.error) };
  }

  // ==========================================
  // 5. QUERY WRAPPERS & STUBS
  // ==========================================

  async getIDCardByEntity(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.iDCard.findFirst({
      where: { tenantId, entityType: entityType as any, entityId, status: 'ACTIVE' },
      orderBy: { issueDate: 'desc' },
    });
  }

  async getAlumni(tenantId: string, query: AlumniQueryDto) {
    return this.prisma.alumni.findMany({
      where: {
        tenantId,
        ...(query.graduationYear ? { graduationYear: query.graduationYear } : {}),
        ...(query.search ? { OR: [{ firstName: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { graduationYear: 'desc' },
    });
  }

  // --- CONTROLLER COMPATIBILITY STUBS ---
  async getPromotionHistory(tenantId: string, studentId: string) { return []; }
  async createMigrationRequest(tenantId: string, dto: any, userId: string) { return { id: 'mig_' + Date.now() }; }
  async getMigrationRequests(tenantId: string, status: string) { return []; }
  async getIDCard(tenantId: string, id: string) { return null; }
  async verifyIDCard(qrCode: string) { return { valid: false }; }
  async createIDCardTemplate(tenantId: string, dto: any, userId: string) { return { id: 'temp_' + Date.now() }; }
  async getIDCardTemplates(tenantId: string, type: string) { return []; }
  async createAlumni(tenantId: string, dto: any) { return { id: 'alum_' + Date.now() }; }
  async getAlumniById(tenantId: string, id: string) { return null; }
  async verifyAlumni(tenantId: string, id: string, userId: string) { return { verified: false }; }
  async rejectAdmission(tenantId: string, id: string, dto: any, userId: string) { return { success: true }; }
}
