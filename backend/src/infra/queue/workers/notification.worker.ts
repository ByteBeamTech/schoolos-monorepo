// infra/queue/workers/notification.worker.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger }             from '@nestjs/common';
import { Job }                from 'bull';
import { QUEUE_NAMES }        from '../queue.module';
import { PrismaService } from '@infra/database/prisma.service';

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('send')
  async handleSend(job: Job) {
    const { notificationId, tenantId, channel, to, subject, body } = job.data;
    this.logger.debug(`[NotificationWorker] ${channel} → ${to} (job ${job.id})`);

    try {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data:  { status: 'SENT', sentAt: new Date() },
      });
      this.logger.log(`Notification ${notificationId} marked SENT`);
    } catch (err: any) {
      this.logger.error(`Failed to update notification ${notificationId}: ${err.message}`);
      throw err; // Bull will retry
    }
  }

  @Process('license-expiry-warning')
  async handleLicenseExpiry(job: Job) {
    this.logger.log(`[NotificationWorker] License expiry warning: ${JSON.stringify(job.data)}`);
    // Dispatch handled by NotificationProcessor — this worker records it
  }
}
