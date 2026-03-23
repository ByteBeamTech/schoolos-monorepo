import { Injectable, Logger }         from '@nestjs/common';
import { OnEvent }                    from '@nestjs/event-emitter';
import { InjectQueue }                from '@nestjs/bull';
import { Queue }                      from 'bull';
import { PrismaService }              from '../../infra/database/prisma.service';
import { QUEUE_NAMES }                from '../../infra/queue/queue.module';
import { EVENTS }                     from './events.constants';
import {
  PaymentSuccessEvent,
  InvoiceGeneratedEvent,
  AttendanceMarkedEvent,
} from './events.types';

@Injectable()
export class EventListenerService {
  private readonly logger = new Logger(EventListenerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notifQueue: Queue,
  ) {}

  // ── payment.success → send receipt notification ───────────────────────
  @OnEvent(EVENTS.PAYMENT_SUCCESS, { async: true })
  async onPaymentSuccess(evt: PaymentSuccessEvent) {
    this.logger.log(`Event: payment.success | tenant:${evt.tenantId} amount:${evt.amount}`);
    try {
      // Find student's guardian phone/email for receipt notification
      const student = await this.prisma.student.findFirst({
        where:   { id: evt.studentId, tenantId: evt.tenantId },
        include: { guardianLinks: { include: { guardian: true }, where: { isPrimary: true }, take: 1 } },
      });
      const guardian = student?.guardianLinks?.[0]?.guardian;
      if (guardian?.phone) {
        await this.notifQueue.add('send', {
          tenantId: evt.tenantId,
          channel:  'SMS',
          to:       guardian.phone,
          body:     `Payment of ₹${evt.amount} received for ${student?.firstName} ${student?.lastName}. Thank you.`,
        }, { attempts: 3 });
      }
    } catch (err) {
      this.logger.error(`payment.success handler error: ${err}`);
    }
  }

  // ── invoice.generated → update student daily count ────────────────────
  @OnEvent(EVENTS.INVOICE_GENERATED, { async: true })
  async onInvoiceGenerated(evt: InvoiceGeneratedEvent) {
    this.logger.log(`Event: invoice.generated | ${evt.invoiceNumber} ₹${evt.totalAmount}`);
    // Snapshot for analytics — update StudentDailyCount
    try {
      const today = new Date(); today.setUTCHours(0,0,0,0);
      const count = await this.prisma.student.count({ where: { tenantId: evt.tenantId, isActive: true } });
      await this.prisma.studentDailyCount.upsert({
        where:  { tenantId_date: { tenantId: evt.tenantId, date: today } },
        create: { tenantId: evt.tenantId, date: today, count },
        update: { count },
      });
    } catch (err) {
      this.logger.error(`invoice.generated handler error: ${err}`);
    }
  }

  // ── attendance.marked → send absent alerts to guardians ───────────────
  @OnEvent(EVENTS.ATTENDANCE_MARKED, { async: true })
  async onAttendanceMarked(evt: AttendanceMarkedEvent) {
    if (!evt.absentStudentIds.length) return;
    this.logger.log(`Event: attendance.marked | ${evt.absent} absent in section ${evt.sectionId}`);
    try {
      // Queue absent notifications in bulk (max 50 per batch)
      const batch = evt.absentStudentIds.slice(0, 50);
      const students = await this.prisma.student.findMany({
        where:   { id: { in: batch }, tenantId: evt.tenantId },
        include: { guardianLinks: { include: { guardian: true }, where: { isPrimary: true }, take: 1 } },
      });
      for (const student of students) {
        const guardian = student.guardianLinks?.[0]?.guardian;
        if (guardian?.phone) {
          await this.notifQueue.add('send', {
            tenantId: evt.tenantId,
            channel:  'SMS',
            to:       guardian.phone,
            body:     `${student.firstName} ${student.lastName} was marked absent today (${evt.date}).`,
          }, { attempts: 2, delay: 5000 }); // 5s delay to batch
        }
      }
    } catch (err) {
      this.logger.error(`attendance.marked handler error: ${err}`);
    }
  }

