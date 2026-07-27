import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';
import type { TransportSettings } from '@prisma/client';
import { UpdateTransportSettingsDto } from '../dto/transport-settings.dto';

/**
 * AF-002 Transport Settings — one row per branch, created lazily on first
 * read/write with Prisma-schema defaults (transport-domain.prisma is the
 * single source of truth for default values, not this service).
 *
 * Mirrors the get-or-create-on-read shape already used for branch-scoped
 * config in this codebase (see DiscountCategoryProvisioningService for the
 * sibling "defaults live in one place, one service owns writing them"
 * pattern — that one provisions on branch-create instead, since
 * DiscountCategory is financial master data; TransportSettings is plain
 * operational config, so lazy get-or-create is safe here).
 */
@Injectable()
export class TransportSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Throws if the caller's token doesn't grant access to this branch. */
  private assertBranchAccess(
    branchId: string,
    caller: { branchId?: string; branchIds: string[]; role: string },
  ): void {
    const tenantWideRoles = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN'];
    if (tenantWideRoles.includes(caller.role)) return;
    if (caller.branchIds.includes(branchId) || caller.branchId === branchId) return;
    throw new ForbiddenException('No access to this branch');
  }

  async getOrCreate(
    tenantId: string,
    branchId: string,
    caller: { branchId?: string; branchIds: string[]; role: string },
  ): Promise<TransportSettings> {
    this.assertBranchAccess(branchId, caller);

    const existing = await this.prisma.transportSettings.findUnique({
      where: { tenantId_branchId: { tenantId, branchId } },
    });
    if (existing) return existing;

    // All values below come from the Prisma schema's @default() attributes —
    // an empty data object is deliberate, not an oversight.
    return this.prisma.transportSettings.create({
      data: { tenantId, branchId },
    });
  }

  async update(
    tenantId: string,
    branchId: string,
    dto: UpdateTransportSettingsDto,
    caller: { id: string; role: string; branchId?: string; branchIds: string[] },
  ): Promise<TransportSettings> {
    this.assertBranchAccess(branchId, caller);

    const before = await this.getOrCreate(tenantId, branchId, caller);

    const after = await this.prisma.transportSettings.update({
      where: { tenantId_branchId: { tenantId, branchId } },
      data: dto,
    });

    await this.audit.log({
      tenantId,
      actorId: caller.id,
      actorRole: caller.role,
      action: 'UPDATE',
      entityType: 'TransportSettings',
      entityId: after.id,
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
    });

    return after;
  }
}
