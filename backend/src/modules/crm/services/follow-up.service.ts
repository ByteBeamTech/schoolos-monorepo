import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import {
  CreateFollowUpDto,
  ListFollowUpsQueryDto,
  UpdateFollowUpDto,
} from '../dto/follow-up.dto';
import { buildReadScope, TENANT_WIDE_ROLES } from './branch-scope.util';

@Injectable()
export class FollowUpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------- READS ----------

  async listByLead(user: AuthenticatedUser, leadId: string) {
    await this.assertLeadVisible(user, leadId);
    return this.prisma.followUpTask.findMany({
      where: { leadId, tenantId: user.tenantId },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      include: {
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async listMine(user: AuthenticatedUser, query: ListFollowUpsQueryDto) {
    const scope = buildReadScope(user);
    const where: Prisma.FollowUpTaskWhereInput = { tenantId: user.tenantId };

    // Branch isolation: filter follow-ups by the branch their lead belongs to.
    if (!scope.tenantWide) {
      where.lead = { branchId: user.branchId };
    } else if (scope.branchId) {
      where.lead = { branchId: scope.branchId };
    }

    if (query.status) where.status = query.status as any;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.leadId) where.leadId = query.leadId;

    if (query.window) {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      if (query.window === 'today') {
        where.dueDate = { gte: startOfDay, lte: endOfDay };
      } else if (query.window === 'overdue') {
        where.dueDate = { lt: startOfDay };
        where.status = { in: ['PENDING', 'IN_PROGRESS'] as any };
      } else if (query.window === 'upcoming') {
        where.dueDate = { gt: endOfDay };
        where.status = { in: ['PENDING', 'IN_PROGRESS'] as any };
      }
    }

    return this.prisma.followUpTask.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }],
      take: 200,
      include: {
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
        lead: {
          select: {
            id: true,
            parentName: true,
            parentPhone: true,
            studentName: true,
            status: true,
            branchId: true,
          },
        },
      },
    });
  }

  // ---------- WRITES ----------

  async create(user: AuthenticatedUser, leadId: string, dto: CreateFollowUpDto) {
    const lead = await this.assertLeadVisible(user, leadId);

    const due = new Date(dto.dueDate);
    if (Number.isNaN(due.getTime())) {
      throw new BadRequestException('Invalid dueDate');
    }

    const task = await this.prisma.followUpTask.create({
      data: {
        tenantId: user.tenantId,
        leadId,
        assignedToId: dto.assignedToId ?? lead.assignedToId ?? user.id,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        dueDate: due,
        status: 'PENDING' as any,
      },
      include: {
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    // Auto-advance lead status if it's still NEW or CONTACTED.
    if (['NEW', 'CONTACTED'].includes(lead.status as any)) {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { status: 'FOLLOW_UP' as any },
      });
    }

    await this.audit.logCreate({
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'FollowUpTask',
      entityId: task.id,
      after: { leadId, dueDate: task.dueDate, assignedToId: task.assignedToId },
    });

    return task;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateFollowUpDto) {
    const before = await this.assertTaskEditable(user, id);

    const data: Prisma.FollowUpTaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim();
    if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate);
    if (dto.assignedToId !== undefined) data.assignedTo = { connect: { id: dto.assignedToId } };
    if (dto.status !== undefined) {
      data.status = dto.status as any;
      if (dto.status === 'COMPLETED') data.completedAt = new Date();
    }

    const task = await this.prisma.followUpTask.update({
      where: { id },
      data,
      include: {
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.logUpdate({
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'FollowUpTask',
      entityId: task.id,
      before,
      after: dto as any,
    });

    return task;
  }

  // ---------- helpers ----------

  private async assertLeadVisible(user: AuthenticatedUser, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        tenantId: user.tenantId,
        ...(TENANT_WIDE_ROLES.has(user.role) ? {} : { branchId: user.branchId }),
      },
      select: {
        id: true,
        branchId: true,
        assignedToId: true,
        status: true,
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  private async assertTaskEditable(user: AuthenticatedUser, taskId: string) {
    const task = await this.prisma.followUpTask.findFirst({
      where: { id: taskId, tenantId: user.tenantId },
      include: { lead: { select: { branchId: true } } },
    });
    if (!task) throw new NotFoundException('Follow-up not found');
    if (
      !TENANT_WIDE_ROLES.has(user.role) &&
      task.lead?.branchId !== user.branchId
    ) {
      throw new NotFoundException('Follow-up not found');
    }
    return task;
  }
}
