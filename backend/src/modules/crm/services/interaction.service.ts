import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { CreateInteractionDto } from '../dto/interaction.dto';
import { TENANT_WIDE_ROLES } from './branch-scope.util';

@Injectable()
export class InteractionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listByLead(user: AuthenticatedUser, leadId: string) {
    await this.assertLeadVisible(user, leadId);
    return this.prisma.interactionLog.findMany({
      where: { leadId, tenantId: user.tenantId },
      orderBy: [{ interactedAt: 'desc' }],
      take: 200,
      include: {
        handledBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async create(user: AuthenticatedUser, leadId: string, dto: CreateInteractionDto) {
    const lead = await this.assertLeadVisible(user, leadId);

    const entry = await this.prisma.interactionLog.create({
      data: {
        tenantId: user.tenantId,
        leadId,
        handledById: user.id,
        type: dto.type as any,
        direction: dto.direction,
        summary: dto.summary.trim(),
        mediaUrl: dto.mediaUrl,
      },
      include: {
        handledBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    // Auto-advance lead status if it's still NEW.
    if (lead.status === 'NEW') {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { status: 'CONTACTED' as any },
      });
    }

    await this.audit.logCreate({
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'InteractionLog',
      entityId: entry.id,
      after: { leadId, type: entry.type, direction: entry.direction },
    });

    return entry;
  }

  private async assertLeadVisible(user: AuthenticatedUser, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        tenantId: user.tenantId,
        ...(TENANT_WIDE_ROLES.has(user.role) ? {} : { branchId: user.branchId }),
      },
      select: { id: true, status: true, branchId: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }
}
