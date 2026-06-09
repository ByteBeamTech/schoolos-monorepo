import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import {
  AssignLeadDto,
  ChangeLeadStatusDto,
  CreateLeadDto,
  LEAD_STATUS_VALUES,
  ListLeadsQueryDto,
  UpdateLeadDto,
} from '../dto/lead.dto';
import { buildReadScope, requireWriteBranch, TENANT_WIDE_ROLES } from './branch-scope.util';

const LEAD_DEFAULT_INCLUDE = {
  source: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
  referredBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  application: {
    select: {
      id: true,
      crmNo: true,
      status: true,
      stepStatus: true,
      convertedAt: true,
      studentId: true,
    },
  },
  _count: { select: { tasks: true, interactions: true } },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------- READS ----------

  async list(user: AuthenticatedUser, query: ListLeadsQueryDto) {
    const scope = buildReadScope(user, query.branchId);

    const where: Prisma.LeadWhereInput = { ...scope.where };

    if (query.status) where.status = query.status as any;
    if (query.temperature) where.temperature = query.temperature as any;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.sourceId) where.sourceId = query.sourceId;

    if (query.mineOnly === 'true') {
      where.assignedToId = user.id;
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { parentName: { contains: s, mode: 'insensitive' } },
        { studentName: { contains: s, mode: 'insensitive' } },
        { parentPhone: { contains: s } },
        { parentEmail: { contains: s, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: LEAD_DEFAULT_INCLUDE,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const scope = buildReadScope(user);
    const lead = await this.prisma.lead.findFirst({
      where: { ...scope.where, id },
      include: {
        ...LEAD_DEFAULT_INCLUDE,
        tasks: {
          orderBy: [{ dueDate: 'asc' }],
          include: {
            assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
        interactions: {
          orderBy: [{ interactedAt: 'desc' }],
          take: 100,
          include: {
            handledBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  // ---------- WRITES ----------

  async create(user: AuthenticatedUser, dto: CreateLeadDto) {
    const { tenantId, branchId } = requireWriteBranch(user);

    // Optional uniqueness guard: avoid duplicate active lead for same phone in same branch.
    const existing = await this.prisma.lead.findFirst({
      where: {
        tenantId,
        branchId,
        parentPhone: dto.parentPhone,
        NOT: { status: { in: ['LOST', 'ENROLLED'] as any } },
      },
      select: { id: true, parentName: true },
    });
    if (existing) {
      throw new BadRequestException(
        `An active lead already exists in this branch for ${dto.parentPhone} (${existing.parentName}).`,
      );
    }

    const initialNotes = dto.initialNote
      ? [{ at: new Date().toISOString(), by: user.id, text: dto.initialNote }]
      : undefined;

    const lead = await this.prisma.lead.create({
      data: {
        tenantId,
        branchId,
        parentName: dto.parentName.trim(),
        parentPhone: dto.parentPhone.trim(),
        parentEmail: dto.parentEmail?.trim().toLowerCase(),
        studentName: dto.studentName?.trim(),
        gradeInterestedIn: dto.gradeInterestedIn.trim(),
        expectedEnrollYear: dto.expectedEnrollYear,
        sourceId: dto.sourceId,
        campaignId: dto.campaignId,
        assignedToId: dto.assignedToId ?? user.id,
        referredById: dto.referredById,
        temperature: (dto.temperature ?? 'WARM') as any,
        status: 'NEW' as any,
        notes: initialNotes as any,
      },
      include: LEAD_DEFAULT_INCLUDE,
    });

    await this.audit.logCreate({
      tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Lead',
      entityId: lead.id,
      after: { branchId, status: lead.status, parentPhone: lead.parentPhone },
    });

    return lead;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateLeadDto) {
    const before = await this.assertEditable(user, id);

    const data: Prisma.LeadUpdateInput = {};
    if (dto.parentName !== undefined) data.parentName = dto.parentName.trim();
    if (dto.parentPhone !== undefined) data.parentPhone = dto.parentPhone.trim();
    if (dto.parentEmail !== undefined) data.parentEmail = dto.parentEmail?.trim().toLowerCase();
    if (dto.studentName !== undefined) data.studentName = dto.studentName?.trim();
    if (dto.gradeInterestedIn !== undefined) data.gradeInterestedIn = dto.gradeInterestedIn.trim();
    if (dto.expectedEnrollYear !== undefined) data.expectedEnrollYear = dto.expectedEnrollYear;
    if (dto.sourceId !== undefined) data.source = dto.sourceId ? { connect: { id: dto.sourceId } } : { disconnect: true };
    if (dto.campaignId !== undefined) data.campaign = dto.campaignId ? { connect: { id: dto.campaignId } } : { disconnect: true };
    if (dto.referredById !== undefined) data.referredBy = dto.referredById ? { connect: { id: dto.referredById } } : { disconnect: true };
    if (dto.temperature !== undefined) data.temperature = dto.temperature as any;

    const lead = await this.prisma.lead.update({
      where: { id },
      data,
      include: LEAD_DEFAULT_INCLUDE,
    });

    await this.audit.logUpdate({
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Lead',
      entityId: lead.id,
      before,
      after: dto as any,
    });

    return lead;
  }

  async assign(user: AuthenticatedUser, id: string, dto: AssignLeadDto) {
    const before = await this.assertEditable(user, id);

    // Verify assignee exists in same tenant.
    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assignedToId, tenantId: user.tenantId, isActive: true, deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    if (!assignee) throw new BadRequestException('Assignee not found in tenant.');

    const lead = await this.prisma.lead.update({
      where: { id },
      data: { assignedToId: dto.assignedToId },
      include: LEAD_DEFAULT_INCLUDE,
    });

    await this.audit.logUpdate({
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Lead',
      entityId: lead.id,
      before: { assignedToId: before.assignedToId },
      after: { assignedToId: lead.assignedToId },
      metadata: { action: 'ASSIGN' },
    });

    return lead;
  }

  async changeStatus(user: AuthenticatedUser, id: string, dto: ChangeLeadStatusDto) {
    if (!LEAD_STATUS_VALUES.includes(dto.status)) {
      throw new BadRequestException('Invalid lead status.');
    }
    const before = await this.assertEditable(user, id);

    const lead = await this.prisma.lead.update({
      where: { id },
      data: { status: dto.status as any },
      include: LEAD_DEFAULT_INCLUDE,
    });

    await this.audit.logUpdate({
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Lead',
      entityId: lead.id,
      before: { status: before.status },
      after: { status: lead.status, reason: dto.reason },
      metadata: { action: 'STATUS_CHANGE' },
    });

    return lead;
  }

  /**
   * Internal helper used by the conversion flow (Phase 2) to attach an
   * AdmissionApplication to a Lead and mark it APPLICATION_STARTED.
   * Kept here so the same branch-isolation rules apply.
   */
  async attachApplication(
    user: AuthenticatedUser,
    leadId: string,
    applicationId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = (tx ?? this.prisma) as PrismaService;
    const lead = await client.lead.findFirst({
      where: {
        id: leadId,
        tenantId: user.tenantId,
        ...(TENANT_WIDE_ROLES.has(user.role) ? {} : { branchId: user.branchId }),
      },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    return client.lead.update({
      where: { id: leadId },
      data: {
        applicationId,
        status: 'APPLICATION_STARTED' as any,
      },
    });
  }

  // ---------- helpers ----------

  private async assertEditable(user: AuthenticatedUser, id: string) {
    const scope = buildReadScope(user);
    const lead = await this.prisma.lead.findFirst({
      where: { ...scope.where, id },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    // Branch-bound roles cannot edit leads outside their branch (already filtered).
    // Tenant-wide roles can edit any branch.
    if (!TENANT_WIDE_ROLES.has(user.role) && lead.branchId !== user.branchId) {
      throw new ForbiddenException('Cannot edit lead outside your branch.');
    }
    return lead;
  }
}