  // ── attendance.low → fire fraud alert ─────────────────────────────────
  @OnEvent(EVENTS.ATTENDANCE_LOW, { async: true })
  async onAttendanceLow(payload: { tenantId: string; sectionId: string; date: string; percentage: number }) {
    this.logger.warn(`Event: attendance.low | section:${payload.sectionId} ${payload.percentage}%`);
    try {
      // Check for existing open alert before creating
      const existing = await this.prisma.fraudAlert.findFirst({
        where: { tenantId: payload.tenantId, entityType: 'Section', entityId: payload.sectionId, status: 'OPEN' },
      });
      if (!existing) {
        await this.prisma.fraudAlert.create({
          data: {
            tenantId:    payload.tenantId,
            ruleId:      'LOW_ATTENDANCE',
            ruleName:    'Low Attendance Alert',
            severity:    payload.percentage < 50 ? 'HIGH' : 'MEDIUM',
            entityType:  'Section',
            entityId:    payload.sectionId,
            description: `Attendance dropped to ${payload.percentage}% on ${payload.date}`,
            status:      'OPEN',
          },
        });
      } else {
        await this.prisma.fraudAlert.update({
          where: { id: existing.id },
          data:  { severity: payload.percentage < 50 ? 'HIGH' : 'MEDIUM', description: `Attendance dropped to ${payload.percentage}% on ${payload.date}` },
        });
      }
    } catch (err) {
      this.logger.error(`attendance.low handler error: ${err}`);
    }
  }

  // ── alert.fee.drop → create FraudAlert ────────────────────────────────
  @OnEvent(EVENTS.ALERT_FEE_DROP, { async: true })
  async onFeeDropAlert(payload: { tenantId: string; description: string }) {
    this.logger.warn(`Event: alert.fee.drop | tenant:${payload.tenantId}`);
    try {
      await (this.prisma.fraudAlert as any).upsert({
        where:  { tenantId_entityType_entityId: { tenantId: payload.tenantId, entityType: 'Tenant', entityId: payload.tenantId } },
        create: {
          tenantId:    payload.tenantId,
          alertType:   'FEE_DROP',
          severity:    'MEDIUM',
          entityType:  'Tenant',
          entityId:    payload.tenantId,
          description: payload.description,
          ruleId:      'FEE_DROP_30D',
          ruleName:    'Fee Drop — 30 days',
          status:      'OPEN',
        },
        update: { description: payload.description, status: 'OPEN' },
      });
    } catch (err) { this.logger.error(`alert.fee.drop handler: ${err}`); }
  }

  // ── alert.attendance.drop → create FraudAlert ─────────────────────────
  @OnEvent(EVENTS.ALERT_ATTENDANCE_DROP, { async: true })
  async onAttendanceDropAlert(payload: { tenantId: string; percentage: number; description: string }) {
    this.logger.warn(`Event: alert.attendance.drop | tenant:${payload.tenantId} ${payload.percentage}%`);
    try {
      await (this.prisma.fraudAlert as any).upsert({
        where:  { tenantId_entityType_entityId: { tenantId: payload.tenantId, entityType: 'School', entityId: payload.tenantId } },
        create: {
          tenantId:    payload.tenantId,
          alertType:   'ATTENDANCE_DROP',
          severity:    payload.percentage < 50 ? 'HIGH' : 'MEDIUM',
          entityType:  'School',
          entityId:    payload.tenantId,
          description: payload.description,
          ruleId:      'ATTENDANCE_DROP_70',
          ruleName:    'School-Wide Attendance Drop',
          status:      'OPEN',
        },
        update: { description: payload.description, severity: payload.percentage < 50 ? 'HIGH' as any : 'MEDIUM' as any, status: 'OPEN' },
      });
    } catch (err) { this.logger.error(`alert.attendance.drop handler: ${err}`); }
  }

  // ── tenant.inactive → create FraudAlert ───────────────────────────────
  @OnEvent(EVENTS.TENANT_INACTIVE, { async: true })
  async onTenantInactive(payload: { tenantId: string; name: string; description: string }) {
    this.logger.warn(`Event: tenant.inactive | ${payload.name}`);
    try {
      await (this.prisma.fraudAlert as any).upsert({
        where:  { tenantId_entityType_entityId: { tenantId: payload.tenantId, entityType: 'Tenant', entityId: `inactive_${payload.tenantId}` } },
        create: {
          tenantId:    payload.tenantId,
          alertType:   'INACTIVE_TENANT',
          severity:    'LOW',
          entityType:  'Tenant',
          entityId:    `inactive_${payload.tenantId}`,
          description: payload.description,
          ruleId:      'INACTIVE_7D',
          ruleName:    'Inactive Tenant — 7 days',
          status:      'OPEN',
        },
        update: { description: payload.description, status: 'OPEN' },
      });
    } catch (err) { this.logger.error(`tenant.inactive handler: ${err}`); }
  }

}