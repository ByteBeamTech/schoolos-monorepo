import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue }          from '@nestjs/bull';
import { Queue }                from 'bull';
import { PrismaService } from '@infra/database/prisma.service';

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

    let licenses;
    try {
      licenses = await this.prisma.license.findMany({
        where: { status: { in: ['ACTIVE'] } },
      });
    } catch (err) {
      this.logger.error(
        `License expiry check failed to fetch licenses: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }

    const now = Date.now();
    const WARNING_DAYS = [30, 15, 7, 1];

    for (const license of licenses) {
      try {
        const msLeft = new Date(license.expiresAt).getTime() - now;
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

        if (WARNING_DAYS.includes(daysLeft)) {
          await this.notifQueue.add('license-expiry-warning', {
            type: 'LicenseExpiryWarning',
            tenantId: license.tenantId,
            licenseId: license.id,
            daysRemaining: daysLeft,
          });
          this.logger.log(`Expiry warning: tenant=${license.tenantId} (${daysLeft} days)`);
        }

        // NOTE (PR-1): the original code here transitioned ACTIVE -> GRACE_PERIOD
        // -> LOCKED, but neither status exists on the LicenseStatus enum
        // (UNUSED | ACTIVE | EXPIRED | REVOKED | PENDING_ACTIVATION) — this only
        // compiled before because of the `as any` cast removed in this PR. Grace
        // period is a real product requirement (see ADR COMM-006) but adding it
        // requires a schema migration, which is out of scope for a cleanup PR.
        // Collapsing to the nearest valid status (EXPIRED) for now; proper grace/
        // locked lifecycle belongs in PR-4 (License Builder) alongside its schema change.
        if (daysLeft <= 0 && license.status === 'ACTIVE') {
          await this.prisma.license.update({
            where: { id: license.id },
            data: { status: 'EXPIRED' },
          });
        }
      } catch (err) {
        this.logger.error(
          `License expiry processing failed for license ${license.id} (tenant ${license.tenantId}): ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }
}
