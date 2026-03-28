// core/feature-flags/feature-flags.service.ts — FULL REPLACEMENT (v2)
import {
  Injectable, Logger, ForbiddenException,
  NotFoundException, BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 }  from '@nestjs/event-emitter';
import { InjectQueue }    from '@nestjs/bull';
import { Queue }          from 'bull';
import { PrismaService }  from '../../infra/database/prisma.service';
import { RedisService }   from '../../infra/cache/redis.service';
import { AuditService }   from '../compliance/audit.service';
import { EVENTS }         from '../events/events.constants';
import { ALL_FLAGS }      from './flag-definitions';
import { QUEUE_NAMES }    from '../../infra/queue/queue.module';
import * as crypto        from 'crypto';

export interface FlagContext {
  tenantId:  string;
  userId?:   string;
  role?:     string;
  branchId?: string;
  planTier?: string;
  trackUsage?: boolean; // set false in internal/cron calls to skip usage tracking
}

type FlagMap = Record<string, boolean>;

// Extended map that also carries meta for paywall responses
export type FlagMapWithMeta = Record<string, {
  enabled:     boolean;
  reason:      string; // 'override' | 'tier' | 'time' | 'rollout' | 'default'
  requiredTier?: string; // set when disabled due to tier gate
  inGrace?:    boolean;
}>;

const TIER_ORDER: Record<string, number> = {
  STARTER: 1, GROWTH: 2, PRO: 3, ENTERPRISE: 4,
};

const TIER_NEXT: Record<string, string> = {
  STARTER: 'GROWTH', GROWTH: 'PRO', PRO: 'ENTERPRISE', ENTERPRISE: 'ENTERPRISE',
};

