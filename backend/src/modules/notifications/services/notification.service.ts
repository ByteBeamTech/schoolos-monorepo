// path: apps/schoolos/backend/src/modules/notifications/services/notification.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue }        from '@nestjs/bull';
import { Queue }              from 'bull';
import { PrismaService }      from '../../../infra/database/prisma.service';
import { QUEUE_NAMES }        from '../../../infra/queue/queue.module';
import { renderTemplate }     from '../templates/notification.templates';
import {
  SendNotificationDto,
  BulkNotificationDto,
  AbsentAlertDto,
  FeeReminderDto,
  NotificationChannel,
} from '../dto/notification.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly queue:  Queue,
  ) {}

  async send(tenantId: string, dto: SendNotificationDto, actorId: string) {
    let to = dto.email ?? dto.phone ?? '';

    if (!to && dto.recipientId) {
      const user = await this.prisma.user.findFirst({
        where:  { id: dto.recipientId, tenantId },
        select: { email: true, phone: true },
      });
      if (user) {
        to = dto.channel === NotificationChannel.EMAIL
          ? (user.email ?? '')
          : (user.phone ?? '');
      }
    }

    if (!to) {
      this.logger.warn(`No contact info for notification — skipping`);
      return { queued: false, reason: 'No contact info found' };
    }

    let subject = dto.subject;
    let body    = dto.body;
    if (dto.templateId && dto.data) {
      const rendered = renderTemplate(dto.templateId, dto.data);
      subject = rendered.subject;
      body    = dto.channel === NotificationChannel.SMS || dto.channel === NotificationChannel.WHATSAPP
        ? rendered.smsBody
        : rendered.body;
    }

    const notification = await this.prisma.notification.create({
      data: {
        tenantId,
        recipientId: dto.recipientId ?? null,
        channel:     dto.channel     as any,
        status:      'PENDING' as any,
        subject:     subject          ?? null,
        body:        body ?? '',
        templateId:  dto.templateId  ?? null,
        data:        dto.data        ?? {},
      },
    });

    await this.queue.add('send', {
      notificationId: notification.id,
      tenantId,
      channel:        dto.channel,
      to,
      subject,
      body,
    }, {
      attempts:         3,
      backoff:          { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail:     false,
    });

    // --- Audit Logging (Async via setImmediate) ---
    setImmediate(async () => {
      try {
        await this.prisma.communicationLog.create({
          data: {
            tenantId,
            initiatedBy:   actorId ?? 'system',
            channel:       dto.channel as any,
            templateId:    dto.templateId ?? null,
            subject:       subject ?? null,
            bodyPreview:   (body ?? '').slice(0, 200),
            recipientType: (dto as any).recipientType ?? 'GUARDIAN',
            recipientId:   dto.recipientId ?? null,
            recipientRef:  to,
            triggerType:   (dto as any).triggerType ?? 'MANUAL',
            status:        'QUEUED',
            queuedAt:      new Date(),
          },
        });
      } catch (err) {
        this.logger.error('CommunicationLog write failed', err);
      }
    });

    this.logger.log(`Notification queued: ${dto.channel} to ${to}`);
    return { queued: true, notificationId: notification.id };
  }

  async sendBulk(tenantId: string, dto: BulkNotificationDto, actorId: string) {
    const results = { queued: 0, skipped: 0 };
    for (const recipientId of dto.recipientIds) {
      try {
        await this.send(tenantId, {
          recipientId,
          channel:    dto.channel,
          templateId: dto.templateId,
          subject:    dto.subject,
          body:       dto.body,
          data:       dto.data,
        }, actorId);
        results.queued++;
      } catch {
        results.skipped++;
      }
    }
    this.logger.log(`Bulk: ${results.queued} queued, ${results.skipped} skipped`);
    return results;
  }

  async sendAbsentAlerts(tenantId: string, dto: AbsentAlertDto, actorId: string) {
    const channel = dto.channel ?? NotificationChannel.WHATSAPP;
    const date    = new Date(dto.date);
    date.setUTCHours(0, 0, 0, 0);

    const absentees = await this.prisma.attendance.findMany({
      where: {
        tenantId,
        date,
        status: 'ABSENT' as any,
        period: null,
        ...(dto.sectionId && { student: { sectionId: dto.sectionId } }),
        ...(dto.studentId && { studentId: dto.studentId }),
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName:  true,
            guardianLinks: {
              where:   { isPrimary: true },
              include: { guardian: { select: { phone: true, email: true } } },
              take:    1,
            },
          },
        },
      },
    });

    const results = { queued: 0, skipped: 0 };
    for (const record of absentees) {
      const guardian = record.student.guardianLinks[0]?.guardian;
      const contact  = channel === NotificationChannel.EMAIL ? guardian?.email : guardian?.phone;
      if (!contact) { results.skipped++; continue; }

      const studentName = `${record.student.firstName} ${record.student.lastName}`;
      const rendered    = renderTemplate('ABSENT_ALERT', { studentName, date: dto.date });

      await this.send(tenantId, {
        channel,
        body:    channel === NotificationChannel.EMAIL ? rendered.body : rendered.smsBody,
        subject: rendered.subject,
        ...(channel === NotificationChannel.EMAIL ? { email: contact } : { phone: contact }),
      }, actorId);
      results.queued++;
    }

    this.logger.log(`Absent alerts: ${results.queued} sent, ${results.skipped} skipped | ${dto.date}`);
    return { ...results, date: dto.date, total: absentees.length };
  }

  async sendArrivalNotifications(tenantId: string, date: string, sectionId: string, actorId: string) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    const records = await this.prisma.attendance.findMany({
      where: {
        tenantId,
        date:   d,
        status: { in: ['PRESENT', 'LATE'] as any[] },
        period: null,
        student: { sectionId },
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName:  true,
            guardianLinks: {
              where:   { isPrimary: true },
              include: { guardian: { select: { phone: true } } },
              take:    1,
            },
          },
        },
      },
    });

    const results = { queued: 0, skipped: 0 };
    const time    = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    for (const record of records) {
      const phone = record.student.guardianLinks[0]?.guardian?.phone;
      if (!phone) { results.skipped++; continue; }

      const studentName = `${record.student.firstName} ${record.student.lastName}`;
      const isLate      = record.status === 'LATE';
      const body        = isLate
        ? `Dear Parent, ${studentName} has arrived at school LATE at ${time} on ${date}.`
        : `Dear Parent, ${studentName} has arrived safely at school at ${time} on ${date}.`;

      await this.send(tenantId, {
        channel: NotificationChannel.WHATSAPP,
        body,
        phone,
      }, actorId);
      results.queued++;
    }

    this.logger.log(`Arrival notifications: ${results.queued} sent | section: ${sectionId} | ${date}`);
    return { ...results, date, sectionId, total: records.length };
  }

  async sendFeeReminders(tenantId: string, dto: FeeReminderDto, actorId: string) {
    const daysBeforeDue = dto.daysBeforeDue ?? 3;
    const targetDate    = new Date();
    targetDate.setDate(targetDate.getDate() + daysBeforeDue);
    targetDate.setUTCHours(23, 59, 59, 999);
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        academicYear: dto.academicYear,
        status:       { in: ['SENT', 'PARTIALLY_PAID'] as any[] },
        dueDate:      { gte: startOfDay, lte: targetDate },
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName:  true,
            guardianLinks: {
              where:   { isPrimary: true },
              include: { guardian: { select: { phone: true } } },
              take:    1,
            },
          },
        },
      },
    });

    const results = { queued: 0, skipped: 0 };
    for (const invoice of invoices) {
      const phone = invoice.student.guardianLinks[0]?.guardian?.phone;
      if (!phone) { results.skipped++; continue; }

      const studentName = `${invoice.student.firstName} ${invoice.student.lastName}`;
      const rendered    = renderTemplate('FEE_REMINDER', {
        studentName,
        invoiceNumber: invoice.invoiceNumber,
        amount:        `₹${Number(invoice.dueAmount).toLocaleString('en-IN')}`,
        dueDate:       invoice.dueDate.toLocaleDateString('en-IN'),
        daysLeft:      String(daysBeforeDue),
      });

      await this.send(tenantId, {
        channel: NotificationChannel.WHATSAPP,
        body:    rendered.smsBody,
        phone,
      }, actorId);
      results.queued++;
    }

    this.logger.log(`Fee reminders: ${results.queued} sent, ${results.skipped} skipped`);
    return { ...results, invoiceCount: invoices.length, daysBeforeDue };
  }

  async findAll(tenantId: string, filters: any = {}) {
    return this.prisma.notification.findMany({
      where: {
        tenantId,
        ...(filters.recipientId && { recipientId: filters.recipientId }),
        ...(filters.channel     && { channel:     filters.channel as any }),
        ...(filters.status      && { status:      filters.status  as any }),
      },
      orderBy: { createdAt: 'desc' },
      take:    100,
    });
  }

  async getStats(tenantId: string) {
    const [total, sent, failed, pending] = await Promise.all([
      this.prisma.notification.count({ where: { tenantId } }),
      this.prisma.notification.count({ where: { tenantId, status: 'SENT'    as any } }),
      this.prisma.notification.count({ where: { tenantId, status: 'FAILED'  as any } }),
      this.prisma.notification.count({ where: { tenantId, status: 'PENDING' as any } }),
    ]);
    return { total, sent, failed, pending, deliveryRate: total > 0 ? Math.round(sent / total * 100) : 0 };
  }
}
