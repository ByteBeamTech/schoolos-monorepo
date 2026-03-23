import { Process, Processor } from '@nestjs/bull';
import { Logger }             from '@nestjs/common';
import { Job }                from 'bull';
import { EmailChannel }       from '../channels/email.channel';
import { SmsChannel }         from '../channels/sms.channel';
import { WhatsAppChannel }    from '../channels/whatsapp.channel';
import { PrismaService }      from '../../../infra/database/prisma.service';
import { QUEUE_NAMES }        from '../../../infra/queue/queue.module';

export interface NotificationJob {
  notificationId: string;
  tenantId:       string;
  channel:        string;
  to:             string;  // email or phone
  subject?:       string;
  body:           string;
}

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly email:      EmailChannel,
    private readonly sms:        SmsChannel,
    private readonly whatsapp:   WhatsAppChannel,
  ) {}

  @Process('send')
  async handleSend(job: Job<NotificationJob>) {
    const { notificationId, channel, to, subject, body } = job.data;
    this.logger.debug(`Processing notification ${notificationId} via ${channel}`);

    let success = false;

    try {
      switch (channel) {
        case 'EMAIL':
          success = await this.email.send({ to, subject: subject ?? 'Message from School', body });
          break;
        case 'SMS':
          success = await this.sms.send({ to: this.sms.formatPhone(to), body });
          break;
        case 'WHATSAPP':
          success = await this.whatsapp.send({ to: this.sms.formatPhone(to), body });
          break;
        default:
          this.logger.warn(`Unknown channel: ${channel}`);
          success = false;
      }

      // Update notification status in DB
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status:  success ? 'SENT' as any : 'FAILED' as any,
          sentAt:  success ? new Date() : null,
          failReason: success ? null : `Channel ${channel} delivery failed`,
        },
      });

      this.logger.log(
        `Notification ${notificationId} ${success ? 'sent' : 'failed'} via ${channel} to ${to}`,
      );
    } catch (err: any) {
      this.logger.error(`Notification processor error: ${err.message}`);
      await this.prisma.notification.update({
        where: { id: notificationId },
        data:  { status: 'FAILED' as any, failReason: err.message },
      });
      throw err; // Rethrow so BullMQ can retry
    }
  }
}
