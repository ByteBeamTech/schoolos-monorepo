// core/feature-flags/feature-flags.service.ts — FULL REPLACEMENT
import {
  Injectable, Logger, ForbiddenException,
  NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { RedisService }  from '../../infra/cache/redis.service';
import { AuditService }  from '../compliance/audit.service';
import { ALL_FLAGS }     from './flag-definitions';
import * as crypto       from 'crypto';

export interface FlagContext {
  tenantId:  string;
  userId?:   string;
  role?:     string;
  branchId?: string;
  planTier?: string;
}

type FlagMap = Record<string, boolean>;

const TIER_ORDER: Record<string, number> = {
  STARTER: 1, GROWTH: 2, PRO: 3, ENTERPRISE: 4,
};

const CACHE_TTL   = 300;  // 5 minutes
const PLATFORM_ID = 'schoolos-platform';

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
    private readonly audit:  AuditService,
  ) {}

  // ── Public evaluation API ──────────────────────────────────────────────────

  async isEnabled(flagName: string, ctx: FlagContext): Promise<boolean> {
    const cached = await this.redis.getJson<FlagMap>(this.cacheKey(ctx.tenantId));
    if (cached && flagName in cached) return cached[flagName];
    const map = await this.evaluateAll(ctx);
    return map[flagName] ?? false;
  }

  async getAllForContext(ctx: FlagContext): Promise<FlagMap> {
    const cached = await this.redis.getJson<FlagMap>(this.cacheKey(ctx.tenantId));
    if (cached) return cached;
    return this.evaluateAll(ctx);
  }

  // ── Evaluation engine — 8-level priority chain ─────────────────────────────

  private async evaluateAll(ctx: FlagContext): Promise<FlagMap> {
    const now = new Date();

    // Load all flags and all overrides relevant to this context in 2 queries
    const [flags, overrides] = await Promise.all([
      this.prisma.featureFlag.findMany({ include: { overrides: true } }),
      this.prisma.featureFlagOverride.findMany({
        where: {
          OR: [
            { targetType: 'GLOBAL',  targetId: 'global'       },
            { targetType: 'TENANT',  targetId: ctx.tenantId   },
            ...(ctx.userId   ? [{ targetType: 'USER' as any,   targetId: ctx.userId   }] : []),
            ...(ctx.role     ? [{ targetType: 'ROLE' as any,   targetId: ctx.role     }] : []),
            ...(ctx.branchId ? [{ targetType: 'BRANCH' as any, targetId: ctx.branchId }] : []),
          ],
        },
      }),
    ]);

    // Build override lookup: flagId → { targetType → override }
    const overrideMap = new Map<string, Map<string, any>>();
    for (const o of overrides) {
      if (o.expiresAt && o.expiresAt < now) continue; // skip expired
      if (!overrideMap.has(o.flagId)) overrideMap.set(o.flagId, new Map());
      overrideMap.get(o.flagId)!.set(o.targetType, o);
    }

    const result: FlagMap = {};

    for (const flag of flags) {
      const byType = overrideMap.get(flag.id) ?? new Map();

      // Priority 1 — USER override (highest)
      if (ctx.userId && byType.has('USER')) {
        result[flag.name] = byType.get('USER').isEnabled;
        continue;
      }

      // Priority 2 — ROLE override
      if (ctx.role && byType.has('ROLE')) {
        result[flag.name] = byType.get('ROLE').isEnabled;
        continue;
      }

      // Priority 3 — BRANCH override
      if (ctx.branchId && byType.has('BRANCH')) {
        result[flag.name] = byType.get('BRANCH').isEnabled;
        continue;
      }

      // Priority 4 — TENANT override
      if (byType.has('TENANT')) {
        result[flag.name] = byType.get('TENANT').isEnabled;
        continue;
      }

      // Priority 5 — PLAN/TIER gate
      const allowedTiers = (flag.allowedTiers as string[]) ?? [];
      if (allowedTiers.length > 0 && ctx.planTier) {
        const tenantLevel  = TIER_ORDER[ctx.planTier]  ?? 0;
        const minRequired  = Math.min(...allowedTiers.map(t => TIER_ORDER[t] ?? 99));
        if (tenantLevel < minRequired) {
          result[flag.name] = false;
          continue;
        }
      }

      // Priority 6 — TIME gate
      if (flag.enabledFromAt  && flag.enabledFromAt  > now) { result[flag.name] = false; continue; }
      if (flag.enabledUntilAt && flag.enabledUntilAt < now) { result[flag.name] = false; continue; }

      // Priority 7 — PERCENTAGE ROLLOUT (consistent hash of tenantId + flagName)
      if (flag.rolloutPercentage > 0 && flag.rolloutPercentage < 100) {
        const hash    = crypto.createHash('md5').update(`${ctx.tenantId}:${flag.name}`).digest('hex');
        const bucket  = parseInt(hash.substring(0, 8), 16) % 100;
        result[flag.name] = bucket < flag.rolloutPercentage;
        continue;
      }
      if (flag.rolloutPercentage === 0) { result[flag.name] = flag.defaultValue; continue; }

      // Priority 8 — GLOBAL override
      if (byType.has('GLOBAL')) {
        result[flag.name] = byType.get('GLOBAL').isEnabled;
        continue;
      }

      // Priority 9 — Default value
      result[flag.name] = flag.defaultValue;
    }

    // Warm the cache
    await this.redis.setJson(this.cacheKey(ctx.tenantId), result, CACHE_TTL);
    return result;
  }

  // ── Override request workflow ───────────────────────────────────────────────

  async createOverrideRequest(params: {
    flagName:                    string;
    targetType:                  string;
    targetId:                    string;
    targetName?:                 string;
    isEnabled:                   boolean;
    requestReason:               string;
    activationMode:              string;
    activatesAt?:                string;
    trialDays?:                  number;
    autoRevokeIfNotUpgradedDays?: number;
    requestedBy:                 string;
    requestedByTenantId:         string;
  }) {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { name: params.flagName },
    });
    if (!flag) throw new NotFoundException(`Flag not found: ${params.flagName}`);

    // Validate activation mode fields
    if (params.activationMode === 'SCHEDULED' && !params.activatesAt) {
      throw new BadRequestException('activatesAt is required for SCHEDULED mode');
    }
    if (params.activationMode === 'TRIAL' && !params.trialDays) {
      throw new BadRequestException('trialDays is required for TRIAL mode');
    }
    if (params.activationMode === 'UPGRADE_GATED' && !params.autoRevokeIfNotUpgradedDays) {
      throw new BadRequestException('autoRevokeIfNotUpgradedDays is required for UPGRADE_GATED mode');
    }

    const request = await this.prisma.featureFlagOverrideRequest.create({
      data: {
        flagId:                      flag.id,
        targetType:                  params.targetType as any,
        targetId:                    params.targetId,
        targetName:                  params.targetName ?? null,
        isEnabled:                   params.isEnabled,
        requestedBy:                 params.requestedBy,
        requestReason:               params.requestReason,
        activationMode:              params.activationMode as any,
        activatesAt:                 params.activatesAt  ? new Date(params.activatesAt) : null,
        trialDays:                   params.trialDays    ?? null,
        autoRevokeIfNotUpgradedDays: params.autoRevokeIfNotUpgradedDays ?? null,
        status:                      'PENDING',
      },
      include: { flag: true },
    });

    await this.audit.log({
      tenantId:   params.requestedByTenantId,
      actorId:    params.requestedBy,
      action:     'CREATE' as any,
      entityType: 'FeatureFlagOverrideRequest',
      entityId:   request.id,
      after: {
        flagName:      params.flagName,
        targetType:    params.targetType,
        targetId:      params.targetId,
        activationMode: params.activationMode,
        status:        'PENDING',
      },
    });

    this.logger.log(
      `Override request created: ${params.flagName} → ${params.targetId} by ${params.requestedBy}`
    );

    return request;
  }

  async approveRequest(params: {
    requestId:    string;
    approvedBy:   string;
    approverNote?: string;
    tenantId:     string;
  }) {
    const request = await this.prisma.featureFlagOverrideRequest.findUnique({
      where: { id: params.requestId },
      include: { flag: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is ${request.status} — cannot approve`);
    }

    // Self-approval check — only SAAS_OWNER can approve their own request
    // Account managers cannot approve requests they raised
    // (role check happens in controller — service trusts the caller)

    // Calculate expiry based on activation mode
    let activatesAt  = new Date();
    let expiresAt: Date | null = null;

    if (request.activationMode === 'SCHEDULED' && request.activatesAt) {
      activatesAt = request.activatesAt;
    }
    if (request.activationMode === 'TRIAL' && request.trialDays) {
      expiresAt = new Date(activatesAt.getTime() + request.trialDays * 86400000);
    }

    // Create the actual override in a transaction
    const [updatedRequest, override] = await this.prisma.$transaction(async (tx) => {
      const override = await tx.featureFlagOverride.upsert({
        where: {
          flagId_targetType_targetId: {
            flagId:     request.flagId,
            targetType: request.targetType,
            targetId:   request.targetId,
          },
        },
        update: {
          isEnabled: request.isEnabled,
          expiresAt,
          reason:    `Approved override — request ${request.id}`,
          createdBy: params.approvedBy,
        },
        create: {
          flagId:     request.flagId,
          targetType: request.targetType,
          targetId:   request.targetId,
          isEnabled:  request.isEnabled,
          expiresAt,
          reason:     `Approved override — request ${request.id}`,
          createdBy:  params.approvedBy,
          requestId:  request.id,
        },
      });

      const updated = await tx.featureFlagOverrideRequest.update({
        where: { id: request.id },
        data: {
          status:       'APPROVED',
          approvedBy:   params.approvedBy,
          approvedAt:   new Date(),
          approverNote: params.approverNote ?? null,
        },
      });

      return [updated, override];
    });

    // Invalidate cache for affected target
    await this.invalidateCache(request.targetType, request.targetId);

    await this.audit.log({
      tenantId:   params.tenantId,
      actorId:    params.approvedBy,
      action:     'UPDATE' as any,
      entityType: 'FeatureFlagOverrideRequest',
      entityId:   request.id,
      after: { status: 'APPROVED', flagName: request.flag.name, targetId: request.targetId },
    });

    this.logger.log(
      `Override APPROVED: ${request.flag.name} → ${request.targetId} by ${params.approvedBy}`
    );

    return { request: updatedRequest, override };
  }

  async rejectRequest(params: {
    requestId:       string;
    rejectedBy:      string;
    rejectionReason: string;
    tenantId:        string;
  }) {
    const request = await this.prisma.featureFlagOverrideRequest.findUnique({
      where: { id: params.requestId },
      include: { flag: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is ${request.status} — cannot reject`);
    }

    const updated = await this.prisma.featureFlagOverrideRequest.update({
      where: { id: params.requestId },
      data: {
        status:          'REJECTED',
        rejectedBy:      params.rejectedBy,
        rejectedAt:      new Date(),
        rejectionReason: params.rejectionReason,
      },
    });

    await this.audit.log({
      tenantId:   params.tenantId,
      actorId:    params.rejectedBy,
      action:     'UPDATE' as any,
      entityType: 'FeatureFlagOverrideRequest',
      entityId:   request.id,
      after: { status: 'REJECTED', reason: params.rejectionReason },
    });

    return updated;
  }

  async cancelRequest(params: {
    requestId:   string;
    cancelledBy: string;
    tenantId:    string;
  }) {
    const request = await this.prisma.featureFlagOverrideRequest.findUnique({
      where: { id: params.requestId },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (!['PENDING'].includes(request.status)) {
      throw new BadRequestException('Only PENDING requests can be cancelled');
    }
    if (request.requestedBy !== params.cancelledBy) {
      throw new ForbiddenException('Only the requester can cancel a request');
    }

    return this.prisma.featureFlagOverrideRequest.update({
      where: { id: params.requestId },
      data: { status: 'CANCELLED', cancelledBy: params.cancelledBy, cancelledAt: new Date() },
    });
  }

  async revokeOverride(params: {
    requestId:    string;
    revokedBy:    string;
    revokeReason: string;
    tenantId:     string;
  }) {
    const request = await this.prisma.featureFlagOverrideRequest.findUnique({
      where:   { id: params.requestId },
      include: { flag: true, createdOverride: true },
    });
    if (!request) throw new NotFoundException('Request not found');

    await this.prisma.$transaction(async (tx) => {
      // Delete the actual override
      if (request.createdOverride) {
        await tx.featureFlagOverride.delete({ where: { id: request.createdOverride.id } });
      }
      await tx.featureFlagOverrideRequest.update({
        where: { id: params.requestId },
        data: { status: 'REVOKED', revokedBy: params.revokedBy, revokedAt: new Date(), revokeReason: params.revokeReason },
      });
    });

    await this.invalidateCache(request.targetType, request.targetId);

    await this.audit.log({
      tenantId:   params.tenantId,
      actorId:    params.revokedBy,
      action:     'UPDATE' as any,
      entityType: 'FeatureFlagOverrideRequest',
      entityId:   request.id,
      after: { status: 'REVOKED', reason: params.revokeReason, flagName: request.flag.name },
    });
  }

  // ── Listing / admin views ──────────────────────────────────────────────────

  async getPendingRequests() {
    return this.prisma.featureFlagOverrideRequest.findMany({
      where:   { status: 'PENDING' },
      include: { flag: true },
      orderBy: { requestedAt: 'asc' },
    });
  }

  async getAllRequests(filters: {
    status?:     string;
    requestedBy?: string;
    flagName?:   string;
    targetId?:   string;
    page?:       number;
    limit?:      number;
  }) {
    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 20;
    const where: any = {};
    if (filters.status)      where.status      = filters.status;
    if (filters.requestedBy) where.requestedBy = filters.requestedBy;
    if (filters.targetId)    where.targetId    = filters.targetId;
    if (filters.flagName)    where.flag        = { name: filters.flagName };

    const [data, total] = await Promise.all([
      this.prisma.featureFlagOverrideRequest.findMany({
        where,
        include: { flag: { select: { name: true, label: true, category: true } } },
        orderBy: { requestedAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      this.prisma.featureFlagOverrideRequest.count({ where }),
    ]);

    return { data, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } };
  }

  async getAllFlags() {
    return this.prisma.featureFlag.findMany({
      include: {
        overrides: true,
        _count: { select: { overrideRequests: true } },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async getTenantFlags(tenantId: string, planTier: string) {
    const ctx: FlagContext = { tenantId, planTier };
    const resolved = await this.getAllForContext(ctx);

    // Return only flags the tenant can control themselves
    const controllable = ALL_FLAGS.filter(f => f.tenantControllable);
    return controllable.map(def => ({
      name:        def.name,
      label:       def.label,
      description: def.description,
      category:    def.category,
      isEnabled:   resolved[def.name] ?? false,
      canToggle:   true,
    }));
  }

  // ── Scheduled job — run by cron engine every minute ────────────────────────

  async processSchedules() {
    const now = new Date();

    // 1. Execute pending schedules that are due
    const due = await this.prisma.featureFlagSchedule.findMany({
      where:   { status: 'PENDING', scheduledAt: { lte: now } },
      include: { flag: true },
    });

    for (const schedule of due) {
      try {
        await this.prisma.featureFlagOverride.upsert({
          where: {
            flagId_targetType_targetId: {
              flagId: schedule.flagId, targetType: schedule.targetType, targetId: schedule.targetId,
            },
          },
          update: { isEnabled: schedule.action === 'ENABLE' },
          create: {
            flagId: schedule.flagId, targetType: schedule.targetType, targetId: schedule.targetId,
            isEnabled: schedule.action === 'ENABLE', createdBy: 'system:scheduler',
          },
        });

        await this.prisma.featureFlagSchedule.update({
          where: { id: schedule.id },
          data:  { status: 'EXECUTED', executedAt: now },
        });

        await this.invalidateCache(schedule.targetType, schedule.targetId);
        this.logger.log(`Schedule executed: ${schedule.flag.name} ${schedule.action} → ${schedule.targetId}`);
      } catch (err) {
        await this.prisma.featureFlagSchedule.update({
          where: { id: schedule.id },
          data:  { status: 'FAILED' },
        });
        this.logger.error(`Schedule failed: ${schedule.id}`, err);
      }
    }

    // 2. Auto-expire overrides past their expiresAt
    const expired = await this.prisma.featureFlagOverride.findMany({
      where:   { expiresAt: { lte: now } },
      include: { flag: true, request: true },
    });

    for (const override of expired) {
      await this.prisma.featureFlagOverride.delete({ where: { id: override.id } });

      if (override.requestId) {
        await this.prisma.featureFlagOverrideRequest.update({
          where: { id: override.requestId },
          data:  { status: 'EXPIRED', revokedAt: now, revokeReason: 'Trial window expired' },
        });
      }

      await this.invalidateCache(override.targetType, override.targetId);
      this.logger.log(`Override expired: ${override.flag.name} → ${override.targetId}`);
    }

    // 3. Auto-revoke UPGRADE_GATED overrides where school hasn't upgraded
    const upgradeGated = await this.prisma.featureFlagOverrideRequest.findMany({
      where: {
        status:                      'APPROVED',
        activationMode:              'UPGRADE_GATED',
        autoRevokeIfNotUpgradedDays: { not: null },
        upgradedDetectedAt:          null,
      },
      include: { flag: true, createdOverride: true },
    });

    for (const req of upgradeGated) {
      const deadline = new Date(
        req.approvedAt!.getTime() + (req.autoRevokeIfNotUpgradedDays! * 86400000)
      );

      if (now >= deadline) {
        // Check if tenant has upgraded
        const sub = await this.prisma.tenantSubscription.findFirst({
          where: { tenantId: req.targetId },
          include: { plan: true },
        });

        const flagDef  = ALL_FLAGS.find(f => f.name === req.flag.name);
        const upgraded = sub && flagDef &&
          (flagDef.allowedTiers.length === 0 ||
           flagDef.allowedTiers.includes(sub.plan.tier));

        if (upgraded) {
          // School upgraded — mark and keep override
          await this.prisma.featureFlagOverrideRequest.update({
            where: { id: req.id },
            data:  { upgradedDetectedAt: now },
          });
          this.logger.log(`Upgrade detected — override kept: ${req.flag.name} → ${req.targetId}`);
        } else {
          // School didn't upgrade — revoke
          if (req.createdOverride) {
            await this.prisma.featureFlagOverride.delete({ where: { id: req.createdOverride.id } });
          }
          await this.prisma.featureFlagOverrideRequest.update({
            where: { id: req.id },
            data: { status: 'REVOKED', revokedAt: now, revokeReason: `Auto-revoked: school did not upgrade within ${req.autoRevokeIfNotUpgradedDays} days` },
          });
          await this.invalidateCache(req.targetType, req.targetId);
          this.logger.warn(`Auto-revoked upgrade-gated override: ${req.flag.name} → ${req.targetId}`);
        }
      }
    }
  }

  // ── Cache helpers ──────────────────────────────────────────────────────────

  private cacheKey(tenantId: string): string {
    return `flags:resolved:${tenantId}`;
  }

  private async invalidateCache(targetType: string, targetId: string): Promise<void> {
    if (targetType === 'GLOBAL') {
      // Global override change — must invalidate all tenants
      // In production use Redis SCAN; for now pattern delete
      this.logger.warn('Global flag change — tenant caches will expire within TTL');
      return;
    }
    if (targetType === 'TENANT') {
      await this.redis.del(this.cacheKey(targetId));
      return;
    }
    // For USER/ROLE/BRANCH overrides, we don't know which tenants are affected
    // so we just let the TTL expire naturally (5 min max staleness)
    this.logger.debug(`Cache invalidation deferred for ${targetType}:${targetId} — TTL will expire`);
  }
}

