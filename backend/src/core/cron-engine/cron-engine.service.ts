import { EventEmitter2 } from '@nestjs/event-emitter';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EVENTS } from '../events/events.constants';
import { PrismaService } from '@infra/database/prisma.service';
import { QUEUE_NAMES } from '../../infra/queue/queue.module';
import { FeatureFlagService } from '../feature-flags/feature-flags.service';
import pLimit from 'p-limit';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { randomUUID } from 'crypto';
import { RedisService } from '../../infra/cache/redis.service';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class CronEngine implements OnModuleInit {
  private readonly logger = new Logger(CronEngine.name);
  private readonly limit = pLimit(50);
  private readonly STRATEGY = 'cron-v10.9.1-enterprise-full';

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly featureFlags: FeatureFlagService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notifQueue: Queue,
    @InjectQueue(QUEUE_NAMES.BULK_OPERATIONS) private readonly bulkQueue: Queue,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    this.logger.log(`CronEngine Initialized with Strategy: ${this.STRATEGY}`);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async masterScheduler() {
    // 🛡️ Global Switch
    const isEnabled = await this.featureFlags.isEnabled('system-cron-engine', { tenantId: 'system' });
    if (!isEnabled) return;

    const baseTime = dayjs();
    const nowUtc = baseTime.toDate();

    this.eventEmitter.emit('cron.started', { timestamp: nowUtc, strategy: this.STRATEGY });

    // 🚦 Backpressure Check
    const [notifWaiting, bulkWaiting] = await Promise.all([
      this.notifQueue.getWaitingCount(),
      this.bulkQueue.getWaitingCount(),
    ]);

    const totalLoad = notifWaiting + bulkWaiting;

    if (totalLoad > 3000) {
      const deferMinutes = Math.min(5, Math.ceil(totalLoad / 1000));
      this.logger.warn({ event: 'BACKPRESSURE_DETECTED', totalLoad, deferMinutes });

      this.safeAudit({
        status: 'DEFERRED',
        reason: 'BACKPRESSURE',
        affectedCount: totalLoad,
        deferMinutes,
        triggeredAt: nowUtc,
        strategy: this.STRATEGY
      });

      await this.prisma.tenantJobSchedule.updateMany({
        where: { nextRunAt: { lte: nowUtc }, priority: { gte: 3 } },
        data: { nextRunAt: dayjs(nowUtc).add(deferMinutes, 'minute').toDate() }
      });
      return;
    }

    const BATCH_SIZE = 500;
    let loopGuard = 0;

    while (loopGuard < 20) {
      const dueJobs = await this.prisma.tenantJobSchedule.findMany({
        where: { nextRunAt: { lte: nowUtc } },
        take: BATCH_SIZE,
        orderBy: [{ priority: 'asc' }, { nextRunAt: 'asc' }, { id: 'asc' }],
        include: {
          tenant: { select: { id: true, timezone: true, slug: true, region: true } },
        }
      });

      if (dueJobs.length === 0) break;

      await Promise.allSettled(
        dueJobs.map((job) => this.limit(() => this.processJob(job, baseTime)))
      );

      if (dueJobs.length < BATCH_SIZE) break;
      loopGuard++;
    }
  }

  private async processJob(schedule: any, baseTime: dayjs.Dayjs) {
    const { tenant, jobName, time, priority, interval, missedWindow } = schedule;

    if (!(await this.featureFlags.isEnabled(`cron:${tenant.id}`, { tenantId: tenant.id }))) return;

    const tz = tenant.timezone || 'Asia/Kolkata';
    const [hour, minute] = time.split(':').map(Number);
    
    // 🕒 Correct Local Time Window
    const expectedRun = baseTime.tz(tz).set('hour', hour).set('minute', minute).set('second', 0).set('millisecond', 0);
    const latenessMs = Date.now() - expectedRun.valueOf();

    // 🔑 Unique Job Identifier
    const jobId = `${tenant.region}:${jobName}:${tenant.id}:${expectedRun.valueOf()}`;
    const executionId = `${jobId}-${randomUUID()}`;

    // 🔒 Distributed Lock
    const LOCK_TTL = 150 + Math.floor(Math.random() * 30);
    const lockKey = `lock:cron:${jobId}`;
    const isLocked = await this.redisService.client.set(lockKey, '1', 'EX', LOCK_TTL, 'NX');

    if (!isLocked) {
      if (Math.random() < 0.1) {
        this.safeAudit({ tenantId: tenant.id, jobName, jobId, status: 'SKIPPED', reason: 'LOCK_NOT_ACQUIRED', strategy: this.STRATEGY });
      }
      return;
    }

    try {
      // 🗓️ Restore: Advanced Interval Calculation (Daily, Weekly, Monthly)
      let nextRun = expectedRun;
      switch (interval) {
        case 'WEEKLY': nextRun = expectedRun.add(1, 'week'); break;
        case 'MONTHLY': nextRun = expectedRun.add(1, 'month'); break;
        case 'DAILY':
        default: nextRun = expectedRun.add(1, 'day');
      }

      // 🛡️ Atomic DB Guard with Missed Window logic
      const windowMs = (missedWindow || 60) * 60 * 1000;
      const isMissed = latenessMs > windowMs;

      const updated = await this.prisma.tenantJobSchedule.updateMany({
        where: { 
          id: schedule.id, 
          nextRunAt: { lte: baseTime.toDate() },
          OR: [
            { lastRunAt: null },
            { lastRunAt: { lt: expectedRun.toDate() } }
          ]
        },
        data: {
          nextRunAt: nextRun.toDate(),
          lastRunAt: baseTime.toDate()
        }
      });

      if (updated.count === 0) {
        if (Math.random() < 0.1) {
          this.safeAudit({ tenantId: tenant.id, jobName, jobId, status: 'SKIPPED', reason: 'ALREADY_PROCESSED', strategy: this.STRATEGY });
        }
        return;
      }

      // 🚦 If job is too old (Missed Window), log it and move next run without firing
      if (isMissed) {
        this.safeAudit({
          tenantId: tenant.id, jobName, jobId, status: 'SKIPPED',
          reason: 'MISSED_WINDOW_EXCEEDED', strategy: this.STRATEGY,
          error: `Job delayed by ${latenessMs}ms, exceeding ${windowMs}ms window`
        });
        return;
      }

      // 🏎️ Queue Selection Logic
      const queue = jobName.includes('fee') || jobName.includes('invoice') 
        ? this.bulkQueue 
        : this.notifQueue;

      // 🎲 SLA-Aware Jitter
      const baseJitter = priority <= 2 ? Math.floor(Math.random() * 5000) : Math.floor(Math.random() * 60000);
      const jitter = latenessMs > 0 ? Math.min(baseJitter, 1000) : baseJitter;

      await queue.add(jobName, {
        tenantId: tenant.id,
        branchId: schedule.branchId || null,
        date: expectedRun.format('YYYY-MM-DD'),
        _metadata: { executionId, scheduledFor: expectedRun.toISOString(), lagMs: latenessMs }
      }, {
        jobId, priority, delay: jitter, attempts: 3, 
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true, removeOnFail: false
      });

      this.logger.debug({ event: 'JOB_QUEUED', jobId, tenant: tenant.slug });

      // ✅ Sampled Success Audit
      if (Math.random() < 0.2) {
        this.safeAudit({
          tenantId: tenant.id, branchId: schedule.branchId, tenantSlug: tenant.slug, 
          jobName, jobId, executionId, priority, status: 'SUCCESS',
          lagMs: latenessMs, scheduledFor: expectedRun.toDate(), triggeredAt: baseTime.toDate(), strategy: this.STRATEGY
        });
      }

    } catch (err) {
      this.logger.error({ event: 'SCHEDULER_FAILURE', jobId, error: err.message });
      this.safeAudit({
        tenantId: tenant.id, branchId: schedule.branchId, jobName, jobId, executionId, priority,
        status: 'FAILED', reason: 'EXECUTION_ERROR', error: err.message,
        lagMs: latenessMs, scheduledFor: expectedRun.toDate(), triggeredAt: baseTime.toDate(), strategy: this.STRATEGY
      });
      
      await this.redisService.client.del(lockKey); // Release lock for retry
    }
  }

  private async safeAudit(data: any) {
    try {
      await this.bulkQueue.add('cron-audit-log', data, {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 }
      });
    } catch (e) {
      this.logger.error({ event: 'AUDIT_DISPATCH_FAIL', error: e.message });
    }
  }
}
