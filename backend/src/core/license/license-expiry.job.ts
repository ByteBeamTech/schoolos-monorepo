import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue }          from '@nestjs/bull';
import { Queue }                from 'bull';
import { PrismaService }        from '../../infra/database/prisma.service';

@Injectable()
export class LicenseExpiryJob {
  private readonly logger = new Logger(LicenseExpiryJob.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notifQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkExpiringLicenses() {
    this.logger.log('Running license expiry check...');

    const licenses = await (this.prisma as any).license?.findMany({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
    }).catch(() => []) ?? [];

    const now = Date.now();
    const WARNING_DAYS = [30, 15, 7, 1];

    for (const license of licenses) {
      const msLeft = new Date(license.expiresAt).getTime() - now;
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      if (WARNING_DAYS.includes(daysLeft)) {
        await this.notifQueue.add('license-expiry-warning', {
          type: 'LicenseExpiryWarning',
          tenantId: license.tenantId,
          licenseId: license.id,
          daysRemaining: daysLeft,
        }).catch(() => null);
        this.logger.log(`Expiry warning: tenant=${license.tenantId} (${daysLeft} days)`);
      }

      if (daysLeft <= 0 && license.status === 'ACTIVE') {
        await (this.prisma as any).license?.update({
          where: { id: license.id },
          data: { status: 'GRACE_PERIOD' },
        }).catch(() => null);
      }

      if (daysLeft <= -7 && license.status === 'GRACE_PERIOD') {
        await (this.prisma as any).license?.update({
          where: { id: license.id },
          data: { status: 'LOCKED' },
        }).catch(() => null);
      }
    }
  }
}
