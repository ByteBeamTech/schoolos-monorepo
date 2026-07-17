import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { EmailChannel } from '../channels/email.channel';
import { SmsChannel } from '../channels/sms.channel';
import { WhatsAppChannel } from '../channels/whatsapp.channel';
import { PushChannel } from '../channels/push/push.channel';

import { PrismaService } from '@infra/database/prisma.service';
import { QUEUE_NAMES } from '../../../infra/queue/queue.module';
import { EntitlementResolver } from '@core/license/entitlement-resolver.service';

export interface NotificationJob {
  notificationId: string;
  tenantId: string;
  channel: string;
  to: string;
  subject?: string;
  body: string;
}

// PR-5F: SMS/WhatsApp commercial entitlement is enforced HERE, not in
// NotificationService.send() (the "obvious" entry point) -- audit found
// that event-listener.service.ts injects this same queue directly and
// bypasses NotificationService.send()'s own canSend() gate entirely
// (confirmed via grep: it calls `this.notifQueue.add('send', ...)`
// itself). NotificationProcessor.handleSend() is the canonical outbound
// delivery point for all live SMS and WhatsApp messages -- the only
// place every producer's job converges before a channel's .send() is
// ever called (confirmed via repo-wide grep: SmsChannel/WhatsAppChannel
// have no other callers). One check here covers every current and
// future producer; a check anywhere upstream would not.

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailChannel,
    private readonly sms: SmsChannel,
    private readonly whatsapp: WhatsAppChannel,
    private readonly push: PushChannel,
    private readonly entitlementResolver: EntitlementResolver,
  ) {}

  @Process('send')
  async handleSend(job: Job<NotificationJob>) {
    const { notificationId, tenantId, channel, to, subject, body } = job.data;

    // ───────────────────────────────────────────────────────────
    // Defensive payload validation
    // ───────────────────────────────────────────────────────────

    if (!notificationId) {
      this.logger.error('Missing notificationId in notification job');
      return;
    }

    if (!channel) {
      this.logger.error(`Notification ${notificationId} missing channel`);
      return;
    }

    if (!to) {
      this.logger.error(`Notification ${notificationId} missing recipient`);
      return;
    }

    if (!body || typeof body !== 'string') {
      this.logger.error(`Notification ${notificationId} missing body`);

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'FAILED' as any,
          failReason: 'Notification body missing',
        },
      });

      return;
    }

    this.logger.debug(
      `Processing notification ${notificationId} via ${channel}`,
    );

    let success = false;

    try {
      switch (channel) {
        case 'EMAIL':
          success = await this.email.send({
            to,
            subject: subject ?? 'Message from School',
            body,
          });
          break;

        case 'SMS': {
          // PR-5F: commercial entitlement check. hasFeature() (not
          // assertFeature()) deliberately -- a ForbiddenException must
          // never reach Bull (see class-level comment + PHASE-2 review
          // notes: commercial denial is a business rejection, not an
          // infra failure, and must not be retried).
          const smsAllowed = await this.entitlementResolver.hasFeature(tenantId, 'sms');
          if (!smsAllowed) {
            await this.prisma.notification.update({
              where: { id: notificationId },
              data: {
                status:     'CANCELLED' as any,
                failReason: 'LICENSE_DENIED: SMS not included in current subscription.',
              },
            });
            this.logger.warn(
              `Notification ${notificationId} blocked -- SMS not entitled for tenant ${tenantId}`,
            );
            // Return, do not throw: tells Bull this job completed on the
            // first attempt. Throwing here would trigger the queue's
            // attempts/backoff retry (2-3x per producer) for a
            // deterministic business-rule rejection that will not
            // change on retry -- wasted queue work, and would eventually
            // land in Bull's persisted failed-job set for no reason.
            return;
          }
          success = await this.sms.send({
            to: this.sms.formatPhone(to),
            body,
          });
          break;
        }

        case 'WHATSAPP': {
          const whatsappAllowed = await this.entitlementResolver.hasFeature(tenantId, 'whatsapp');
          if (!whatsappAllowed) {
            await this.prisma.notification.update({
              where: { id: notificationId },
              data: {
                status:     'CANCELLED' as any,
                failReason: 'LICENSE_DENIED: WhatsApp not included in current subscription.',
              },
            });
            this.logger.warn(
              `Notification ${notificationId} blocked -- WhatsApp not entitled for tenant ${tenantId}`,
            );
            return; // same no-throw rationale as the SMS case above
          }
          success = await this.whatsapp.send({
            to: this.sms.formatPhone(to),
            body,
          });
          break;
        }

        case 'PUSH':
          success = await this.push.send({
            to,
            title: subject ?? 'SchoolOS Notification',
            body,
          });
          break;

        default:
          this.logger.warn(`Unknown channel: ${channel}`);
          success = false;
      }

      // ───────────────────────────────────────────────────────────
      // Update notification delivery status
      // ───────────────────────────────────────────────────────────

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: success ? ('SENT' as any) : ('FAILED' as any),
          sentAt: success ? new Date() : null,
          failReason: success
            ? null
            : `Channel ${channel} delivery failed`,
        },
      });

      this.logger.log(
        `Notification ${notificationId} ${
          success ? 'sent' : 'failed'
        } via ${channel} to ${to}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Notification processor error: ${err.message}`,
      );

      // Prevent cascading failure
      if (notificationId) {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: 'FAILED' as any,
            failReason: err.message,
          },
        });
      }

      throw err;
    }
  }
}
