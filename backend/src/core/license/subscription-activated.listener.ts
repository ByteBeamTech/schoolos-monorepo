// core/license/subscription-activated.listener.ts
//
// PR-4: the only consumer of SUBSCRIPTION_ACTIVATED. LicenseBuilder itself
// has no knowledge of events, payments, or subscriptions beyond what
// regenerateForTenant()'s parameters tell it -- this listener is the
// translation layer between "something happened in the payment/subscription
// domain" and "regenerate this tenant's license," per the PR-4 scoping
// discussion (LicenseBuilder shouldn't know the payment domain exists).
//
// Fires via OutboxWorker's eventEmitter.emitAsync(event.type, event.payload)
// -- see infra/queue/workers/outbox.worker.ts. This listener never fires
// from a direct in-process emit; it only ever sees an event after it's been
// durably written to EventOutbox and picked up by the worker, which is what
// gives the whole payment -> license chain its at-least-once delivery
// guarantee.

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LicenseBuilder } from './license-builder.service';
import { EVENTS } from '../events/events.constants';

interface SubscriptionActivatedPayload {
  core:            { tenantId: string };
  subscriptionId:  string;
  tenantId:        string;
  triggeredBy:     string;
  // PR-4 review feedback: idempotency key, same string as the originating
  // EventOutbox row's uniqueKey (see saas-payment.service.ts). Passed
  // through to LicenseBuilder so a redelivered event (webhook retry,
  // outbox retry) is a safe no-op instead of an unnecessary regeneration.
  sourceEventKey:  string;
}

@Injectable()
export class SubscriptionActivatedListener {
  private readonly logger = new Logger(SubscriptionActivatedListener.name);

  constructor(private readonly licenseBuilder: LicenseBuilder) {}

  @OnEvent(EVENTS.SUBSCRIPTION_ACTIVATED)
  async handle(payload: SubscriptionActivatedPayload) {
    try {
      const result = await this.licenseBuilder.regenerateForTenant(
        payload.tenantId,
        'SUBSCRIPTION_ACTIVATED',
        payload.triggeredBy,
        undefined, // no existing transaction -- this is an async, event-driven caller
        payload.sourceEventKey,
      );
      this.logger.log(
        `License regenerated on subscription activation: tenant=${payload.tenantId} ` +
        `license=${result.licenseId} generation=${result.generationVersion}`,
      );
    } catch (err) {
      // Loud, not swallowed: if license regeneration fails here, the tenant
      // paid but doesn't have an updated license -- exactly the kind of
      // silent failure PR-1 through PR-3 have been about eliminating.
      // OutboxWorker's retry/backoff (see outbox.worker.ts) will re-deliver
      // this event on failure since emitAsync rejecting propagates back to
      // the worker's own error handling.
      this.logger.error(
        `Failed to regenerate license for tenant ${payload.tenantId} after subscription activation: ` +
        `${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }
  }
}