const CACHE_TTL       = 300;   // 5 min
const NUDGE_COOLDOWN  = 7;     // days between upgrade nudges per flag per tenant
const SLA_HOURS       = 24;    // hours before approval SLA breach

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly redis:    RedisService,
    private readonly audit:    AuditService,
    private readonly emitter:  EventEmitter2,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notifQueue: Queue,
  ) {}

  // ── Public evaluation API ──────────────────────────────────────────────────

  async isEnabled(flagName: string, ctx: FlagContext): Promise<boolean> {
    const map = await this.getResolvedMap(ctx);
    const result = map[flagName] ?? false;
    if (ctx.trackUsage !== false) {
      this.trackUsageAsync(flagName, ctx.tenantId, result);
    }
    return result;
  }

  async getAllForContext(ctx: FlagContext): Promise<FlagMap> {
    const map = await this.getResolvedMap(ctx);
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v]));
  }

  async getAllWithMeta(ctx: FlagContext): Promise<FlagMapWithMeta> {
    return this.evaluateAll(ctx);
  }

  // ── Versioned cache ────────────────────────────────────────────────────────

  private async getVersion(tenantId: string): Promise<number> {
    const row = await this.prisma.featureFlagCacheVersion.findUnique({
      where: { tenantId },
    });
    return row?.version ?? 1;
  }

  private async bumpVersion(tenantId: string): Promise<number> {
    const row = await this.prisma.featureFlagCacheVersion.upsert({
      where:  { tenantId },
      update: { version: { increment: 1 } },
      create: { tenantId, version: 2 },
    });
    return row.version;
  }

  private versionedCacheKey(tenantId: string, version: number): string {
    return `flags:${tenantId}:v${version}`;
  }

  private async getResolvedMap(ctx: FlagContext): Promise<FlagMap> {
    const version   = await this.getVersion(ctx.tenantId);
    const cacheKey  = this.versionedCacheKey(ctx.tenantId, version);
    const cached    = await this.redis.getJson<FlagMap>(cacheKey);
    if (cached) return cached;

    // Cache miss — lazy rebuild
    const meta = await this.evaluateAll(ctx);
    const flat  = Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, v.enabled]));
    await this.redis.setJson(cacheKey, flat, CACHE_TTL);
    return flat;
  }

  // ── Core evaluation engine — 8-level priority chain ───────────────────────

  private async evaluateAll(ctx: FlagContext): Promise<FlagMapWithMeta> {
    const now = new Date();

    const [flags, overrides] = await Promise.all([
      this.prisma.featureFlag.findMany({ include: { overrides: true } }),
      this.prisma.featureFlagOverride.findMany({
        where: {
          OR: [
            { targetType: 'GLOBAL',  targetId: 'global'       },
            { targetType: 'TENANT',  targetId: ctx.tenantId   },
            ...(ctx.userId   ? [{ targetType: 'USER',   targetId: ctx.userId   }] : []),
            ...(ctx.role     ? [{ targetType: 'ROLE',   targetId: ctx.role     }] : []),
            ...(ctx.branchId ? [{ targetType: 'BRANCH', targetId: ctx.branchId }] : []),
          ],
        },
        include: { request: { select: { inGracePeriod: true, graceEndsAt: true } } },
      }),
    ]);

    const overrideMap = new Map<string, Map<string, any>>();
    for (const o of overrides) {
      if (o.expiresAt && o.expiresAt < now) continue;
      if (!overrideMap.has(o.flagId)) overrideMap.set(o.flagId, new Map());
      overrideMap.get(o.flagId)!.set(o.targetType, o);
    }

    const result: FlagMapWithMeta = {};

    for (const flag of flags) {
      const byType = overrideMap.get(flag.id) ?? new Map();

      // P1 — USER
      if (ctx.userId && byType.has('USER')) {
        result[flag.name] = { enabled: byType.get('USER').isEnabled, reason: 'override' };
        continue;
      }
      // P2 — ROLE
      if (ctx.role && byType.has('ROLE')) {
        result[flag.name] = { enabled: byType.get('ROLE').isEnabled, reason: 'override' };
        continue;
      }
      // P3 — BRANCH
      if (ctx.branchId && byType.has('BRANCH')) {
        result[flag.name] = { enabled: byType.get('BRANCH').isEnabled, reason: 'override' };
        continue;
      }
      // P4 — TENANT override (check grace period)
      if (byType.has('TENANT')) {
        const ov        = byType.get('TENANT');
        const inGrace   = ov.request?.inGracePeriod && ov.request?.graceEndsAt > now;
        result[flag.name] = {
          enabled:  ov.isEnabled,
          reason:   'override',
          inGrace:  inGrace ?? false,
        };
        continue;
      }
      // P5 — PLAN/TIER gate
      const allowedTiers = (flag.allowedTiers as string[]) ?? [];
      if (allowedTiers.length > 0 && ctx.planTier) {
        const tenantLevel = TIER_ORDER[ctx.planTier]  ?? 0;
        const minRequired = Math.min(...allowedTiers.map(t => TIER_ORDER[t] ?? 99));
        if (tenantLevel < minRequired) {
          const requiredTier = allowedTiers[0];
          result[flag.name] = {
            enabled:      false,
            reason:       'tier',
            requiredTier,
          };
          continue;
        }
      }
      // P6 — TIME gate
      if (flag.enabledFromAt  && flag.enabledFromAt  > now) {
        result[flag.name] = { enabled: false, reason: 'time' }; continue;
      }
      if (flag.enabledUntilAt && flag.enabledUntilAt < now) {
        result[flag.name] = { enabled: false, reason: 'time' }; continue;
      }
      // P7 — ROLLOUT %
      if (flag.rolloutPercentage > 0 && flag.rolloutPercentage < 100) {
        const hash   = crypto.createHash('md5').update(`${ctx.tenantId}:${flag.name}`).digest('hex');
        const bucket = parseInt(hash.substring(0, 8), 16) % 100;
        result[flag.name] = { enabled: bucket < flag.rolloutPercentage, reason: 'rollout' };
        continue;
      }
      if (flag.rolloutPercentage === 0) {
        result[flag.name] = { enabled: flag.defaultValue, reason: 'default' }; continue;
      }
      // P8 — GLOBAL override
      if (byType.has('GLOBAL')) {
        result[flag.name] = { enabled: byType.get('GLOBAL').isEnabled, reason: 'override' };
        continue;
      }
      // P9 — Default
      result[flag.name] = { enabled: flag.defaultValue, reason: 'default' };
    }

    return result;
  }

  // ── Usage tracking (fire-and-forget, never blocks the hot path) ────────────

  private trackUsageAsync(flagName: string, tenantId: string, hit: boolean): void {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    setImmediate(async () => {
      try {
        await this.prisma.featureFlagUsage.upsert({
          where:  { flagName_tenantId_date: { flagName, tenantId, date: today } },
          update: {
            callCount: { increment: 1 },
            hitCount:  hit ? { increment: 1 } : undefined,
            missCount: !hit ? { increment: 1 } : undefined,
          },
          create: {
            flagName, tenantId, date: today,
            callCount: 1,
            hitCount:  hit ? 1 : 0,
            missCount: !hit ? 1 : 0,
          },
        });

        // Check if we should send an upgrade nudge
        // Nudge when: flag is OFF due to tier gate AND called 10+ times today
        if (!hit) {
          await this.maybeNudgeUpgrade(flagName, tenantId, today);
        }
      } catch (err) {
        this.logger.debug(`Usage tracking failed for ${flagName}:${tenantId} — ${err}`);
      }
    });
  }

  private async maybeNudgeUpgrade(
    flagName: string, tenantId: string, today: Date,
  ): Promise<void> {
    const usage = await this.prisma.featureFlagUsage.findUnique({
      where: { flagName_tenantId_date: { flagName, tenantId, date: today } },
    });
    if (!usage || usage.callCount < 10) return; // not enough signal yet

    // Respect cooldown — don't nudge more than once per N days
    if (usage.lastNudgeAt) {
      const daysSinceNudge = (Date.now() - usage.lastNudgeAt.getTime()) / 86400000;
      if (daysSinceNudge < NUDGE_COOLDOWN) return;
    }

    const flagDef = ALL_FLAGS.find(f => f.name === flagName);
    if (!flagDef || flagDef.allowedTiers.length === 0) return;

    // Get tenant's current plan
    const sub = await this.prisma.tenantSubscription.findFirst({
      where:   { tenantId },
      include: { plan: true },
    });
    if (!sub) return;

    const currentTier  = sub.plan.tier;
    const requiredTier = flagDef.allowedTiers[0];
    if (TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier]) return; // already on required tier

    // Mark nudge sent
    await this.prisma.featureFlagUsage.update({
      where:  { flagName_tenantId_date: { flagName, tenantId, date: today } },
      data:   { lastNudgeAt: new Date() },
    });

    // Queue upgrade nudge notification to tenant admin
    await this.notifQueue.add('upgrade-nudge', {
      tenantId,
      flagName,
      flagLabel:    flagDef.label,
      currentTier,
      requiredTier,
      callCount:    usage.callCount,
    }, { attempts: 2, delay: 5000 });

    // Emit event for audit + observability
    this.emitter.emit(EVENTS.FLAG_UPGRADE_NUDGE, {
      tenantId, flagName, flagLabel: flagDef.label,
      currentTier, requiredTier, callCount: usage.callCount,
    });

    this.logger.log(`Upgrade nudge queued: ${flagName} → ${tenantId} (${currentTier} → ${requiredTier})`);
  }

  // ── Cache invalidation (versioned) ────────────────────────────────────────

  private async invalidateCache(targetType: string, targetId: string): Promise<void> {
    if (targetType === 'TENANT') {
      await this.bumpVersion(targetId);
      return;
    }
    if (targetType === 'GLOBAL') {
      // Bump all tenants — expensive but correct. In prod use Redis SCAN.
      // For now bump a special global version that all reads check.
      const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
      await Promise.all(tenants.map(t => this.bumpVersion(t.id)));
      return;
    }
    // USER/ROLE/BRANCH — we don't know affected tenants, let TTL expire
    this.logger.debug(`Cache deferred for ${targetType}:${targetId}`);
  }

  // ── Paywall response helper ────────────────────────────────────────────────

  async getPaywallInfo(flagName: string, ctx: FlagContext): Promise<{
    blocked:      boolean;
    reason:       string;
    requiredTier?: string;
    upgradeUrl:   string;
    message:      string;
  } | null> {
    const meta = await this.evaluateAll(ctx);
    const flag  = meta[flagName];
    if (!flag || flag.enabled) return null;

    const flagDef = ALL_FLAGS.find(f => f.name === flagName);

    return {
      blocked:      true,
      reason:       flag.reason,
      requiredTier: flag.requiredTier,
      upgradeUrl:   `/settings/billing/upgrade?feature=${flagName}`,
      message:      flag.reason === 'tier'
        ? `This feature requires the ${flag.requiredTier} plan or above. Upgrade to unlock ${flagDef?.label ?? flagName}.`
        : `This feature is not currently available for your account.`,
    };
  }

  // ── Approval request workflow ───────────────────────────────────────────────

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
    gracePeriodDays?:            number;
    autoRevokeIfNotUpgradedDays?: number;
    requestedBy:                 string;
    requestedByTenantId:         string;
  }) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { name: params.flagName } });
    if (!flag) throw new NotFoundException(`Flag not found: ${params.flagName}`);

    if (params.activationMode === 'SCHEDULED' && !params.activatesAt) {
      throw new BadRequestException('activatesAt required for SCHEDULED mode');
    }
    if (params.activationMode === 'TRIAL' && !params.trialDays) {
      throw new BadRequestException('trialDays required for TRIAL mode');
    }
    if (params.activationMode === 'UPGRADE_GATED' && !params.autoRevokeIfNotUpgradedDays) {
      throw new BadRequestException('autoRevokeIfNotUpgradedDays required for UPGRADE_GATED mode');
    }

    // Capture plan snapshot at request time
    const sub = await this.prisma.tenantSubscription.findFirst({
      where:   { tenantId: params.targetId },
      include: { plan: true },
    });
    const planSnapshot = sub
      ? { tier: sub.plan.tier, model: sub.model, planName: sub.plan.name, capturedAt: new Date() }
      : null;

    // Calculate SLA deadline
    const slaDeadlineAt = new Date(Date.now() + SLA_HOURS * 3600000);

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
        activatesAt:                 params.activatesAt ? new Date(params.activatesAt) : null,
        trialDays:                   params.trialDays    ?? null,
        gracePeriodDays:             params.gracePeriodDays ?? null,
        autoRevokeIfNotUpgradedDays: params.autoRevokeIfNotUpgradedDays ?? null,
        planSnapshotAtApproval:      planSnapshot as any,
        slaDeadlineAt,
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
        flagName: params.flagName, targetType: params.targetType,
        targetId: params.targetId, activationMode: params.activationMode, status: 'PENDING',
      },
    });

    this.emitter.emit(EVENTS.FLAG_OVERRIDE_REQUESTED, {
      requestId:      request.id,
      flagName:       flag.name,
      flagLabel:      flag.label,
      targetType:     params.targetType,
      targetId:       params.targetId,
      targetName:     params.targetName ?? params.targetId,
      requestedBy:    params.requestedBy,
      requestReason:  params.requestReason,
      activationMode: params.activationMode,
    });

    return request;
  }

  async approveRequest(params: {
    requestId:    string;
    approvedBy:   string;
    approverRole: string;
    approverNote?: string;
    tenantId:     string;
  }) {
    const request = await this.prisma.featureFlagOverrideRequest.findUnique({
      where: { id: params.requestId }, include: { flag: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is ${request.status} — cannot approve`);
    }

    // Account managers cannot self-approve
    if (params.approverRole === 'ACCOUNT_MANAGER' && request.requestedBy === params.approvedBy) {
      throw new ForbiddenException('Account managers cannot approve their own requests. Escalate to SaaS Owner.');
    }

    const now = new Date();
    let activatesAt = now;
    let expiresAt: Date | null = null;

    if (request.activationMode === 'SCHEDULED' && request.activatesAt) {
      activatesAt = request.activatesAt;
    }
    if (request.activationMode === 'TRIAL' && request.trialDays) {
      expiresAt = new Date(activatesAt.getTime() + request.trialDays * 86400000);
    }

    // Capture current plan snapshot
    const sub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId: request.targetId }, include: { plan: true },
    });
    const planSnapshot = sub
      ? { tier: sub.plan.tier, model: sub.model, planName: sub.plan.name, capturedAt: now }
      : null;

    const [updatedRequest] = await this.prisma.$transaction(async (tx) => {
      const override = await tx.featureFlagOverride.upsert({
        where: {
          flagId_targetType_targetId: {
            flagId: request.flagId, targetType: request.targetType, targetId: request.targetId,
          },
        },
        update: { isEnabled: request.isEnabled, expiresAt, reason: `Approved: ${request.id}`, createdBy: params.approvedBy },
        create: {
          flagId: request.flagId, targetType: request.targetType, targetId: request.targetId,
          isEnabled: request.isEnabled, expiresAt,
          reason: `Approved: ${request.id}`, createdBy: params.approvedBy, requestId: request.id,
        },
      });

      const updated = await tx.featureFlagOverrideRequest.update({
        where: { id: request.id },
        data: {
          status:               'APPROVED',
          approvedBy:           params.approvedBy,
          approvedAt:           now,
          approverNote:         params.approverNote ?? null,
          planSnapshotAtApproval: planSnapshot as any,
        },
      });

      return [updated, override];
    });

    await this.invalidateCache(request.targetType, request.targetId);

    await this.audit.log({
      tenantId:   params.tenantId,
      actorId:    params.approvedBy,
      action:     'UPDATE' as any,
      entityType: 'FeatureFlagOverrideRequest',
      entityId:   request.id,
      after: { status: 'APPROVED', flagName: request.flag.name, targetId: request.targetId, planSnapshot },
    });

    this.emitter.emit(EVENTS.FLAG_OVERRIDE_APPROVED, {
      requestId:   request.id,
      flagName:    request.flag.name,
      flagLabel:   request.flag.label,
      targetId:    request.targetId,
      targetName:  request.targetName ?? request.targetId,
      approvedBy:  params.approvedBy,
      approverNote: params.approverNote,
      expiresAt,
    });

    // Queue school notification
    await this.notifQueue.add('flag-approved-notify', {
      tenantId:  request.targetId,
      flagName:  request.flag.name,
      flagLabel: request.flag.label,
      expiresAt: expiresAt?.toISOString(),
    }, { attempts: 2 });

    return updatedRequest;
  }

  async rejectRequest(params: {
    requestId: string; rejectedBy: string; rejectionReason: string; tenantId: string;
  }) {
    const request = await this.prisma.featureFlagOverrideRequest.findUnique({
      where: { id: params.requestId }, include: { flag: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is ${request.status} — cannot reject`);
    }

    const updated = await this.prisma.featureFlagOverrideRequest.update({
      where: { id: params.requestId },
      data: { status: 'REJECTED', rejectedBy: params.rejectedBy, rejectedAt: new Date(), rejectionReason: params.rejectionReason },
    });

    this.emitter.emit(EVENTS.FLAG_OVERRIDE_REJECTED, {
      requestId: request.id, flagName: request.flag.name,
      targetId: request.targetId, rejectedBy: params.rejectedBy, rejectionReason: params.rejectionReason,
    });

    await this.audit.log({
      tenantId: params.tenantId, actorId: params.rejectedBy,
      action: 'UPDATE' as any, entityType: 'FeatureFlagOverrideRequest', entityId: request.id,
      after: { status: 'REJECTED', reason: params.rejectionReason },
    });

    return updated;
  }

  async cancelRequest(params: { requestId: string; cancelledBy: string; tenantId: string }) {
    const request = await this.prisma.featureFlagOverrideRequest.findUnique({
      where: { id: params.requestId },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Only PENDING requests can be cancelled');
    if (request.requestedBy !== params.cancelledBy) {
      throw new ForbiddenException('Only the requester can cancel a request');
    }
    return this.prisma.featureFlagOverrideRequest.update({
      where: { id: params.requestId },
      data:  { status: 'CANCELLED', cancelledBy: params.cancelledBy, cancelledAt: new Date() },
    });
  }

  async revokeOverride(params: {
    requestId: string; revokedBy: string; revokeReason: string; tenantId: string;
    startGracePeriod?: boolean;
  }) {
    const request = await this.prisma.featureFlagOverrideRequest.findUnique({
      where: { id: params.requestId }, include: { flag: true, createdOverride: true },
    });
    if (!request) throw new NotFoundException('Request not found');

    if (params.startGracePeriod && (request as any).gracePeriodDays) {
      // Start grace period instead of immediate revoke
      const graceEndsAt = new Date(Date.now() + (request as any).gracePeriodDays * 86400000);
      await this.prisma.featureFlagOverrideRequest.update({
        where: { id: params.requestId },
        data:  { inGracePeriod: true, graceEndsAt } as any,
      });

      this.emitter.emit(EVENTS.FLAG_GRACE_PERIOD_STARTED, {
        requestId: request.id, flagName: request.flag.name,
        targetId: request.targetId, graceEndsAt,
      });

      await this.notifQueue.add('flag-grace-notify', {
        tenantId:   request.targetId,
        flagName:   request.flag.name,
        flagLabel:  request.flag.label,
        graceEndsAt: graceEndsAt.toISOString(),
      }, { attempts: 2 });

      return { status: 'grace_period_started', graceEndsAt };
    }

    // Immediate revoke
    await this.prisma.$transaction(async (tx) => {
      if (request.createdOverride) {
        await tx.featureFlagOverride.delete({ where: { id: request.createdOverride.id } });
      }
      await tx.featureFlagOverrideRequest.update({
        where: { id: params.requestId },
        data:  { status: 'REVOKED', revokedBy: params.revokedBy, revokedAt: new Date(), revokeReason: params.revokeReason },
      });
    });

    await this.invalidateCache(request.targetType, request.targetId);

    this.emitter.emit(EVENTS.FLAG_OVERRIDE_REVOKED, {
      requestId: request.id, flagName: request.flag.name,
      targetId: request.targetId, targetName: request.targetName ?? request.targetId,
      revokedBy: params.revokedBy, revokeReason: params.revokeReason,
    });

    await this.audit.log({
      tenantId: params.tenantId, actorId: params.revokedBy,
      action: 'UPDATE' as any, entityType: 'FeatureFlagOverrideRequest', entityId: request.id,
      after: { status: 'REVOKED', reason: params.revokeReason },
    });

    return { status: 'revoked' };
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
    status?: string; requestedBy?: string; flagName?: string;
    targetId?: string; page?: number; limit?: number;
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
      include: { overrides: true, _count: { select: { overrideRequests: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async getTenantFlags(tenantId: string, planTier: string) {
    const ctx: FlagContext     = { tenantId, planTier, trackUsage: false };
    const resolved             = await this.getResolvedMap(ctx);
    const controllable         = ALL_FLAGS.filter(f => f.tenantControllable);
    return controllable.map(def => ({
      name:        def.name,
      label:       def.label,
      description: def.description,
      category:    def.category,
      isEnabled:   resolved[def.name] ?? false,
      canToggle:   true,
    }));
  }

  async getUsageAnalytics(tenantId?: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const where: any = { date: { gte: since } };
    if (tenantId) where.tenantId = tenantId;

    const usage = await this.prisma.featureFlagUsage.groupBy({
      by:     tenantId ? ['flagName', 'date'] : ['flagName'],
      where,
      _sum:   { callCount: true, hitCount: true, missCount: true },
      orderBy: tenantId
        ? [{ flagName: 'asc' }, { date: 'asc' }]
        : [{ _sum: { callCount: 'desc' } }],
    });

    return usage;
  }

  async setOverride(params: {
    flagName: string; targetType: string; targetId: string;
    isEnabled: boolean; expiresAt?: string; reason?: string;
    actorId?: string; tenantId?: string; tenantControllableOnly?: boolean;
  }) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { name: params.flagName } });
    if (!flag) throw new NotFoundException(`Flag not found: ${params.flagName}`);
    if (params.tenantControllableOnly && !flag.tenantControllable) {
      throw new ForbiddenException(`Flag ${params.flagName} cannot be controlled by tenant admins`);
    }

    await this.prisma.featureFlagOverride.upsert({
      where: { flagId_targetType_targetId: { flagId: flag.id, targetType: params.targetType as any, targetId: params.targetId } },
      update: { isEnabled: params.isEnabled, expiresAt: params.expiresAt ? new Date(params.expiresAt) : null, reason: params.reason ?? null, createdBy: params.actorId ?? null },
      create: { flagId: flag.id, targetType: params.targetType as any, targetId: params.targetId, isEnabled: params.isEnabled, expiresAt: params.expiresAt ? new Date(params.expiresAt) : null, reason: params.reason ?? null, createdBy: params.actorId ?? null },
    });

    if (params.actorId && params.tenantId) {
      await this.audit.log({
        tenantId: params.tenantId, actorId: params.actorId,
        action: 'UPDATE' as any, entityType: 'FeatureFlag', entityId: flag.id,
        after: { flagName: params.flagName, targetType: params.targetType, targetId: params.targetId, isEnabled: params.isEnabled },
      });
    }

    await this.invalidateCache(params.targetType, params.targetId);
  }

  async deleteOverride(params: {
    flagName: string; targetType: string; targetId: string; actorId?: string; tenantId?: string;
  }) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { name: params.flagName } });
    if (!flag) return;
    await this.prisma.featureFlagOverride.deleteMany({
      where: { flagId: flag.id, targetType: params.targetType as any, targetId: params.targetId },
    });
    await this.invalidateCache(params.targetType, params.targetId);
  }

  // ── Orchestrator: called by cron engine every minute ──────────────────────

  async processSchedules(): Promise<{ executed: number; expired: number; revoked: number; slaBreaches: number }> {
    const now = new Date();
    let executed = 0, expired = 0, revoked = 0, slaBreaches = 0;

    // 1. Execute due schedules
    const due = await this.prisma.featureFlagSchedule.findMany({
      where: { status: 'PENDING', scheduledAt: { lte: now } }, include: { flag: true },
    });
    for (const s of due) {
      try {
        await this.prisma.featureFlagOverride.upsert({
          where: { flagId_targetType_targetId: { flagId: s.flagId, targetType: s.targetType, targetId: s.targetId } },
          update: { isEnabled: s.action === 'ENABLE' },
          create: { flagId: s.flagId, targetType: s.targetType, targetId: s.targetId, isEnabled: s.action === 'ENABLE', createdBy: 'system:scheduler' },
        });
        await this.prisma.featureFlagSchedule.update({
          where: { id: s.id }, data: { status: 'EXECUTED', executedAt: now },
        });
        await this.invalidateCache(s.targetType, s.targetId);
        executed++;
      } catch (err) {
        await this.prisma.featureFlagSchedule.update({ where: { id: s.id }, data: { status: 'FAILED' } });
        this.logger.error(`Schedule failed: ${s.id}`, err);
      }
    }

    // 2. Auto-expire overrides
    const expiredOverrides = await this.prisma.featureFlagOverride.findMany({
      where: { expiresAt: { lte: now } }, include: { flag: true, request: true },
    });
    for (const ov of expiredOverrides) {
      // Check grace period
      const req = ov.request as any;
      if (req?.gracePeriodDays && !req.inGracePeriod) {
        // Start grace period instead of immediate expiry
        const graceEndsAt = new Date(now.getTime() + req.gracePeriodDays * 86400000);
        await this.prisma.featureFlagOverrideRequest.update({
          where: { id: req.id },
          data:  { inGracePeriod: true, graceEndsAt } as any,
        });
        // Extend override to grace end
        await this.prisma.featureFlagOverride.update({
          where: { id: ov.id }, data: { expiresAt: graceEndsAt },
        });
        this.emitter.emit(EVENTS.FLAG_GRACE_PERIOD_STARTED, {
          requestId: req.id, flagName: ov.flag.name, targetId: ov.targetId, graceEndsAt,
        });
        continue;
      }

      await this.prisma.featureFlagOverride.delete({ where: { id: ov.id } });
      if (ov.requestId) {
        await this.prisma.featureFlagOverrideRequest.update({
          where: { id: ov.requestId }, data: { status: 'EXPIRED', revokedAt: now, revokeReason: 'Expired' },
        });
      }
      await this.invalidateCache(ov.targetType, ov.targetId);
      this.emitter.emit(EVENTS.FLAG_OVERRIDE_EXPIRED, { flagName: ov.flag.name, targetId: ov.targetId });
      expired++;
    }

    // 3. Auto-revoke UPGRADE_GATED overrides
    const upgradeGated = await this.prisma.featureFlagOverrideRequest.findMany({
      where: { status: 'APPROVED', activationMode: 'UPGRADE_GATED', autoRevokeIfNotUpgradedDays: { not: null }, upgradedDetectedAt: null },
      include: { flag: true, createdOverride: true },
    });
    for (const req of upgradeGated) {
      const deadline = new Date(req.approvedAt!.getTime() + (req.autoRevokeIfNotUpgradedDays! * 86400000));
      if (now < deadline) continue;

      const sub      = await this.prisma.tenantSubscription.findFirst({ where: { tenantId: req.targetId }, include: { plan: true } });
      const flagDef  = ALL_FLAGS.find(f => f.name === req.flag.name);
      const upgraded = sub && flagDef && (flagDef.allowedTiers.length === 0 || flagDef.allowedTiers.includes(sub.plan.tier));

      if (upgraded) {
        await this.prisma.featureFlagOverrideRequest.update({ where: { id: req.id }, data: { upgradedDetectedAt: now } });
      } else {
        if (req.createdOverride) {
          await this.prisma.featureFlagOverride.delete({ where: { id: req.createdOverride.id } });
        }
        await this.prisma.featureFlagOverrideRequest.update({
          where: { id: req.id },
          data:  { status: 'REVOKED', revokedAt: now, revokeReason: `Auto-revoked: no upgrade within ${req.autoRevokeIfNotUpgradedDays}d` },
        });
        await this.invalidateCache(req.targetType, req.targetId);
        revoked++;
      }
    }

    // 4. SLA breach detection
    const breached = await this.prisma.featureFlagOverrideRequest.findMany({
      where: {
        status:         'PENDING',
        slaDeadlineAt:  { lte: now },
        escalatedAt:    null,
      } as any,
      include: { flag: true },
    });
    for (const req of breached) {
      const hoursElapsed = Math.round((now.getTime() - req.requestedAt.getTime()) / 3600000);
      this.emitter.emit(EVENTS.FLAG_SLA_BREACH, {
        requestId:    req.id,
        flagName:     req.flag.name,
        requestedBy:  req.requestedBy,
        hoursElapsed,
      });
      await this.prisma.featureFlagOverrideRequest.update({
        where: { id: req.id },
        data:  { escalatedAt: now } as any,
      });
      slaBreaches++;
      this.logger.warn(`SLA breach: request ${req.id} for ${req.flag.name} — ${hoursElapsed}h elapsed`);
    }

    return { executed, expired, revoked, slaBreaches };
  }
}
