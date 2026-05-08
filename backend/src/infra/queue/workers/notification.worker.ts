// infra/queue/workers/notification.worker.ts
//
// FIX-04: Removed @Process('send') — NotificationProcessor is the canonical
// owner of the 'send' job. Having two handlers on the same queue caused ~50%
// of messages to be silently dropped (Worker marked SENT without calling any
// channel; Processor never got the job).
//
// This worker now handles all OTHER job names enqueued to the notifications
// queue that previously had no @Process() handler (stalling in Redis):
//   - fee-reminders
//   - attendance-summary
//   - student-limit-warning
//   - fraud-alert
//   - domain-event
//   - license-expiry-warning (kept from original)

import { Process, Processor }  from '@nestjs/bull';
import { Logger }               from '@nestjs/common';
import { Job }                  from 'bull';
import { QUEUE_NAMES }          from '../queue.module';
import { PrismaService }        from '@infra/database/prisma.service';

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── 'send' intentionally NOT handled here ─────────────────────────────────
  // NotificationProcessor (modules/notifications/queue/notification.processor.ts)
  // owns @Process('send') and dispatches to email/SMS/WhatsApp/Push channels.

  // ── fee-reminders ─────────────────────────────────────────────────────────
  @Process('fee-reminders')
  async handleFeeReminders(job: Job<{ tenantId: string; academicYear: string; daysBeforeDue: number }>) {
    const { tenantId, academicYear, daysBeforeDue } = job.data;
    this.logger.log(`[fee-reminders] tenant:${tenantId} year:${academicYear}`);

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + daysBeforeDue);

      const invoices = await this.prisma.invoice.findMany({
        where: {
          tenantId,
          academicYear,
          status:  { in: ['SENT', 'PARTIALLY_PAID'] as any[] },
          dueDate: { lte: cutoff },
        },
        include: {
          student: {
            include: {
              guardianLinks: {
                where:   { isPrimary: true },
                include: { guardian: { select: { phone: true, email: true } } },
                take:    1,
              },
            },
          },
        },
        take: 200,
      });

      this.logger.log(`[fee-reminders] ${invoices.length} overdue invoices for tenant:${tenantId}`);

      for (const invoice of invoices) {
        const guardian = (invoice.student as any)?.guardianLinks?.[0]?.guardian;
        if (!guardian?.phone) continue;

        await this.prisma.notification.create({
          data: {
            tenantId,
            channel:  'SMS' as any,
            status:   'PENDING' as any,
            body: `Fee reminder: Invoice ${invoice.invoiceNumber} of ₹${invoice.dueAmount} is due on ` +
                  `${new Date(invoice.dueDate).toLocaleDateString('en-IN')}. Please pay promptly.`,
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`[fee-reminders] Error: ${err.message}`);
      throw err;
    }
  }

  // ── attendance-summary ────────────────────────────────────────────────────
  @Process('attendance-summary')
  async handleAttendanceSummary(job: Job<{ tenantId: string; date: string }>) {
    const { tenantId, date } = job.data;
    this.logger.log(`[attendance-summary] tenant:${tenantId} date:${date}`);

    try {
      const d = new Date(date);
      d.setUTCHours(0, 0, 0, 0);

      const [present, absent, late] = await Promise.all([
        this.prisma.attendance.count({ where: { tenantId, date: d, status: 'PRESENT' as any, period: null } }),
        this.prisma.attendance.count({ where: { tenantId, date: d, status: 'ABSENT'  as any, period: null } }),
        this.prisma.attendance.count({ where: { tenantId, date: d, status: 'LATE'    as any, period: null } }),
      ]);

      const total = present + absent + late;
      if (total === 0) return; // School holiday or not yet marked

      const pct = Math.round((present + late * 0.5) / total * 100);
      this.logger.log(`[attendance-summary] tenant:${tenantId} ${pct}% (${present}P/${absent}A/${late}L)`);

      await this.prisma.notification.create({
        data: {
          tenantId,
          channel:  'SMS' as any,
          status:   'PENDING' as any,
          subject:  `Attendance Summary — ${date}`,
          body:     `Today's attendance: ${present} present, ${absent} absent, ${late} late. Overall: ${pct}%.`,
        },
      });
    } catch (err: any) {
      this.logger.error(`[attendance-summary] Error: ${err.message}`);
      throw err;
    }
  }

  // ── student-limit-warning ─────────────────────────────────────────────────
  @Process('student-limit-warning')
  async handleStudentLimitWarning(job: Job<{ tenantId: string; currentCount: number; maxStudents: number }>) {
    const { tenantId, currentCount, maxStudents } = job.data;
    this.logger.warn(`[student-limit-warning] tenant:${tenantId} ${currentCount}/${maxStudents}`);

    try {
      await this.prisma.notification.create({
        data: {
          tenantId,
          channel:  'EMAIL' as any,
          status:   'PENDING' as any,
          subject:  'Student limit approaching — SchoolOS',
          body: `Your school has ${currentCount} students enrolled. ` +
                `Your current plan allows ${maxStudents}. ` +
                `Please upgrade to avoid service interruption.`,
        },
      });
    } catch (err: any) {
      this.logger.error(`[student-limit-warning] Error: ${err.message}`);
    }
  }

  // ── fraud-alert ───────────────────────────────────────────────────────────
  @Process('fraud-alert')
  async handleFraudAlert(job: Job<{ type: string; tenantId: string; alertId: string; severity: string }>) {
    const { tenantId, alertId, severity } = job.data;
    this.logger.warn(`[fraud-alert] alert:${alertId} severity:${severity} tenant:${tenantId}`);
    // In production: POST to Slack/PagerDuty or email superadmin.
    // Handler exists so the job is acknowledged and doesn't stall in Redis.
  }

  // ── domain-event ──────────────────────────────────────────────────────────
  @Process('domain-event')
  async handleDomainEvent(job: Job) {
    this.logger.debug(`[domain-event] ${JSON.stringify(job.data)}`);
    // Handled by MessagingProducer — acknowledge and discard.
  }

  // ── license-expiry-warning ────────────────────────────────────────────────
  @Process('license-expiry-warning')
  async handleLicenseExpiry(job: Job) {
    this.logger.log(`[license-expiry-warning] ${JSON.stringify(job.data)}`);
    // Actual dispatch handled by NotificationProcessor / MessagingProducer.
  }
}
