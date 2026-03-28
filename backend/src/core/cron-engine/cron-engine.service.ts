import { EventEmitter2 } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';
import { Cron }               from '@nestjs/schedule';
import { InjectQueue }        from '@nestjs/bull';
import { Queue }              from 'bull';
import { EVENTS } from '../events/events.constants';
import { PrismaService }      from '../../infra/database/prisma.service';
import { QUEUE_NAMES }        from '../../infra/queue/queue.module';
import { FeatureFlagService } from '../feature-flags/feature-flags.service';

@Injectable()
export class CronEngine {
  private readonly logger = new Logger(CronEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.BILLING_CYCLE)  private readonly billingQueue:  Queue,
    @InjectQueue(QUEUE_NAMES.DUNNING)         private readonly dunningQueue:  Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)   private readonly notifQueue:    Queue,
    @InjectQueue(QUEUE_NAMES.BULK_OPERATIONS) private readonly bulkQueue:     Queue,
    private readonly emitter: EventEmitter2, private readonly featureFlags: FeatureFlagService,
  ) {}

  // ── Job 1: Billing Cycle — 1st of month 00:01 ────────────────────────────
  @Cron('1 0 1 * *', { name: 'billing-cycle' })
  async billingCycle() {
    this.logger.log('CRON billing-cycle: generating SaaS invoices');
    const subscriptions = await this.prisma.tenantSubscription.findMany({
      where:   { status: 'ACTIVE' },
      include: { plan: true, tenant: true },
    });

    for (const sub of subscriptions) {
      await this.billingQueue.add('generate-invoice', {
        subscriptionId: sub.id,
        tenantId:       sub.tenantId,
        billedAt:       new Date().toISOString(),
      }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    }
    this.logger.log(`billing-cycle: queued ${subscriptions.length} invoices`);
  }

  // ── Job 2: Fee Reminders — Daily 08:00 ───────────────────────────────────
  @Cron('0 8 * * *', { name: 'fee-reminders' })
  async feeReminders() {
    this.logger.log('CRON fee-reminders: sending fee reminders');
    const tenants = await this.prisma.tenant.findMany({ where: { status: 'ACTIVE' } });

    for (const tenant of tenants) {
      const session = await this.prisma.academicSession.findFirst({
        where: { tenantId: tenant.id, isCurrent: true },
      });
      if (!session) continue;
      await this.notifQueue.add('fee-reminders', {
        tenantId:     tenant.id,
        academicYear: session.name,
        daysBeforeDue: 3,
      }, { attempts: 2 });
    }
    // Emit fee-drop alert for tenants with no payments in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    for (const tenant of tenants) {
      const recentPayments = await this.prisma.payment.count({
        where: { tenantId: tenant.id, status: 'SUCCESS', paidAt: { gte: thirtyDaysAgo } },
      });
      if (recentPayments === 0) {
        this.emitter.emit(EVENTS.ALERT_FEE_DROP, {
          tenantId:    tenant.id,
          description: 'No payments recorded in the last 30 days',
        });
      }
    }
    this.logger.log(`fee-reminders: queued for ${tenants.length} tenants`);
  }

  // ── Job 3: Attendance Summary — Daily 17:00 ───────────────────────────────
  @Cron('0 17 * * *', { name: 'attendance-summary' })
  async attendanceSummary() {
    this.logger.log('CRON attendance-summary: queuing summaries');
    const today   = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tenants = await this.prisma.tenant.findMany({ where: { status: 'ACTIVE' } });

    for (const tenant of tenants) {
      await this.notifQueue.add('attendance-summary', {
        tenantId: tenant.id,
        date:     today.toISOString().split('T')[0],
      }, { attempts: 2 });
    }
    // Emit attendance-drop alert for tenants with low attendance today
    for (const tenant of tenants) {
      const today = new Date(); today.setUTCHours(0,0,0,0);
      const [present, absent] = await Promise.all([
        this.prisma.attendance.count({ where: { tenantId: tenant.id, date: today, status: 'PRESENT' } }),
        this.prisma.attendance.count({ where: { tenantId: tenant.id, date: today, status: 'ABSENT' } }),
      ]);
      const total = present + absent;
      if (total >= 10) {
        const pct = Math.round(present / total * 100);
        if (pct < 70) {
          this.emitter.emit(EVENTS.ALERT_ATTENDANCE_DROP, {
            tenantId:    tenant.id,
            percentage:  pct,
            description: `School-wide attendance dropped to ${pct}% today`,
          });
        }
      }
    }
    this.logger.log(`attendance-summary: queued for ${tenants.length} tenants`);
  }

  // ── Job 4: Dunning Retry — Every 6 hours ──────────────────────────────────
  @Cron('0 */6 * * *', { name: 'dunning-retry' })
  async dunningRetry() {
    this.logger.log('CRON dunning-retry: retrying failed SaaS payments');
    const pastDue = await this.prisma.tenantSubscription.findMany({
      where: {
        status: 'PAST_DUE',
        dunningAttempts: { none: { status: 'EXHAUSTED' } },
      },
      include: {
        dunningAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1 },
      },
    });

    for (const sub of pastDue) {
      const lastAttempt   = sub.dunningAttempts[0];
      const attemptNumber = (lastAttempt?.attemptNumber ?? 0) + 1;

      if (attemptNumber > 4) {
        await this.prisma.tenantSubscription.update({
          where: { id: sub.id },
          data:  { status: 'SUSPENDED' },
        });
        await this.prisma.dunningAttempt.updateMany({
          where: { subscriptionId: sub.id, status: 'SCHEDULED' },
          data:  { status: 'EXHAUSTED' },
        });
        this.logger.warn(`dunning-retry: exhausted for ${sub.id}`);
        continue;
      }

      const attempt = await this.prisma.dunningAttempt.create({
        data: {
          subscriptionId: sub.id,
          attemptNumber,
          status:      'SCHEDULED',
          scheduledAt: new Date(),
          action:      `retry_payment_attempt_${attemptNumber}`,
        },
      });

      await this.dunningQueue.add('retry-payment', {
        subscriptionId:   sub.id,
        dunningAttemptId: attempt.id,
        attemptNumber,
      }, { attempts: 1 });
    }
    this.logger.log(`dunning-retry: queued ${pastDue.length} subscriptions`);
  }

  // ── Job 5: Report Generation — Sunday 23:00 ───────────────────────────────
  @Cron('0 23 * * 0', { name: 'report-generation' })
  async reportGeneration() {
    this.logger.log('CRON report-generation: pre-generating weekly reports');
    const tenants = await this.prisma.tenant.findMany({ where: { status: 'ACTIVE' } });
    for (const tenant of tenants) {
      await this.bulkQueue.add('generate-weekly-report', {
        tenantId: tenant.id,
        week:     new Date().toISOString().split('T')[0],
      }, { attempts: 2, priority: 10 });
    }
    this.logger.log(`report-generation: queued for ${tenants.length} tenants`);
  }

  // ── Job 6: Student Count Snapshot — Daily 23:59 ───────────────────────────
  @Cron('59 23 * * *', { name: 'student-count-snapshot' })
  async studentCountSnapshot() {
    this.logger.log('CRON student-count-snapshot: snapshotting student counts');
    const today   = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tenants = await this.prisma.tenant.findMany({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
    });

    for (const tenant of tenants) {
      const count = await this.prisma.student.count({
        where: { tenantId: tenant.id, isActive: true },
      });

      await this.prisma.studentDailyCount.upsert({
        where:  { tenantId_date: { tenantId: tenant.id, date: today } },
        create: { tenantId: tenant.id, date: today, count },
        update: { count },
      });

      // Alert if ≥90% of student limit
      if (count / tenant.maxStudents >= 0.9) {
        this.logger.warn(
          `student-count-snapshot: tenant ${tenant.slug} at ${Math.round(count / tenant.maxStudents * 100)}% limit`
        );
        await this.notifQueue.add('student-limit-warning', {
          tenantId:    tenant.id,
          currentCount: count,
          maxStudents:  tenant.maxStudents,
        }, { attempts: 1 });
      }
    }
    // Detect inactive tenants (no audit log activity in 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const inactiveTenants = await this.prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      include: { _count: { select: { auditLogs: true } } },
    });
    for (const t of inactiveTenants) {
      const recentActivity = await this.prisma.auditLog.count({
        where: { tenantId: t.id, createdAt: { gte: sevenDaysAgo } },
      });
      if (recentActivity === 0) {
        this.emitter.emit(EVENTS.TENANT_INACTIVE, {
          tenantId: t.id, name: t.name,
          description: 'No activity recorded in the last 7 days',
        });
      }
    }
    this.logger.log(`student-count-snapshot: done for ${tenants.length} tenants`);
  }

  // ── Job 7: Session Expiry — Daily 02:00 ───────────────────────────────────
  @Cron('0 2 * * *', { name: 'session-expiry' })
  async sessionExpiry() {
    this.logger.log('CRON session-expiry: cleaning expired sessions');
    const deleted = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    this.logger.log(`session-expiry: deleted ${deleted.count} expired sessions`);
  }

  // ── Job 8: Late Fee Calculation — Daily 00:30 ─────────────────────────────
  // LateFee schema: { id, tenantId, invoiceId, amount, daysOverdue, appliedAt,
  //                   waivedAt, waivedBy }
  // NO 'reason' field, NO 'createdAt' — orderBy uses 'appliedAt'
  @Cron('30 0 * * *', { name: 'late-fee-calculation' })
  async lateFeeCalculation() {
    this.logger.log('CRON late-fee-calculation: applying late fees to overdue invoices');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setUTCHours(23, 59, 59, 999);

    // Fetch overdue invoices WITH their late fees (using 'appliedAt' to order)
    const overdue = await this.prisma.invoice.findMany({
      where: {
        status:  { in: ['SENT', 'PARTIALLY_PAID'] as any[] },
        dueDate: { lt: yesterday },
      },
      include: {
        lateFees: { orderBy: { appliedAt: 'desc' }, take: 1 },
      },
    });

    let applied = 0;
    const today = new Date();

    for (const invoice of overdue) {
      // Skip if a late fee was already applied today
      const lastFee = invoice.lateFees[0];
      if (lastFee) {
        const lastFeeDate = new Date(lastFee.appliedAt);
        if (lastFeeDate.toDateString() === today.toDateString()) continue;
      }

      // Calculate days overdue
      const msPerDay  = 1000 * 60 * 60 * 24;
      const daysOverdue = Math.floor((today.getTime() - new Date(invoice.dueDate).getTime()) / msPerDay);
      if (daysOverdue < 1) continue;

      // 1% per day, max ₹500
      const lateFeeAmount = Math.min(Number(invoice.dueAmount) * 0.01, 500);
      if (lateFeeAmount < 1) continue;

      // Create LateFee with correct fields (no 'reason', daysOverdue is required)
      await this.prisma.lateFee.create({
        data: {
          tenantId:   invoice.tenantId,
          invoiceId:  invoice.id,
          amount:     lateFeeAmount,
          daysOverdue,              // required field
          // appliedAt is @default(now()) — don't set manually
        },
      });

      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          dueAmount: { increment: lateFeeAmount },
          status:    'OVERDUE' as any,
        },
      });

      applied++;
    }

    this.logger.log(
      `late-fee-calculation: applied to ${applied} of ${overdue.length} overdue invoices`
    );
  }


  // ── Job: SLA Check — Every 30 minutes ────────────────────────────────────

  async getJobStatus() {
    const [billingJobs, dunningJobs, notifJobs] = await Promise.all([
      this.billingQueue.getJobCounts(),
      this.dunningQueue.getJobCounts(),
      this.notifQueue.getJobCounts(),
    ]);
    return { billing: billingJobs, dunning: dunningJobs, notifications: notifJobs };
  }

  @Cron('* * * * *', { name: 'feature-flag-orchestrator' })
  async featureFlagOrchestrator() {
    try {
      const result = await this.featureFlags.processSchedules();
      if (result.executed > 0 || result.expired > 0 || result.revoked > 0 || result.slaBreaches > 0) {
        this.logger.log(
          `feature-flag-orchestrator: executed=${result.executed} ` +
          `expired=${result.expired} revoked=${result.revoked} slaBreaches=${result.slaBreaches}`
        );
      }
    } catch (err) {
      this.logger.error('feature-flag-orchestrator failed:', err);
    }
  }


}
