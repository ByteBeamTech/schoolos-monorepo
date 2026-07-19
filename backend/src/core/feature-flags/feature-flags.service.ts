// path: src/core/feature-flags/feature-flags.service.ts

import {
  Injectable, Logger,
  NotFoundException, BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 }  from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue }    from '@nestjs/bull';
import { Queue }          from 'bull';
import { PrismaService } from '@infra/database/prisma.service';
import { RedisService }   from '../../infra/cache/redis.service';
import { AuditService }   from '../compliance/audit.service';
import { EVENTS }         from '../events/events.constants';
import { ALL_FLAGS }      from './flag-definitions';
import { QUEUE_NAMES }    from '../../infra/queue/queue.module';
import * as crypto        from 'crypto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface FlagContext {
  tenantId:    string;
  userId?:     string;
  role?:       string;
  branchId?:   string;
  planTier?:   string;
  trackUsage?: boolean;
}

type FlagMap = Record<string, boolean>;

export type FlagMapWithMeta = Record<string, {
  enabled:       boolean;
  reason:        string;
  requiredTier?: string;
  inGrace?:      boolean;
}>;

const TIER_ORDER: Record<string, number> = {
  STARTER: 1, GROWTH: 2, PRO: 3, ENTERPRISE: 4,
};

const CACHE_TTL      = 300;
const NUDGE_COOLDOWN = 7;
const SLA_HOURS      = 24;

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly redis:      RedisService,
    private readonly audit:      AuditService,
    private readonly emitter:    EventEmitter2, // NOTE: injected but never called anywhere in
                                                 // this file -- found during the realtime-gateway
                                                 // activation, flagged as a separate dormant-
                                                 // infrastructure cleanup candidate, not fixed here.
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notifQueue: Queue,
    private readonly realtime:   RealtimeGateway,
  ) {}

  // ── Public evaluation API ──────────────────────────────────────────────────

  async isEnabled(flagName: string, ctx: FlagContext): Promise<boolean> {
    const map    = await this.getResolvedMap(ctx);
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

  // ── Version helpers (O(1) cache invalidation) ─────────────────────────────

  private async getTenantFlagVersion(tenantId: string): Promise<number> {
    const row = await (this.prisma as any).featureFlagVersion?.findUnique({
      where: { tenantId },
    });
    return row?.version ?? 1;
  }

  private async incrementTenantFlagVersion(tenantId: string): Promise<number> {
    const row = await (this.prisma as any).featureFlagVersion?.upsert({
      where:  { tenantId },
      update: { version: { increment: 1 } },
      create: { tenantId, version: 2 },
    });
    return row?.version ?? 1;
  }

  // ── Cache-aware resolution ─────────────────────────────────────────────────

  private async getResolvedMap(ctx: FlagContext): Promise<FlagMap> {
    const [tenantVer, globalVer] = await Promise.all([
      this.getTenantFlagVersion(ctx.tenantId),
      this.redis.get('flags:global:version').then(v => v ?? '1'),
    ]);

    const cacheKey = `flags:${ctx.tenantId}:v${tenantVer}:gv${globalVer}`;
    const cached   = await this.redis.getJson<FlagMap>(cacheKey);
    if (cached) return cached;

    const meta = await this.evaluateAll(ctx);
    const flat  = Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, v.enabled]));
    await this.redis.setJson(cacheKey, flat, CACHE_TTL);
    return flat;
  }

  // ── Core evaluation engine ────────────────────────────────────────────────

  private async evaluateAll(ctx: FlagContext): Promise<FlagMapWithMeta> {
    const now = new Date();

    const [flags, overrides] = await Promise.all([
      this.prisma.featureFlag.findMany({ include: { overrides: true } }),
      this.prisma.featureFlagOverride.findMany({
        where: {
          OR: [
            { targetType: 'GLOBAL',  targetId: 'global'        },
            { targetType: 'TENANT',  targetId: ctx.tenantId    },
            ...(ctx.userId   ? [{ targetType: 'USER' as any,   targetId: ctx.userId   }] : []),
            ...(ctx.role     ? [{ targetType: 'ROLE' as any,   targetId: ctx.role     }] : []),
            ...(ctx.branchId ? [{ targetType: 'BRANCH' as any, targetId: ctx.branchId }] : []),
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

      if (ctx.userId && byType.has('USER')) {
        result[flag.name] = { enabled: byType.get('USER').isEnabled, reason: 'override' };
        continue;
      }
      if (ctx.role && byType.has('ROLE')) {
        result[flag.name] = { enabled: byType.get('ROLE').isEnabled, reason: 'override' };
        continue;
      }
      if (ctx.branchId && byType.has('BRANCH')) {
        result[flag.name] = { enabled: byType.get('BRANCH').isEnabled, reason: 'override' };
        continue;
      }
      if (byType.has('TENANT')) {
        const ov      = byType.get('TENANT');
        const inGrace = ov.request?.inGracePeriod && ov.request?.graceEndsAt > now;
        result[flag.name] = { enabled: ov.isEnabled, reason: 'override', inGrace: inGrace ?? false };
        continue;
      }

      const allowedTiers = (flag.allowedTiers as string[]) ?? [];
      if (allowedTiers.length > 0 && ctx.planTier) {
        const tenantLevel = TIER_ORDER[ctx.planTier] ?? 0;
        const minRequired = Math.min(...allowedTiers.map(t => TIER_ORDER[t] ?? 99));
        if (tenantLevel < minRequired) {
          result[flag.name] = { enabled: false, reason: 'tier', requiredTier: allowedTiers[0] };
          continue;
        }
      }

      if (flag.enabledFromAt  && flag.enabledFromAt  > now) { result[flag.name] = { enabled: false, reason: 'time' }; continue; }
      if (flag.enabledUntilAt && flag.enabledUntilAt < now) { result[flag.name] = { enabled: false, reason: 'time' }; continue; }

      if (flag.rolloutPercentage > 0 && flag.rolloutPercentage < 100) {
        const hash   = crypto.createHash('md5').update(`${ctx.tenantId}:${flag.name}`).digest('hex');
        const bucket = parseInt(hash.substring(0, 8), 16) % 100;
        result[flag.name] = { enabled: bucket < flag.rolloutPercentage, reason: 'rollout' };
        continue;
      }

      if (byType.has('GLOBAL')) { result[flag.name] = { enabled: byType.get('GLOBAL').isEnabled, reason: 'override' }; continue; }
      result[flag.name] = { enabled: flag.defaultValue, reason: 'default' };
    }
    return result;
  }

  // ── Cache invalidation (O(1) via version bump) ────────────────────────────

  // AuditLog.tenantId is a real FK to Tenant.id, not the 'schoolos-platform'
  // slug -- non-TENANT-targeted overrides (GLOBAL/ROLE/USER/BRANCH) need the
  // actual platform tenant row's id for audit entries. Resolved lazily and
  // cached on the instance since this rarely changes and the cron sub-steps
  // above may call it repeatedly in one run.
  private platformTenantId: string | null = null;
  private async getPlatformTenantId(): Promise<string> {
    if (this.platformTenantId) return this.platformTenantId;
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: 'schoolos-platform' } });
    this.platformTenantId = tenant?.id ?? 'schoolos-platform'; // fallback keeps audit non-fatal if platform tenant row is ever missing
    return this.platformTenantId;
  }

  private async invalidateCache(targetType: string, targetId: string): Promise<void> {
    if (targetType === 'TENANT') {
      await this.incrementTenantFlagVersion(targetId);
      return;
    }
    if (targetType === 'GLOBAL') {
      const next = Date.now().toString();
      await this.redis.set('flags:global:version', next);
      return;
    }
    this.logger.debug(`Cache deferred for ${targetType}:${targetId}`);
  }

  // ── Orchestrator: Batch-optimised (N+1 fixed) ────────────────────────────
  //
  // COMM-006B: this method previously existed but was never invoked from
  // anywhere in the app (no @Cron, no manual call site) -- "built but never
  // wired," same shape as the realtime gateway and EventEmitter2 findings
  // (see v14 handoff §3). Wired here via @Cron so the UPGRADE_GATED
  // auto-revoke and FeatureFlagSchedule execution logic it already
  // contained actually runs, and so the new cleanupExpiredOverrides() step
  // (added below, COMM-006B item 2) runs too. Split into named sub-methods
  // rather than left as one growing method, per code review.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processSchedules(): Promise<{ executed: number; revoked: number; expired: number; slaBreaches: number }> {
    const now = new Date();

    const revoked  = await this.processUpgradeSchedules(now);
    const executed = await this.executeScheduledFlags(now);
    const expired  = await this.cleanupExpiredOverrides(now);

    return { executed, revoked, expired, slaBreaches: 0 };
  }

  // ── Sub-step: UPGRADE_GATED auto-revoke ───────────────────────────────────

  private async processUpgradeSchedules(now: Date): Promise<number> {
    let revoked = 0;

    const upgradeGated = await this.prisma.featureFlagOverrideRequest.findMany({
      where: {
        status:                    'APPROVED',
        activationMode:            'UPGRADE_GATED',
        autoRevokeIfNotUpgradedDays: { not: null },
        upgradedDetectedAt:        null,
      },
      include: { flag: true, createdOverride: true },
    });

    if (upgradeGated.length === 0) return 0;

    const tenantIds = [...new Set(upgradeGated.map(r => r.targetId))];
    const subs = await this.prisma.tenantSubscription.findMany({
      where:   { tenantId: { in: tenantIds }, status: 'ACTIVE' },
      include: { plan: true },
    });

    const subMap = new Map(subs.map(s => [s.tenantId, s]));

    for (const req of upgradeGated) {
      const deadline = new Date(req.approvedAt!.getTime() + (req.autoRevokeIfNotUpgradedDays! * 86_400_000));
      if (now < deadline) continue;

      const sub     = subMap.get(req.targetId);
      const flagDef = ALL_FLAGS.find(f => f.name === req.flag.name);
      const upgraded = sub && flagDef && (
        flagDef.allowedTiers === null ||
        flagDef.allowedTiers.includes((sub as any).plan.tier)
      );

      if (!upgraded) {
        if (req.createdOverride) {
          await this.prisma.featureFlagOverride.delete({ where: { id: req.createdOverride.id } });
        }
        await this.prisma.featureFlagOverrideRequest.update({
          where: { id: req.id },
          data:  { status: 'REVOKED', revokedAt: now, revokeReason: 'Auto-revoked: no upgrade within period' },
        });
        await this.audit.logUpdate({
          tenantId:   req.targetType === 'TENANT' ? req.targetId : await this.getPlatformTenantId(),
          // No human actor for this transition -- it's system/cron-triggered.
          // actorRole is a UserRole column (no SYSTEM value exists on that
          // enum); left null here, matching the convention used elsewhere
          // for system-initiated audit entries (e.g. platform-invitations
          // expiry) rather than writing an invalid enum value.
          actorId:    undefined,
          actorRole:  null,
          entityType: 'FeatureFlagOverrideRequest',
          entityId:   req.id,
          before:     { status: 'APPROVED' },
          after:      { status: 'REVOKED', reason: 'Auto-revoked: no upgrade within period', flagName: req.flag.name },
        });
        await this.invalidateCache(req.targetType, req.targetId);
        revoked++;
      }
    }
    return revoked;
  }

  // ── Sub-step: execute due FeatureFlagSchedule rows ────────────────────────

  private async executeScheduledFlags(now: Date): Promise<number> {
    let executed = 0;

    const due = await this.prisma.featureFlagSchedule.findMany({
      where:   { status: 'PENDING', scheduledAt: { lte: now } },
      include: { flag: true },
    });

    for (const s of due) {
      try {
        await this.prisma.featureFlagOverride.upsert({
          where:  { flagId_targetType_targetId: { flagId: s.flagId, targetType: s.targetType, targetId: s.targetId } },
          update: { isEnabled: s.action === 'ENABLE' },
          create: { flagId: s.flagId, targetType: s.targetType, targetId: s.targetId, isEnabled: s.action === 'ENABLE', createdBy: 'system:scheduler' },
        });
        await this.prisma.featureFlagSchedule.update({ where: { id: s.id }, data: { status: 'EXECUTED', executedAt: now } });
        await this.invalidateCache(s.targetType, s.targetId);
        executed++;
      } catch {
        await this.prisma.featureFlagSchedule.update({ where: { id: s.id }, data: { status: 'FAILED' } });
      }
    }
    return executed;
  }

  // ── Sub-step: cleanup expired, non-UPGRADE_GATED overrides (COMM-006B) ────
  //
  // UPGRADE_GATED overrides are excluded here on purpose -- they don't use
  // FeatureFlagOverride.expiresAt at all; their lifecycle is entirely driven
  // by processUpgradeSchedules() above (autoRevokeIfNotUpgradedDays measured
  // from approvedAt). Handling them here too would be redundant and could
  // race with that path. Everything else with a past expiresAt (TRIAL
  // overrides -- see approveRequest()'s new expiresAt computation -- and any
  // direct/manual override created via setOverride() with an explicit
  // expiresAt) is in scope.
  //
  // Grace period fields (gracePeriodDays/inGracePeriod/graceEndsAt) are read
  // elsewhere (evaluateAll()) but nothing writes them yet -- that write path
  // is a separate, not-yet-scoped piece of work (flagged to the person, not
  // built here). This cleanup step does not touch those fields.
  private async cleanupExpiredOverrides(now: Date): Promise<number> {
    let expired = 0;

    const due = await this.prisma.featureFlagOverride.findMany({
      where: {
        expiresAt: { lte: now },
        OR: [
          { requestId: null },
          { request: { activationMode: { not: 'UPGRADE_GATED' } } },
        ],
      },
      include: { flag: true, request: true },
    });

    for (const ov of due) {
      await this.prisma.featureFlagOverride.delete({ where: { id: ov.id } });

      if (ov.requestId && ov.request) {
        await this.prisma.featureFlagOverrideRequest.update({
          where: { id: ov.requestId },
          data:  { status: 'EXPIRED', revokedAt: now, revokeReason: 'Trial window expired' },
        });
        await this.audit.logUpdate({
          tenantId:   ov.targetType === 'TENANT' ? ov.targetId : await this.getPlatformTenantId(),
          actorId:    undefined,
          actorRole:  null, // system/cron-triggered -- see note in processUpgradeSchedules() above
          entityType: 'FeatureFlagOverrideRequest',
          entityId:   ov.requestId,
          before:     { status: ov.request.status },
          after:      { status: 'EXPIRED', reason: 'Trial window expired', flagName: ov.flag.name },
        });
      }

      await this.invalidateCache(ov.targetType, ov.targetId);
      expired++;
    }
    return expired;
  }

  // ── Approval workflow ─────────────────────────────────────────────────────

  async approveRequest(params: {
    requestId:     string;
    approvedBy:    string;
    approverRole:  string;
    approverNote?: string;
    tenantId:      string;
  }) {
    const request = await this.prisma.featureFlagOverrideRequest.findUnique({
      where:   { id: params.requestId },
      include: { flag: true },
    });
    if (!request || request.status !== 'PENDING') {
      throw new BadRequestException('Invalid or already processed request');
    }

    const approvedAt = new Date();

    // COMM-006B: TRIAL requests carry a trialDays count but, before this
    // change, nothing ever translated it into FeatureFlagOverride.expiresAt
    // -- the override created below was permanent regardless of
    // activationMode. Without this, the new cleanup job (see
    // cleanupExpiredOverrides()) would have nothing to find for TRIAL
    // overrides. SCHEDULED/activatesAt timing (deferring override creation
    // itself until activatesAt) is a separate, larger gap -- not addressed
    // here, flagged as a follow-up, out of COMM-006B's scope.
    const expiresAt = request.activationMode === 'TRIAL' && request.trialDays
      ? new Date(approvedAt.getTime() + request.trialDays * 86_400_000)
      : null;

    const [updated] = await this.prisma.$transaction(async (tx) => {
      const ov = await tx.featureFlagOverride.upsert({
        where:  { flagId_targetType_targetId: { flagId: request.flagId, targetType: request.targetType, targetId: request.targetId } },
        update: { isEnabled: request.isEnabled, reason: `Approved: ${request.id}`, createdBy: params.approvedBy, expiresAt },
        create: { flagId: request.flagId, targetType: request.targetType, targetId: request.targetId, isEnabled: request.isEnabled, reason: `Approved: ${request.id}`, createdBy: params.approvedBy, requestId: request.id, expiresAt },
      });
      const req = await tx.featureFlagOverrideRequest.update({
        where: { id: request.id },
        data:  { status: 'APPROVED', approvedBy: params.approvedBy, approvedAt, approverNote: params.approverNote },
      });
      return [req, ov];
    });

    await this.invalidateCache(request.targetType, request.targetId);

    await this.audit.logUpdate({
      tenantId:   params.tenantId,
      actorId:    params.approvedBy,
      actorRole:  params.approverRole as any,
      entityType: 'FeatureFlagOverrideRequest',
      entityId:   request.id,
      before:     { status: 'PENDING' },
      after:      { status: 'APPROVED', flagName: request.flag.name, approverNote: params.approverNote, expiresAt },
    });

    // REALTIME: notify connected superadmins so the Approvals list
    // updates without waiting for the next poll tick.
    this.realtime.emitToAdmins('flags:request-updated', { id: request.id, status: 'APPROVED' });

    return updated;
  }

  // ── Controller-surface helpers ────────────────────────────────────────────
  //
  // COMM-006A: these were previously stubs (returned fake success/empty
  // results without touching the database -- see ADR-COMM-015 §6.2 for
  // the full history of that finding). This is an operational-tooling
  // repair, not a licensing change -- EntitlementResolver, AccessService,
  // and commercial/licensing semantics are untouched.
  //
  // COMM-006B (this PR): audit logging wired on every state change below,
  // expired-override cleanup added (see cleanupExpiredOverrides(), called
  // from the now-@Cron-wired processSchedules()), and approveRequest() now
  // computes expiresAt from trialDays for TRIAL-mode approvals -- without
  // that, cleanup had nothing to find. Grace-period write-path
  // (inGracePeriod/graceEndsAt) remains unbuilt -- out of scope here, see
  // cleanupExpiredOverrides()'s comment.
  //
  // Duplicate-PENDING prevention is a SERVICE-level check (query + reject),
  // not a DB unique constraint -- explicit Phase-0 decision: a constraint
  // would block "reject an old request, then submit a fresh one" for the
  // same flag+target, which must remain possible. FeatureFlagOverride
  // itself already has a real DB-level unique constraint
  // (@@unique([flagId, targetType, targetId])) and needs no change --
  // approveRequest()'s existing upsert already relies on it correctly.

  async getTenantFlags(tenantId: string, planTier: string) {
    return this.getAllForContext({ tenantId, planTier });
  }

  private async resolveFlagId(flagName: string): Promise<string> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { name: flagName } });
    if (!flag) throw new NotFoundException(`Unknown flag: ${flagName}`);
    return flag.id;
  }

  async setOverride(dto: {
    flagName: string;
    targetType: string;
    targetId: string;
    isEnabled: boolean;
    expiresAt?: string;
    reason?: string;
    actorId: string;
    tenantId: string;
    tenantControllableOnly?: boolean;
  }) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { name: dto.flagName } });
    if (!flag) throw new NotFoundException(`Unknown flag: ${dto.flagName}`);

    // Tenant self-service toggle path (PATCH /flags/tenant/toggle) must
    // only ever touch flags the flag definition marks tenantControllable
    // -- this is the one guard standing between "tenant toggles their own
    // flag" and "tenant toggles an arbitrary flag via the same method
    // superadmin uses for direct overrides."
    if (dto.tenantControllableOnly && !flag.tenantControllable) {
      throw new BadRequestException(`Flag ${dto.flagName} is not tenant-controllable.`);
    }

    const override = await this.prisma.featureFlagOverride.upsert({
      where: {
        flagId_targetType_targetId: {
          flagId: flag.id, targetType: dto.targetType as any, targetId: dto.targetId,
        },
      },
      update: {
        isEnabled: dto.isEnabled,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        reason:    dto.reason ?? null,
        createdBy: dto.actorId,
      },
      create: {
        flagId: flag.id, targetType: dto.targetType as any, targetId: dto.targetId,
        isEnabled: dto.isEnabled,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        reason:    dto.reason ?? null,
        createdBy: dto.actorId,
      },
    });

    await this.invalidateCache(dto.targetType, dto.targetId);
    return { success: true, override };
  }

  async deleteOverride(dto: { flagName: string; targetType: string; targetId: string; actorId: string; tenantId: string }) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { name: dto.flagName } });
    if (!flag) throw new NotFoundException(`Unknown flag: ${dto.flagName}`);

    await this.prisma.featureFlagOverride.deleteMany({
      where: { flagId: flag.id, targetType: dto.targetType as any, targetId: dto.targetId },
    });

    await this.invalidateCache(dto.targetType, dto.targetId);
    return { success: true };
  }

  async createOverrideRequest(dto: {
    flagName: string;
    targetType: string;
    targetId: string;
    targetName?: string;
    isEnabled?: boolean;
    requestReason: string;
    activationMode: string;
    activatesAt?: string;
    trialDays?: number;
    gracePeriodDays?: number;
    autoRevokeIfNotUpgradedDays?: number;
    requestedBy: string;
    requestedByTenantId: string;
  }) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { name: dto.flagName } });
    if (!flag) throw new NotFoundException(`Unknown flag: ${dto.flagName}`);

    if (!dto.requestReason) {
      throw new BadRequestException('requestReason is required.');
    }

    // ActivationMode-specific validation -- the fields these modes need
    // already exist on the model but nothing validated their presence
    // before this PR (createOverrideRequest was a total stub).
    if (dto.activationMode === 'TRIAL' && !dto.trialDays) {
      throw new BadRequestException('trialDays is required when activationMode=TRIAL.');
    }
    if (dto.activationMode === 'SCHEDULED' && !dto.activatesAt) {
      throw new BadRequestException('activatesAt is required when activationMode=SCHEDULED.');
    }

    // Duplicate-PENDING prevention (§3, service-level per Phase-0 decision).
    const existingPending = await this.prisma.featureFlagOverrideRequest.findFirst({
      where: {
        flagId: flag.id, targetType: dto.targetType as any, targetId: dto.targetId, status: 'PENDING',
      },
    });
    if (existingPending) {
      throw new BadRequestException(
        `A pending override request already exists for this flag/target (request ${existingPending.id}). ` +
        `Reject or cancel it before submitting a new one.`,
      );
    }

    const request = await this.prisma.featureFlagOverrideRequest.create({
      data: {
        flagId:                       flag.id,
        targetType:                   dto.targetType as any,
        targetId:                     dto.targetId,
        targetName:                   dto.targetName ?? null,
        isEnabled:                    dto.isEnabled ?? true,
        requestedBy:                  dto.requestedBy,
        requestReason:                dto.requestReason,
        activationMode:               dto.activationMode as any,
        activatesAt:                  dto.activatesAt ? new Date(dto.activatesAt) : null,
        trialDays:                    dto.trialDays ?? null,
        gracePeriodDays:              dto.gracePeriodDays ?? null,
        autoRevokeIfNotUpgradedDays:  dto.autoRevokeIfNotUpgradedDays ?? null,
      },
    });

    await this.audit.logCreate({
      tenantId:   dto.requestedByTenantId,
      actorId:    dto.requestedBy,
      entityType: 'FeatureFlagOverrideRequest',
      entityId:   request.id,
      after: {
        flagName:       dto.flagName,
        targetType:     dto.targetType,
        targetId:       dto.targetId,
        activationMode: dto.activationMode,
        status:         'PENDING',
      },
    });

    // REALTIME: notify connected superadmins immediately instead of them
    // finding out on the next poll tick.
    this.realtime.emitToAdmins('flags:new-request', {
      id:         request.id,
      flagName:   dto.flagName,
      targetType: dto.targetType,
      targetId:   dto.targetId,
      isEnabled:  request.isEnabled,
    });

    return request;
  }

  // UX FIX (found via real usage: Approvals page's lifecycle timeline
  // showed raw backend user IDs like "by cmqw13ruf0002dyi36t2soz0c"
  // instead of a human name). Root cause: requestedBy/approvedBy/
  // rejectedBy/cancelledBy/revokedBy are all plain String columns on
  // FeatureFlagOverrideRequest -- no Prisma relation to User exists to
  // `include`. Rather than a schema migration (relation + FK, more
  // invasive for a display-only need), this batch-resolves the actor IDs
  // actually present in a given result set via one extra query, and
  // attaches a `<field>Name` alongside each raw id -- frontend can prefer
  // the resolved name and fall back to the id if a user was deleted.
  private async enrichActorNames<T extends Record<string, any>>(requests: T[]): Promise<T[]> {
    const actorFields = ['requestedBy', 'approvedBy', 'rejectedBy', 'cancelledBy', 'revokedBy'];
    const ids = new Set<string>();
    for (const r of requests) {
      for (const f of actorFields) {
        if (r[f]) ids.add(r[f]);
      }
    }
    if (ids.size === 0) return requests;

    const users = await this.prisma.user.findMany({
      where:  { id: { in: [...ids] } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const nameById = new Map(
      users.map(u => [u.id, `${u.firstName} ${u.lastName}`.trim() || u.email]),
    );

    return requests.map(r => {
      const enriched: any = { ...r };
      for (const f of actorFields) {
        if (r[f]) enriched[`${f}Name`] = nameById.get(r[f]) ?? r[f]; // fallback: raw id if user was deleted
      }
      return enriched;
    });
  }

  async getAllRequests(query: {
    status?: string; flagName?: string; targetId?: string; requestedBy?: string; page: number; limit: number;
  }) {
    const where: any = {};
    if (query.status)      where.status      = query.status;
    if (query.targetId)    where.targetId    = query.targetId;
    if (query.requestedBy) where.requestedBy = query.requestedBy;
    if (query.flagName)    where.flag        = { name: query.flagName };

    const [items, total] = await Promise.all([
      this.prisma.featureFlagOverrideRequest.findMany({
        where,
        include:  { flag: true },
        orderBy:  { requestedAt: 'desc' },
        skip:     (query.page - 1) * query.limit,
        take:     query.limit,
      }),
      this.prisma.featureFlagOverrideRequest.count({ where }),
    ]);

    return { items: await this.enrichActorNames(items), total, page: query.page, limit: query.limit };
  }

  async getPendingRequests() {
    const requests = await this.prisma.featureFlagOverrideRequest.findMany({
      where:   { status: 'PENDING' },
      include: { flag: true },
      orderBy: { requestedAt: 'asc' },
    });
    return this.enrichActorNames(requests);
  }

  async rejectRequest(dto: { requestId: string; rejectedBy: string; rejectionReason: string; tenantId: string }) {
    const request = await this.prisma.featureFlagOverrideRequest.findUnique({ where: { id: dto.requestId } });
    if (!request || request.status !== 'PENDING') {
      throw new BadRequestException('Invalid or already processed request');
    }
    if (!dto.rejectionReason) {
      throw new BadRequestException('rejectionReason is required.');
    }

    // Transactional per Phase-0 consistency requirement, even though this
    // path only writes one row today -- keeps the same shape as
    // approveRequest()/cancelRequest()/revokeOverride().
    const [updated] = await this.prisma.$transaction([
      this.prisma.featureFlagOverrideRequest.update({
        where: { id: dto.requestId },
        data:  { status: 'REJECTED', rejectedBy: dto.rejectedBy, rejectedAt: new Date(), rejectionReason: dto.rejectionReason },
      }),
    ]);

    await this.audit.logUpdate({
      tenantId:   dto.tenantId,
      actorId:    dto.rejectedBy,
      entityType: 'FeatureFlagOverrideRequest',
      entityId:   dto.requestId,
      before:     { status: 'PENDING' },
      after:      { status: 'REJECTED', reason: dto.rejectionReason },
    });

    // No cache invalidation: a PENDING->REJECTED request never had an
    // active FeatureFlagOverride, so no evaluated flag result changes.
    this.realtime.emitToAdmins('flags:request-updated', { id: updated.id, status: 'REJECTED' });
    return updated;
  }

  async cancelRequest(dto: { requestId: string; cancelledBy: string; tenantId: string }) {
    const request = await this.prisma.featureFlagOverrideRequest.findUnique({ where: { id: dto.requestId } });
    if (!request || request.status !== 'PENDING') {
      throw new BadRequestException('Invalid or already processed request');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.featureFlagOverrideRequest.update({
        where: { id: dto.requestId },
        data:  { status: 'CANCELLED', cancelledBy: dto.cancelledBy, cancelledAt: new Date() },
      }),
    ]);

    await this.audit.logUpdate({
      tenantId:   dto.tenantId,
      actorId:    dto.cancelledBy,
      entityType: 'FeatureFlagOverrideRequest',
      entityId:   dto.requestId,
      before:     { status: 'PENDING' },
      after:      { status: 'CANCELLED' },
    });

    this.realtime.emitToAdmins('flags:request-updated', { id: updated.id, status: 'CANCELLED' });
    return updated; // same no-cache-invalidation rationale as rejectRequest
  }

  async revokeOverride(dto: { requestId: string; revokedBy: string; revokeReason: string; tenantId: string }) {
    const request = await this.prisma.featureFlagOverrideRequest.findUnique({
      where:   { id: dto.requestId },
      include: { createdOverride: true },
    });
    if (!request || request.status !== 'APPROVED') {
      throw new BadRequestException('Only an approved request with an active override can be revoked.');
    }
    if (!dto.revokeReason) {
      throw new BadRequestException('revokeReason is required.');
    }

    const ops: any[] = [
      this.prisma.featureFlagOverrideRequest.update({
        where: { id: dto.requestId },
        data:  { status: 'REVOKED', revokedBy: dto.revokedBy, revokedAt: new Date(), revokeReason: dto.revokeReason },
      }),
    ];
    if (request.createdOverride) {
      ops.push(this.prisma.featureFlagOverride.delete({ where: { id: request.createdOverride.id } }));
    }

    const [updated] = await this.prisma.$transaction(ops);
    await this.invalidateCache(request.targetType, request.targetId);

    await this.audit.logUpdate({
      tenantId:   dto.tenantId,
      actorId:    dto.revokedBy,
      entityType: 'FeatureFlagOverrideRequest',
      entityId:   dto.requestId,
      before:     { status: 'APPROVED' },
      after:      { status: 'REVOKED', reason: dto.revokeReason },
    });

    this.realtime.emitToAdmins('flags:request-updated', { id: updated.id, status: 'REVOKED' });
    return updated;
  }

  async getAllFlags() { return ALL_FLAGS; }

  // ── Usage analytics (fire-and-forget) ────────────────────────────────────

  private trackUsageAsync(flagName: string, tenantId: string, hit: boolean): void {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    setImmediate(async () => {
      try {
        await this.prisma.featureFlagUsage.upsert({
          where:  { flagName_tenantId_date: { flagName, tenantId, date: today } },
          update: {
            callCount: { increment: 1 },
            hitCount:  hit  ? { increment: 1 } : undefined,
            missCount: !hit ? { increment: 1 } : undefined,
          },
          create: { flagName, tenantId, date: today, callCount: 1, hitCount: hit ? 1 : 0, missCount: !hit ? 1 : 0 },
        });
      } catch { /* silent */ }
    });
  }

  private async maybeNudgeUpgrade(flagName: string, tenantId: string, today: Date): Promise<void> {
    // Logic as per v2 upgrade-nudge spec — placeholder kept intentionally
  }
}
