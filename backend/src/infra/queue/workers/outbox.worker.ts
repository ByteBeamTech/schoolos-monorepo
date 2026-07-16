import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@infra/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';

@Injectable()
export class OutboxWorker {
  private readonly logger = new Logger(OutboxWorker.name);
  private readonly BATCH_SIZE = 100;
  private readonly MAX_RETRY = 5;
  private readonly EVENT_TIMEOUT_MS = 15000;
  private readonly MAX_PAYLOAD_SIZE = 25000;

  // ✅ Tenant Throttling (In-memory Bucket per batch)
  private readonly tenantBuckets = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processOutbox() {
    this.tenantBuckets.clear();
    // ✅ Deterministic Timestamp (Unified across the batch)
    const now = new Date();

    try {
      /**
       * 🛡️ DECOUPLED FETCH
       * Minimal DB lock duration for high scalability.
       */
      const events = await this.prisma.eventOutbox.findMany({
        where: {
          status: 'PENDING',
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }]
        },
        take: this.BATCH_SIZE,
        orderBy: { createdAt: 'asc' },
      });

      if (events.length === 0) return;

      this.logger.log({ event: 'OUTBOX_BATCH_START', count: events.length });

      // ✅ Execution outside fetch context for high concurrency
      await Promise.allSettled(events.map(e => this.processEvent(e, now)));

    } catch (err: any) {
      this.logger.error({ event: 'OUTBOX_BATCH_FAILURE', error: err.message });
    }
  }

  private async processEvent(event: any, now: Date) {
    const start = Date.now();
    const tenantId = event.payload?.core?.tenantId || 'unknown';
    const correlationId = event.payload?.system?.correlationId || `job-${event.id}`;

    // ✅ Safety Log for Missing Context
    if (tenantId === 'unknown') {
      this.logger.warn({ event: 'MISSING_TENANT_CONTEXT', entity: 'outbox', eventId: event.id });
    }

    // ✅ Upgrade 2: Type-Strict Event Validation
    if (!event.type || typeof event.type !== 'string' || event.type.trim() === '') {
      await this.failEvent(event.id, 'INVALID_OR_EMPTY_EVENT_TYPE', correlationId);
      return;
    }

    /**
     * 🔥 TRUE ATOMIC CLAIM
     * Deterministic claiming using the batch 'now' timestamp.
     */
    const claimed = await this.prisma.eventOutbox.updateMany({
      where: {
        id: event.id,
        status: 'PENDING',
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }]
      },
      data: { 
        status: 'PROCESSING', 
        updatedAt: now // ✅ Upgrade 1: Strict Consistency
      }
    });

    if (claimed.count === 0) {
      this.logger.verbose({
        event: 'OUTBOX_CLAIM_SKIPPED',
        entity: 'outbox',
        eventId: event.id,
        reason: 'RACE_CONDITION_OR_CLAIMED_BY_PEER'
      });
      return;
    }

    // ✅ Tenant Throttling (Noisy Neighbor Protection)
    const currentTenantLoad = this.tenantBuckets.get(tenantId) || 0;
    if (currentTenantLoad >= 40) {
      this.logger.warn({ event: 'TENANT_THROTTLED', tenantId, eventId: event.id });
      
      await this.prisma.eventOutbox.update({
        where: { id: event.id },
        data: { status: 'PENDING', nextRetryAt: dayjs(now).add(1, 'minute').toDate() }
      });
      return;
    }
    this.tenantBuckets.set(tenantId, currentTenantLoad + 1);

    // ✅ Optimized Payload Size Check
    let payloadSize = 0;
    try {
      const payloadStr = JSON.stringify(event.payload);
      payloadSize = Buffer.byteLength(payloadStr);
    } catch (e) {
      payloadSize = 999999; 
    }

    if (payloadSize > this.MAX_PAYLOAD_SIZE) {
      await this.failEvent(event.id, 'PAYLOAD_EXCEEDS_SIZE_LIMIT', correlationId);
      return;
    }

    try {
      // ✅ Execution Timeout Guard
      await Promise.race([
        this.eventEmitter.emitAsync(event.type, event.payload),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('LISTENER_EXECUTION_TIMEOUT')), this.EVENT_TIMEOUT_MS)
        )
      ]);

      // ✅ SUCCESS MARKER
      // PR-3 fix: schema comment documents valid status values as
      // PENDING | PROCESSING | DONE | FAILED -- this previously wrote
      // 'PROCESSED', which isn't one of them. Since `status` is a plain
      // String column (not a Prisma enum), this compiled fine and never
      // errored -- it would just have silently broken any future query
      // filtering on status: 'DONE' to find completed events.
      await this.prisma.eventOutbox.update({
        where: { id: event.id },
        data: { status: 'DONE', processedAt: now, updatedAt: now }
      });

      this.logger.log({ event: 'OUTBOX_SUCCESS', eventId: event.id, correlationId, latency: Date.now() - start });

    } catch (err: any) {
      // ✅ PRO RETRY STRATEGY (Exponential Backoff + Jitter)
      const retryCount = (event.retryCount || 0) + 1;
      const isFailedPermanently = retryCount >= this.MAX_RETRY;

      const baseDelay = Math.pow(2, retryCount) * 30;
      const jitter = Math.random() * 10;
      const spread = Math.random() * retryCount * 5;
      
      const nextDelaySeconds = Math.min(300, baseDelay + jitter + spread); 
      const nextRetryAt = dayjs(now).add(nextDelaySeconds, 'second').toDate();

      await this.prisma.eventOutbox.update({
        where: { id: event.id },
        data: {
          status: isFailedPermanently ? 'FAILED' : 'PENDING',
          retryCount,
          nextRetryAt: isFailedPermanently ? null : nextRetryAt,
          updatedAt: now,
          // PR-3 fix: schema field is `error`, not `errorLog`. This was
          // masked by the as-any cast -- silently wrote to a nonexistent
          // field via Prisma's loose JSON handling under `as any`... actually
          // more precisely: TypeScript couldn't catch it because `as any`
          // disabled type checking on this call entirely.
          error: `[Attempt ${retryCount}] ${err.message}`
        }
      });

      if (isFailedPermanently) {
        this.logger.error({ event: 'OUTBOX_DLQ_ALERT', eventId: event.id, correlationId, error: err.message });
      } else {
        this.logger.warn({ event: 'OUTBOX_RETRY_SCHEDULED', eventId: event.id, retryCount, nextRetryAt });
      }
    }
  }

  private async failEvent(id: string, reason: string, correlationId: string) {
    const now = new Date();
    await this.prisma.eventOutbox.update({
      where: { id },
      data: { status: 'FAILED', error: reason, updatedAt: now }
    });
    this.logger.error({ event: 'OUTBOX_TERMINAL_ERROR', eventId: id, correlationId, reason });
  }
}
