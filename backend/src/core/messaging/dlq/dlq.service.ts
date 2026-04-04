import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue }        from '@nestjs/bull';
import { Queue }              from 'bull';
import { PrismaService } from '@infra/database/prisma.service';

@Injectable()
export class DlqManagerService {
  private readonly logger = new Logger(DlqManagerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly queue: Queue,
  ) {}

  async listFailed(filters: {
    tenantId?: string;
    eventType?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50, ...where } = filters;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      (this.prisma as any).dlqEvent?.findMany({
        where: { ...where, status: 'FAILED' },
        orderBy: { failedAt: 'desc' },
        skip,
        take: limit,
      }).catch(() => []) ?? [],
      (this.prisma as any).dlqEvent?.count({
        where: { ...where, status: 'FAILED' },
      }).catch(() => 0) ?? 0,
    ]);
    return { data, total, page, limit };
  }

  async replay(eventId: string): Promise<void> {
    const event = await (this.prisma as any).dlqEvent?.findUnique({
      where: { id: eventId },
    }).catch(() => null);
    if (!event) return;

    await this.queue.add(event.eventType, event.originalPayload);
    await (this.prisma as any).dlqEvent?.update({
      where: { id: eventId },
      data: { status: 'REPLAYED', replayedAt: new Date() },
    }).catch(() => null);
    this.logger.log(`Replayed DLQ event ${eventId}`);
  }

  async discard(eventId: string): Promise<void> {
    await (this.prisma as any).dlqEvent?.update({
      where: { id: eventId },
      data: { status: 'DISCARDED', discardedAt: new Date() },
    }).catch(() => null);
  }

  async bulkReplay(filter: { eventType?: string; tenantId?: string }): Promise<number> {
    const events = await (this.prisma as any).dlqEvent?.findMany({
      where: { ...filter, status: 'FAILED' },
      take: 100,
    }).catch(() => []) ?? [];
    await Promise.all(events.map((e: any) => this.replay(e.id)));
    return events.length;
  }
}
