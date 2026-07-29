import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@infra/database/prisma.service';
import { TripService } from './trip.service';

/**
 * AF-004 Daily Trip Generation (background job). For every branch whose
 * TransportSettings.tripGenerationMode is AUTOMATIC (Phase 0.5, AF-002 —
 * "Business rules must not be hardcoded"), materializes Trip rows
 * tripGenerationLeadDays ahead from that branch's active TripSchedules.
 * Branches left on MANUAL mode are untouched here; they use
 * TripController's POST /transport/trips/generate instead.
 *
 * Mirrors OutboxWorker's shape (core/events/... / infra/queue/workers/...)
 * but lives in TransportModule rather than a shared/global module, since
 * this job is Transport-domain-specific, not a generic cross-cutting
 * concern like the EventOutbox processor.
 */
@Injectable()
export class TripGenerationWorker {
  private readonly logger = new Logger(TripGenerationWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tripService: TripService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async run() {
    const automaticBranches = await this.prisma.transportSettings.findMany({
      where: { tripGenerationMode: 'AUTOMATIC' },
      select: { tenantId: true, branchId: true, tripGenerationLeadDays: true },
    });

    if (automaticBranches.length === 0) return;

    this.logger.log({ event: 'TRIP_GENERATION_START', branchCount: automaticBranches.length });

    let totalCreated = 0;
    for (const branch of automaticBranches) {
      try {
        const targetDate = new Date();
        targetDate.setUTCDate(targetDate.getUTCDate() + branch.tripGenerationLeadDays);

        const result = await this.tripService.generateForBranchAndDate(
          branch.tenantId,
          branch.branchId,
          targetDate,
        );
        totalCreated += result.created;
      } catch (err: any) {
        this.logger.error({
          event: 'TRIP_GENERATION_BRANCH_FAILURE',
          tenantId: branch.tenantId,
          branchId: branch.branchId,
          error: err.message,
        });
      }
    }

    this.logger.log({ event: 'TRIP_GENERATION_DONE', totalCreated });
  }
}
