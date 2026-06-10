import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AdmissionStepStatus,
  ApplicationStatus,
  GuardianRelation,
  Prisma,
  StudentStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { LeadService } from '@modules/crm/services/lead.service';
import {
  buildReadScope,
  requireWriteBranch,
  TENANT_WIDE_ROLES,
} from '@modules/crm/services/branch-scope.util';
import {
  ApproveApplicationDto,
  ConvertLeadDto,
  CreateApplicationDto,
  FinalizeApplicationDto,
  GuardianInputDto,
  ListApplicationsQueryDto,
  RejectApplicationDto,
  UpdateApplicationDto,
  UploadDocumentDto,
} from '../dto/application.dto';

const APP_DEFAULT_INCLUDE = {
  source: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true } },
  session: { select: { id: true, name: true } },
  lead: { select: { id: true, parentName: true, parentPhone: true, status: true } },
  documents: {
    select: {
      id: true, type: true, fileUrl: true, fileName: true,
      mimeType: true, fileSize: true, status: true, createdAt: true,
    },
    where: { isDeleted: false },
    orderBy: { createdAt: 'desc' } as Prisma.DocumentOrderByWithRelationInput,
  },
  primaryStudent: {
    select: {
      id: true, admissionNumber: true, firstName: true, lastName: true,
      classId: true, sectionId: true, rollNumber: true, status: true,
    },
  },
  approvals: {
    orderBy: { createdAt: 'desc' } as Prisma.ApplicationApprovalOrderByWithRelationInput,
    include: {
      reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
} satisfies Prisma.AdmissionApplicationInclude;

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly leadService: LeadService,
  ) {}

  // ============================================================
  // READS
  // ============================================================

  async list(user: AuthenticatedUser, query: ListApplicationsQueryDto) {
    const scope = buildReadScope(user, query.branchId);
    const where: Prisma.AdmissionApplicationWhereInput = {
      ...scope.where,
      isDeleted: false,
    };
    if (query.status) where.status = query.status;
    if (query.applyingClassId) where.applyingClassId = query.applyingClassId;
    if (query.academicYear) where.academicYear = query.academicYear;
    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { crmNo: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.admissionApplication.findMany({
        where,
        include: APP_DEFAULT_INCLUDE,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.admissionApplication.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const scope = buildReadScope(user);
    const app = await this.prisma.admissionApplication.findFirst({
      where: { ...scope.where, id, isDeleted: false },
      include: APP_DEFAULT_INCLUDE,
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  // ============================================================
  // CREATE (direct) / CONVERT (from lead)
  // ============================================================

  async create(user: AuthenticatedUser, dto: CreateApplicationDto) {
    const { tenantId, branchId } = requireWriteBranch(user);
    return this.prisma.$transaction(async (tx) => {
      const app = await this.createApplicationTx(tx, user, tenantId, branchId, dto);
      return tx.admissionApplication.findUniqueOrThrow({
        where: { id: app.id },
        include: APP_DEFAULT_INCLUDE,
      });
    });
  }

  async convertFromLead(user: AuthenticatedUser, dto: ConvertLeadDto) {
    const { tenantId, branchId } = requireWriteBranch(user);
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: {
          id: dto.leadId,
          tenantId,
          ...(TENANT_WIDE_ROLES.has(user.role) ? {} : { branchId: user.branchId }),
        },
      });
      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.applicationId) {
        throw new ConflictException(
          'Lead already converted to an application.',
        );
      }

      const app = await this.createApplicationTx(
        tx, user, tenantId, lead.branchId, dto.application,
        { sourceLeadId: lead.id, sourceId: lead.sourceId ?? undefined, campaignId: lead.campaignId ?? undefined },
      );

      await tx.lead.update({
        where: { id: lead.id },
        data: { applicationId: app.id, status: 'APPLICATION_STARTED' as any },
      });

      return tx.admissionApplication.findUniqueOrThrow({
        where: { id: app.id },
        include: APP_DEFAULT_INCLUDE,
      });
    });
  }

  private async createApplicationTx(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    tenantId: string,
    branchId: string,
    dto: CreateApplicationDto,
    extras?: { sourceLeadId?: string; sourceId?: string; campaignId?: string },
  ) {
    // Generate CRM no: CRM-{YY}{MM}-{NNNN sequence per tenant}
    const crmNo = await this.generateCrmNo(tx, tenantId);
    const sessionId = dto.sessionId ?? (await this.resolveCurrentSessionId(tx, tenantId, dto.academicYear));

    const app = await tx.admissionApplication.create({
      data: {
        tenantId,
        branchId,
        crmNo,
        firstName: dto.firstName.trim(),
        middleName: dto.middleName?.trim(),
        lastName: dto.lastName.trim(),
        photoUrl: dto.photoUrl,
        dob: new Date(dto.dob),
        gender: dto.gender,
        bloodGroup: dto.bloodGroup,
        category: dto.category,
        religion: dto.religion,
        nationality: dto.nationality ?? 'Indian',
        phone: dto.phone?.trim(),
        email: dto.email?.trim().toLowerCase(),
        fatherName: dto.fatherName?.trim(),
        fatherPhone: dto.fatherPhone?.trim(),
        fatherOccupation: dto.fatherOccupation?.trim(),
        motherName: dto.motherName?.trim(),
        motherPhone: dto.motherPhone?.trim(),
        motherOccupation: dto.motherOccupation?.trim(),
        applyingClassId: dto.applyingClassId,
        academicYear: dto.academicYear,
        sessionId,
        admissionMode: dto.admissionMode,
        previousSchool: dto.previousSchool,
        previousClass: dto.previousClass,
        medicalConditions: dto.medicalConditions,
        allergies: dto.allergies,
        transportRequired: dto.transportRequired,
        pickupLocation: dto.pickupLocation,
        sourceId: extras?.sourceId ?? dto.sourceId,
        campaignId: extras?.campaignId ?? dto.campaignId,
        referredById: dto.referredById,
        status: ApplicationStatus.DRAFT,
        stepStatus: AdmissionStepStatus.UNDER_REVIEW,
        formDetails: dto.guardians ? JSON.parse(JSON.stringify({ guardians: dto.guardians })): Prisma.JsonNull,
        notes: dto.initialNote
          ? ([{ at: new Date().toISOString(), by: user.id, text: dto.initialNote }] as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        createdById: user.id,
      },
    });

    await this.audit.logCreate({
      tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'AdmissionApplication',
      entityId: app.id,
      after: { branchId, crmNo, status: app.status, fromLeadId: extras?.sourceLeadId ?? null },
    });
    return app;
  }

  // ============================================================
  // UPDATE / SUBMIT
  // ============================================================

  async update(user: AuthenticatedUser, id: string, dto: UpdateApplicationDto) {
    const app = await this.assertEditable(user, id);
    if (app.status !== ApplicationStatus.DRAFT && app.status !== ApplicationStatus.SUBMITTED && app.status !== ApplicationStatus.IN_REVIEW) {
      throw new BadRequestException(`Cannot edit application in status ${app.status}.`);
    }
    const data: Prisma.AdmissionApplicationUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.middleName !== undefined) data.middleName = dto.middleName?.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.dob !== undefined) data.dob = new Date(dto.dob);
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.bloodGroup !== undefined) data.bloodGroup = dto.bloodGroup;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.religion !== undefined) data.religion = dto.religion;
    if (dto.nationality !== undefined) data.nationality = dto.nationality;
    if (dto.photoUrl !== undefined) data.photoUrl = dto.photoUrl;
    if (dto.phone !== undefined) data.phone = dto.phone?.trim();
    if (dto.email !== undefined) data.email = dto.email?.trim().toLowerCase();
    if (dto.fatherName !== undefined) data.fatherName = dto.fatherName;
    if (dto.fatherPhone !== undefined) data.fatherPhone = dto.fatherPhone;
    if (dto.fatherOccupation !== undefined) data.fatherOccupation = dto.fatherOccupation;
    if (dto.motherName !== undefined) data.motherName = dto.motherName;
    if (dto.motherPhone !== undefined) data.motherPhone = dto.motherPhone;
    if (dto.motherOccupation !== undefined) data.motherOccupation = dto.motherOccupation;
    if (dto.applyingClassId !== undefined) data.applyingClassId = dto.applyingClassId;
    if (dto.academicYear !== undefined) data.academicYear = dto.academicYear;
    if (dto.sessionId !== undefined) data.session = dto.sessionId ? { connect: { id: dto.sessionId } } : { disconnect: true };
    if (dto.admissionMode !== undefined) data.admissionMode = dto.admissionMode;
    if (dto.previousSchool !== undefined) data.previousSchool = dto.previousSchool;
    if (dto.previousClass !== undefined) data.previousClass = dto.previousClass;
    if (dto.medicalConditions !== undefined) data.medicalConditions = dto.medicalConditions;
    if (dto.allergies !== undefined) data.allergies = dto.allergies;
    if (dto.transportRequired !== undefined) data.transportRequired = dto.transportRequired;
    if (dto.pickupLocation !== undefined) data.pickupLocation = dto.pickupLocation;
    if (dto.sourceId !== undefined) data.source = dto.sourceId ? { connect: { id: dto.sourceId } } : { disconnect: true };
    if (dto.campaignId !== undefined) data.campaign = dto.campaignId ? { connect: { id: dto.campaignId } } : { disconnect: true };
    if (dto.guardians !== undefined) {
      const currentDetails = (app.formDetails && typeof app.formDetails === 'object'
        ? (app.formDetails as Record<string, unknown>)
        : {});
     data.formDetails = JSON.parse( JSON.stringify({...currentDetails, guardians: dto.guardians,}),);
    }
    data.updatedBy = { connect: { id: user.id } };

    const updated = await this.prisma.admissionApplication.update({
      where: { id },
      data,
      include: APP_DEFAULT_INCLUDE,
    });
    return updated;
  }

  async submit(user: AuthenticatedUser, id: string) {
    const app = await this.assertEditable(user, id);
    if (app.status !== ApplicationStatus.DRAFT) {
      throw new BadRequestException(`Application is already ${app.status}.`);
    }
    // Validate at-least-one guardian present
    const details = (app.formDetails && typeof app.formDetails === 'object'
      ? (app.formDetails as Record<string, unknown>) : {});
    const guardians = (details.guardians as GuardianInputDto[] | undefined) ?? [];
    if (!guardians.length) {
      throw new BadRequestException('At least one guardian is required before submitting.');
    }
    const updated = await this.prisma.admissionApplication.update({
      where: { id },
      data: {
        status: ApplicationStatus.SUBMITTED,
        stepStatus: AdmissionStepStatus.UNDER_REVIEW,
        updatedById: user.id,
      },
      include: APP_DEFAULT_INCLUDE,
    });
    // Update linked lead
    if (app.lead) {
      await this.prisma.lead.update({
        where: { id: app.lead.id },
        data: { status: 'APPLICATION_SUBMITTED' as any },
      }).catch(() => null);
    }
    return updated;
  }

  // ============================================================
  // DOCUMENTS (URL-only upload)
  // ============================================================

  async uploadDocument(user: AuthenticatedUser, applicationId: string, dto: UploadDocumentDto) {
    const app = await this.assertEditable(user, applicationId);
    const doc = await this.prisma.document.create({
      data: {
        tenantId: app.tenantId,
        branchId: app.branchId,
        type: dto.type,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        admissionApplicationId: app.id,
        uploadedById: user.id,
      },
    });
    return doc;
  }

  async listDocuments(user: AuthenticatedUser, applicationId: string) {
    const app = await this.assertReadable(user, applicationId);
    return this.prisma.document.findMany({
      where: { admissionApplicationId: app.id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================
  // PHASE 3 — APPROVE / REJECT
  // ============================================================

  async approve(user: AuthenticatedUser, id: string, dto: ApproveApplicationDto) {
    const app = await this.assertEditable(user, id);
    if (app.status === ApplicationStatus.APPROVED || app.status === ApplicationStatus.ENROLLED) {
      throw new BadRequestException(`Application already ${app.status}.`);
    }
    if (app.status === ApplicationStatus.REJECTED) {
      throw new BadRequestException('Application is rejected and cannot be approved.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.admissionApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.APPROVED,
          stepStatus: AdmissionStepStatus.VERIFICATION,
          sectionId: dto.sectionId ?? app.sectionId,
          updatedById: user.id,
        },
      });
      await tx.applicationApproval.create({
        data: {
          tenantId: app.tenantId,
          applicationId: app.id,
          tier: 'PRINCIPAL_SIGNOFF',
          status: 'APPROVED',
          reviewedById: user.id,
          reviewedAt: new Date(),
          comments: dto.note,
        },
      });
      if (app.lead) {
        await tx.lead.update({
          where: { id: (app.lead as any).id ?? '' },
          data: { status: 'APPROVED' as any },
        }).catch(() => null);
      }
      return u;
    });

    await this.audit.logUpdate({
      tenantId: app.tenantId, actorId: user.id, actorRole: user.role,
      entityType: 'AdmissionApplication', entityId: app.id,
      before: { status: app.status }, after: { status: 'APPROVED' },
      metadata: { action: 'APPROVE' },
    });

    return this.prisma.admissionApplication.findUniqueOrThrow({
      where: { id: updated.id }, include: APP_DEFAULT_INCLUDE,
    });
  }

  async reject(user: AuthenticatedUser, id: string, dto: RejectApplicationDto) {
    const app = await this.assertEditable(user, id);
    if (app.status === ApplicationStatus.ENROLLED) {
      throw new BadRequestException('Cannot reject an enrolled application.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.admissionApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.REJECTED,
          stepStatus: AdmissionStepStatus.REJECTED,
          updatedById: user.id,
        },
      });
      await tx.applicationApproval.create({
        data: {
          tenantId: app.tenantId,
          applicationId: app.id,
          tier: 'PRINCIPAL_SIGNOFF',
          status: 'REJECTED',
          reviewedById: user.id,
          reviewedAt: new Date(),
          comments: dto.reason,
        },
      });
      if (app.lead) {
        await tx.lead.update({
          where: { id: (app.lead as any).id ?? '' },
          data: { status: 'LOST' as any },
        }).catch(() => null);
      }
      return u;
    });

    await this.audit.logUpdate({
      tenantId: app.tenantId, actorId: user.id, actorRole: user.role,
      entityType: 'AdmissionApplication', entityId: app.id,
      before: { status: app.status }, after: { status: 'REJECTED', reason: dto.reason },
      metadata: { action: 'REJECT' },
    });

    return this.prisma.admissionApplication.findUniqueOrThrow({
      where: { id: updated.id }, include: APP_DEFAULT_INCLUDE,
    });
  }

  // ============================================================
  // PHASE 4 — FINALIZE ENROLLMENT (Student + Guardian + Users)
  // ============================================================

  async finalize(user: AuthenticatedUser, id: string, dto: FinalizeApplicationDto) {
    const app = await this.assertEditable(user, id);
    if (app.status !== ApplicationStatus.APPROVED) {
      throw new BadRequestException('Application must be APPROVED before finalizing.');
    }
    if (app.studentId || app.convertedAt) {
      throw new ConflictException('Application already finalized to a Student.');
    }

    const sectionId = dto.sectionId ?? app.sectionId;
    if (!sectionId) {
      throw new BadRequestException('No section assigned. Allocate a section before finalizing.');
    }
    if (!app.applyingClassId) {
      throw new BadRequestException('Application is missing applyingClassId.');
    }

    // Build canonical guardians list from formDetails (preferred) or
    // fall back to denormalized father/mother snapshot.
    const details = (app.formDetails && typeof app.formDetails === 'object'
      ? (app.formDetails as Record<string, unknown>) : {});
    let guardians = (details.guardians as GuardianInputDto[] | undefined) ?? [];
    if (!guardians.length) {
      if (app.fatherName && app.fatherPhone) {
        guardians.push({
          firstName: app.fatherName.split(' ')[0] ?? app.fatherName,
          lastName: app.fatherName.split(' ').slice(1).join(' ') || '-',
          phone: app.fatherPhone,
          occupation: app.fatherOccupation ?? undefined,
          relation: GuardianRelation.FATHER,
          isPrimary: true,
        });
      }
      if (app.motherName && app.motherPhone) {
        guardians.push({
          firstName: app.motherName.split(' ')[0] ?? app.motherName,
          lastName: app.motherName.split(' ').slice(1).join(' ') || '-',
          phone: app.motherPhone,
          occupation: app.motherOccupation ?? undefined,
          relation: GuardianRelation.MOTHER,
          isPrimary: !app.fatherName,
        });
      }
    }
    if (!guardians.length) {
      throw new BadRequestException('No guardian information available to create a parent login.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Lock section row to compute roll number safely.
      await tx.$executeRaw`
        SELECT id FROM "Section"
        WHERE id = ${sectionId}
        AND "tenantId" = ${app.tenantId}
        AND "branchId" = ${app.branchId}
        FOR UPDATE;
      `;

      // Roll number — explicit override or next available numeric
      let rollNumber = dto.rollNumber?.trim();
      if (!rollNumber) {
        const existing = await tx.student.findMany({
          where: { tenantId: app.tenantId, branchId: app.branchId, sectionId, academicYear: app.academicYear, isActive: true },
          select: { rollNumber: true },
        });
        const taken = existing
          .map((s) => Number(s.rollNumber ?? 0))
          .filter((n) => Number.isFinite(n) && n > 0);
        const next = (taken.length ? Math.max(...taken) : 0) + 1;
        rollNumber = String(next);
      } else {
        const conflict = await tx.student.findFirst({
          where: { tenantId: app.tenantId, branchId: app.branchId, sectionId, academicYear: app.academicYear, rollNumber, isActive: true },
        });
        if (conflict) throw new ConflictException(`Roll number ${rollNumber} already taken in this section.`);
      }

      // Admission number deterministically derived from CRM number
      const admissionNumber = app.crmNo.trim().toUpperCase().replace(/^CRM-/, 'ADM-');

      // ---------- 1. Create student User (no password by default — set on first parent invite flow). ----------
      const studentUserEmail = app.email?.trim().toLowerCase()
        || `${this.usernameSeed(app.firstName)}.${admissionNumber.toLowerCase()}@${app.tenantId}.schoolos.local`;
      const studentUserPhone = app.phone?.trim() || undefined;
      const studentUser = await this.upsertUser(tx, {
        tenantId: app.tenantId,
        branchId: app.branchId,
        email: studentUserEmail,
        phone: studentUserPhone,
        firstName: app.firstName,
        lastName: app.lastName,
        role: UserRole.STUDENT,
      });

      // ---------- 2. Create Student ----------
      const student = await tx.student.create({
        data: {
          tenantId: app.tenantId,
          branchId: app.branchId,
          admissionNumber,
          admissionDate: new Date(),
          status: StudentStatus.ENROLLED,
          firstName: app.firstName,
          lastName: app.lastName,
          dateOfBirth: app.dob,
          gender: app.gender ?? undefined,
          classId: app.applyingClassId!,
          sectionId,
          rollNumber,
          rollAssignedAt: new Date(),
          academicYear: app.academicYear,
          sessionId: app.sessionId ?? undefined,
          phone: app.phone ?? undefined,
          email: app.email ?? undefined,
          isActive: true,
          admissionApplicationId: app.id,
          userId: studentUser.id,
        },
      });

      // ---------- 3. Create guardians + their Users + GuardianStudent links ----------
      const guardianResults: Array<{
        guardian: { id: string; firstName: string; lastName: string; phone: string; email: string | null };
        user: { id: string; email: string; tempPassword?: string };
        link: { id: string; relation: GuardianRelation; isPrimary: boolean };
      }> = [];

      for (let i = 0; i < guardians.length; i++) {
        const g = guardians[i];
        // Guardian user (PARENT role)
        const guardianEmail = g.email?.trim().toLowerCase()
          || `${this.usernameSeed(g.firstName)}${this.shortDigits()}@${app.tenantId}.schoolos.local`;
        const tempPassword = this.generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        const guardianUser = await this.upsertUser(tx, {
          tenantId: app.tenantId,
          branchId: app.branchId,
          email: guardianEmail,
          phone: g.phone,
          firstName: g.firstName,
          lastName: g.lastName,
          role: UserRole.PARENT,
          passwordHash,
        });

        // Guardian record (upsert on tenant+phone)
        const guardian = await tx.guardian.upsert({
          where: { tenantId_phone: { tenantId: app.tenantId, phone: g.phone } },
          create: {
            tenantId: app.tenantId,
            firstName: g.firstName,
            lastName: g.lastName,
            phone: g.phone,
            email: g.email?.trim().toLowerCase(),
            occupation: g.occupation,
            userId: guardianUser.id,
            isActive: true,
          },
          update: {
            firstName: g.firstName,
            lastName: g.lastName,
            email: g.email?.trim().toLowerCase(),
            occupation: g.occupation,
            userId: guardianUser.id,
            isActive: true,
          },
        });

        const link = await tx.guardianStudent.upsert({
          where: { guardianId_studentId: { guardianId: guardian.id, studentId: student.id } },
          create: {
            guardianId: guardian.id,
            studentId: student.id,
            relation: g.relation,
            isPrimary: !!g.isPrimary || i === 0,
          },
          update: {
            relation: g.relation,
            isPrimary: !!g.isPrimary || i === 0,
          },
        });

        guardianResults.push({
          guardian: {
            id: guardian.id,
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            phone: guardian.phone,
            email: guardian.email,
          },
          user: { id: guardianUser.id, email: guardianUser.email, tempPassword },
          link: { id: link.id, relation: link.relation, isPrimary: link.isPrimary },
        });
      }

      // ---------- 4. Mark application ENROLLED ----------
      const finalApp = await tx.admissionApplication.update({
        where: { id: app.id },
        data: {
          status: ApplicationStatus.ENROLLED,
          stepStatus: AdmissionStepStatus.CONVERTED,
          sectionId,
          studentId: student.id,
          convertedAt: new Date(),
          updatedById: user.id,
        },
        include: APP_DEFAULT_INCLUDE,
      });

      // Mark lead as ENROLLED if present
      if (app.lead) {
        await tx.lead.update({
          where: { id: (app.lead as any).id ?? '' },
          data: { status: 'ENROLLED' as any },
        }).catch(() => null);
      }

      // Notification stubs (Email/SMS/WhatsApp) — replaced with logger calls per MVP scope.
      this.logger.log({
        event: 'ENROLLMENT_NOTIFY_STUB',
        applicationId: app.id, studentId: student.id, admissionNumber,
        recipients: guardianResults.map((g) => ({ email: g.user.email, phone: g.guardian.phone })),
      });

      return {
        application: finalApp,
        student: {
          id: student.id, admissionNumber: student.admissionNumber,
          firstName: student.firstName, lastName: student.lastName,
          rollNumber: student.rollNumber, sectionId: student.sectionId,
          classId: student.classId, sessionId: student.sessionId,
          userId: student.userId,
        },
        guardians: guardianResults,
        login: {
          student: { email: studentUser.email },
          parents: guardianResults.map((g) => ({
            email: g.user.email,
            tempPassword: g.user.tempPassword,
            phone: g.guardian.phone,
          })),
        },
      };
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async generateCrmNo(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
    const now = new Date();
    const prefix = `CRM-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Find last existing crmNo for this tenant in current month
    const last = await tx.admissionApplication.findFirst({
      where: { tenantId, crmNo: { startsWith: prefix } },
      orderBy: { crmNo: 'desc' },
      select: { crmNo: true },
    });
    let seq = 1;
    if (last?.crmNo) {
      const tail = last.crmNo.split('-').pop() ?? '';
      const n = parseInt(tail, 10);
      if (!isNaN(n)) seq = n + 1;
    }
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  private async resolveCurrentSessionId(
    tx: Prisma.TransactionClient, tenantId: string, academicYear?: string,
  ): Promise<string | undefined> {
    if (academicYear) {
      const byName = await tx.academicSession.findFirst({
        where: { tenantId, name: academicYear }, select: { id: true },
      });
      if (byName) return byName.id;
    }
    const current = await tx.academicSession.findFirst({
      where: { tenantId, isCurrent: true }, select: { id: true },
    });
    return current?.id;
  }

  private usernameSeed(name: string): string {
    return (name ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 3) || 'usr';
  }

  private shortDigits(): string {
    return String(100 + Math.floor(Math.random() * 900));
  }

  private generateTempPassword(): string {
    return Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  private async upsertUser(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string; branchId: string;
      email: string; phone?: string;
      firstName: string; lastName: string;
      role: UserRole; passwordHash?: string;
    },
  ) {
    const existing = await tx.user.findFirst({
      where: { tenantId: input.tenantId, OR: [{ email: input.email }, ...(input.phone ? [{ phone: input.phone }] : [])] },
    });
    if (existing) {
      // Ensure branch mapping; do NOT downgrade existing user's role.
      await tx.userBranch.upsert({
        where: { userId_branchId: { userId: existing.id, branchId: input.branchId } },
	create: {  tenant: { connect: { id: input.tenantId },  },  user: { connect: { id: existing.id },  },  branch: { connect: { id: input.branchId },  }, },
        update: {},
      }).catch(() => null);
      return existing;
    }
    const user = await tx.user.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        passwordHash: input.passwordHash,
        isActive: true,
        isEmailVerified: false,
      },
    });
    await tx.userBranch.create({
    data: {  tenant: { connect: { id: input.tenantId },  },  user: {    connect: { id: user.id },  },  branch: { connect: { id: input.branchId },  },},
    }    ).catch(() => null);
    return user;
  }

  private async assertReadable(user: AuthenticatedUser, id: string) {
    const scope = buildReadScope(user);
    const app = await this.prisma.admissionApplication.findFirst({
      where: { ...scope.where, id, isDeleted: false },
      include: { lead: { select: { id: true } } },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  private async assertEditable(user: AuthenticatedUser, id: string) {
    const app = await this.assertReadable(user, id);
    if (!TENANT_WIDE_ROLES.has(user.role) && app.branchId !== user.branchId) {
      throw new ForbiddenException('Cannot edit application outside your branch.');
    }
    return app;
  }
}
