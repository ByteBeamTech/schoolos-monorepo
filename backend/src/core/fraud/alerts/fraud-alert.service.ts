import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue }        from '@nestjs/bull';
import { Queue }              from 'bull';
import { PrismaService } from '@infra/database/prisma.service';

@Injectable()
export class FraudAlertService {
  private readonly logger = new Logger(FraudAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notifQueue: Queue,
  ) {}

  async raise(data: {
    tenantId: string;
    ruleId: string;
    severity: string;
    description: string;
    evidence: Record<string, unknown>;
  }) {
    const alert = await (this.prisma as any).fraudAlert?.create({
      data: { ...data, status: 'OPEN' },
    }).catch(() => ({ id: 'no-table', ...data, status: 'OPEN' }));

    await this.notifQueue.add('fraud-alert', {
      type: 'FraudAlertRaised',
      tenantId: data.tenantId,
      alertId: alert.id,
      severity: data.severity,
    }).catch(() => null);

    this.logger.warn(`Fraud alert: ${data.description} [${data.severity}] tenant=${data.tenantId}`);
    return alert;
  }

  async resolve(id: string, resolvedBy: string, note: string, isFalsePositive = false) {
    return (this.prisma as any).fraudAlert?.update({
      where: { id },
      data: {
        status: isFalsePositive ? 'FALSE_POSITIVE' : 'RESOLVED',
        resolvedAt: new Date(),
        resolvedNote: note,
        assignedTo: resolvedBy,
      },
    }).catch(() => null);
  }

  async list(filters: { tenantId?: string; status?: string; severity?: string }) {
    return (this.prisma as any).fraudAlert?.findMany({
      where: filters,
      orderBy: { detectedAt: 'desc' },
      take: 100,
    }).catch(() => []) ?? [];
  }
}
