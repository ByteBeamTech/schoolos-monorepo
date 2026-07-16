// core/license/license-builder.service.ts
//
// PR-4: the write path half of the COMM-007 split (LicenseBuilder vs
// EntitlementResolver). This is now the ONLY place a License row is
// created or modified anywhere in the codebase -- before PR-4, nothing
// created License rows at all (confirmed via repo-wide grep during
// planning), meaning every tenant was implicitly unrestricted regardless
// of subscription state.
//
// Single public API, per the PR-4 scoping discussion: every caller
// (onboarding, the SubscriptionActivated listener, and any future caller --
// manual admin action, renewal, plan change) goes through
// regenerateForTenant(). There is deliberately no second way to write a
// License row.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { RedisService }  from '../../infra/cache/redis.service';
import { LicenseGenerationReason, LicenseStatus, LicenseType, PricingModel, Prisma } from '@prisma/client';

export interface RegenerateResult {
  licenseId:         string;
  generationVersion:  number;
  status:            LicenseStatus;
}

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class LicenseBuilder {
  private readonly logger = new Logger(LicenseBuilder.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
  ) {}

  // `tx`: optional existing transaction client. Callers that already have
  // one open (onboarding.service.ts creating a Tenant + TenantSubscription
  // + License as a single atomic unit) pass it through so License creation
  // genuinely participates in that transaction -- without this, calling
  // this.prisma.$transaction() from inside an already-open transaction
  // would open a second, independent connection that can't see the
  // caller's uncommitted rows (the new TenantSubscription wouldn't be
  // visible yet), causing a spurious NotFoundException. Callers without an
  // existing transaction (the SUBSCRIPTION_ACTIVATED listener) omit `tx`
  // and get LicenseBuilder's own transaction, unchanged from before.
  //
  // `sourceEventKey`: idempotency key for event-driven callers -- pass the
  // SAME string used as the originating EventOutbox row's uniqueKey. Omit
  // for synchronous callers (no originating event to key off of).
  //
  // PR-4 review rule (documented here deliberately, not just in a PR
  // description that ages out): regenerateForTenant() has exactly two
  // legitimate categories of caller --
  //   Synchronous:  onboarding, manual admin action (pass `tx`, no
  //                 `sourceEventKey`)
  //   Asynchronous: event listeners reacting to SUBSCRIPTION_ACTIVATED,
  //                 OVERRIDE_EXPIRED, etc. (no `tx`, always pass
  //                 `sourceEventKey`)
  // A given business moment (e.g. "subscription activated") must have
  // exactly ONE producer emitting the event that triggers regeneration.
  // Two independent code paths both calling regenerateForTenant for the
  // same real-world change (e.g. a future SubscriptionCreated event ALSO
  // firing alongside onboarding's synchronous call) would silently double
  // the license generation history with no real business change behind
  // the second entry. If you're adding a new event, check no other path
  // already covers this transition before wiring a new listener.
  async regenerateForTenant(
    tenantId:        string,
    reason:          LicenseGenerationReason,
    triggeredBy:     string,
    tx?:             PrismaTx,
    sourceEventKey?: string,
  ): Promise<RegenerateResult> {
    const db = tx ?? this.prisma;

    const subscription = await db.tenantSubscription.findUnique({
      where:   { tenantId_isCurrent: { tenantId, isCurrent: true } },
      include: { plan: true },
    });
    if (!subscription) {
      throw new NotFoundException(`No current subscription found for tenant ${tenantId} -- cannot generate a License without one.`);
    }

    // Snapshot-first, same rule as COMM-004/PR-2's billing-cycle.processor.ts:
    // read the immutable subscription snapshot, not the live PricingPlan
    // relation, so a later catalog price/limit change doesn't retroactively
    // alter what this tenant is entitled to.
    const snapshot = subscription.planSnapshot as Record<string, any> | null;
    const usingSnapshot = snapshot != null;
    if (!usingSnapshot) {
      this.logger.warn(
        `Subscription ${subscription.id} (tenant ${tenantId}) has no planSnapshot ` +
        `(pre-PR-2 record) -- falling back to live PricingPlan for license generation.`,
      );
    }

    const studentLimit   = usingSnapshot ? snapshot!.studentLimit   : subscription.plan.studentLimit;
    const branchLimit    = usingSnapshot ? snapshot!.branchLimit    : subscription.plan.branchLimit;
    const staffLimit     = usingSnapshot ? snapshot!.staffLimit     : subscription.plan.staffLimit;
    const storageLimitGb = usingSnapshot ? snapshot!.storageLimitGb : subscription.plan.storageLimitGb;
    const features        = usingSnapshot ? snapshot!.features       : subscription.plan.features;
    const planModel: PricingModel = (usingSnapshot ? snapshot!.model : subscription.plan.model) ?? 'FLAT_FEE';

    const licenseStatus = this.resolveLicenseStatus(subscription.status);
    const licenseType: LicenseType = planModel === 'PER_STUDENT' ? 'PER_STUDENT' : 'MODULE_BASED';

    const limitsSnapshot = {
      maxStudents:  studentLimit  ?? null,
      maxBranches:  branchLimit   ?? null,
      maxStaff:     staffLimit    ?? null,
      storageLimit: storageLimitGb ?? null,
    };

    const performWrite = async (writeDb: PrismaTx): Promise<RegenerateResult> => {
      // Concurrency protection (review feedback): a Postgres advisory
      // transaction lock keyed on tenantId serializes concurrent
      // regenerateForTenant() calls for the SAME tenant -- e.g. a webhook
      // retry landing while another regeneration is mid-flight. Without
      // this, two concurrent calls could both read the same
      // `existing.generationVersion`, both compute the same "next" number,
      // and both write -- producing two LicenseHistory rows claiming the
      // same generationVersion. pg_advisory_xact_lock auto-releases on
      // commit/rollback, no manual unlock needed, and works even when no
      // License row exists yet (unlike SELECT ... FOR UPDATE, which needs
      // a row to lock).
      await writeDb.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;

      // Idempotency check happens INSIDE the lock, not before it -- checking
      // before acquiring the lock would leave a TOCTOU race where two
      // concurrent calls both see "not yet processed" and both proceed to
      // write. Now that both calls are serialized by the lock above, the
      // second one to reach this line will correctly see the first one's
      // write.
      if (sourceEventKey) {
        const alreadyProcessed = await writeDb.licenseHistory.findUnique({
          where: { sourceEventKey },
        });
        if (alreadyProcessed) {
          this.logger.log(
            `Skipping regeneration -- already processed sourceEventKey=${sourceEventKey} ` +
            `(existing generation=${alreadyProcessed.generationVersion})`,
          );
          const existingLicense = await writeDb.license.findUniqueOrThrow({ where: { id: alreadyProcessed.licenseId } });
          return {
            licenseId:         alreadyProcessed.licenseId,
            generationVersion: alreadyProcessed.generationVersion,
            status:            existingLicense.status,
          };
        }
      }

      const existing = await writeDb.license.findFirst({
        where:   { tenantId },
        orderBy: { generationVersion: 'desc' },
      });

      const nextGenerationVersion = (existing?.generationVersion ?? 0) + 1;

      const license = existing
        ? await writeDb.license.update({
            where: { id: existing.id },
            data: {
              subscriptionId:    subscription.id,
              type:              licenseType,
              status:            licenseStatus,
              generationVersion: nextGenerationVersion,
              maxStudents:       limitsSnapshot.maxStudents,
              maxBranches:       limitsSnapshot.maxBranches,
              maxStaff:          limitsSnapshot.maxStaff,
              storageLimit:      limitsSnapshot.storageLimit,
              features,
              expiresAt:         subscription.currentPeriodEnd,
              revokedAt:         null,
              revocationReason:  null,
            },
          })
        : await writeDb.license.create({
            data: {
              tenantId,
              subscriptionId:    subscription.id,
              type:              licenseType,
              status:            licenseStatus,
              generationVersion: nextGenerationVersion,
              maxStudents:       limitsSnapshot.maxStudents,
              maxBranches:       limitsSnapshot.maxBranches,
              maxStaff:          limitsSnapshot.maxStaff,
              storageLimit:      limitsSnapshot.storageLimit,
              features,
              expiresAt:         subscription.currentPeriodEnd,
              activatedVia:      reason,
            },
          });

      // Close out the previous history row's effectiveTo before writing the
      // new one -- this is what makes "which snapshot was active on date X"
      // answerable without guessing from timestamps alone.
      if (existing) {
        const previousHistory = await writeDb.licenseHistory.findFirst({
          where:   { licenseId: existing.id, effectiveTo: null },
          orderBy: { generationVersion: 'desc' },
        });
        if (previousHistory) {
          await writeDb.licenseHistory.update({
            where: { id: previousHistory.id },
            data:  { effectiveTo: new Date() },
          });
        }
      }

      await writeDb.licenseHistory.create({
        data: {
          licenseId:          license.id,
          tenantId,
          generationVersion:  nextGenerationVersion,
          reason,
          triggeredBy,
          sourceEventKey:     sourceEventKey ?? null,
          planId:             subscription.plan.id,
          planVersion:        usingSnapshot ? snapshot!.version : subscription.plan.version,
          subscriptionId:     subscription.id,
          subscriptionStatus: subscription.status,
          planSnapshot:       usingSnapshot ? snapshot! : { fallback: 'live-plan', planId: subscription.plan.id },
          featuresSnapshot:   features ?? {},
          limitsSnapshot,
        },
      });

      return {
        licenseId:         license.id,
        generationVersion: nextGenerationVersion,
        status:            license.status,
      };
    };

    // If the caller passed an existing transaction, participate in it
    // directly (no nested $transaction -- see the `tx` param note above).
    // Otherwise, open our own.
    const result = tx ? await performWrite(tx) : await this.prisma.$transaction(performWrite);

    await this.redis.del(`license:${tenantId}`);

    this.logger.log(
      `License regenerated: tenant=${tenantId} license=${result.licenseId} ` +
      `generation=${result.generationVersion} status=${result.status} reason=${reason}`,
    );

    return result;
  }

  // Maps subscription lifecycle state to license state. Only TRIAL and
  // ACTIVE are actually reachable in practice as of PR-4 (the two wired
  // callers -- onboarding, SubscriptionActivated -- only ever call this in
  // those two states). Any other subscription status falls back to
  // EXPIRED rather than guessing at a status this PR doesn't implement
  // behavior for (GRACE_PERIOD/SUSPENDED are reserved in the schema per
  // ADR COMM-014 but have no wired producer yet -- PR-5+ scope).
  private resolveLicenseStatus(subscriptionStatus: string): LicenseStatus {
    switch (subscriptionStatus) {
      case 'TRIAL':  return 'TRIAL';
      case 'ACTIVE': return 'ACTIVE';
      default:
        this.logger.warn(
          `regenerateForTenant called for subscription status "${subscriptionStatus}", ` +
          `which has no dedicated License status yet (GRACE_PERIOD/SUSPENDED reserved ` +
          `but unwired -- see ADR COMM-014). Defaulting to EXPIRED (fail-safe, not fail-open).`,
        );
        return 'EXPIRED';
    }
  }
}
