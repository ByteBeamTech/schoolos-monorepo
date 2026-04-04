// modules/student-billing/late-fee/late-fee.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface LateFeeConfig {
  gracePeriodDays: number;
  penaltyType:     'FLAT' | 'PERCENTAGE';
  penaltyValue:    number;
  maxPenalty?:     number;
  compoundDaily:   boolean;
}

const DEFAULT_CONFIG: LateFeeConfig = {
  gracePeriodDays: 7,
  penaltyType:     'PERCENTAGE',
  penaltyValue:    2,
  maxPenalty:      500,
  compoundDaily:   false,
};

@Injectable()
export class LateFeeService {
  private readonly logger = new Logger(LateFeeService.name);

  constructor(private readonly prisma: PrismaService) {}

  calculateLateFee(
    dueAmount: number,
    dueDate:   Date,
    asOfDate:  Date = new Date(),
    config:    LateFeeConfig = DEFAULT_CONFIG,
  ): { lateFee: number; daysOverdue: number; gracePeriodDays: number; isInGrace: boolean } {
    const msPerDay    = 24 * 60 * 60 * 1000;
    const daysLate    = Math.floor((asOfDate.getTime() - dueDate.getTime()) / msPerDay);
    const daysOverdue = Math.max(0, daysLate - config.gracePeriodDays);
    const isInGrace   = daysLate > 0 && daysOverdue === 0;

    if (daysOverdue === 0) {
      return { lateFee: 0, daysOverdue, gracePeriodDays: config.gracePeriodDays, isInGrace };
    }

    let lateFee = 0;
    if (config.penaltyType === 'FLAT') {
      lateFee = config.compoundDaily ? config.penaltyValue * daysOverdue : config.penaltyValue;
    } else {
      const monthlyRate = config.penaltyValue / 100;
      const dailyRate   = monthlyRate / 30;
      lateFee = config.compoundDaily
        ? dueAmount * (Math.pow(1 + dailyRate, daysOverdue) - 1)
        : dueAmount * monthlyRate * Math.ceil(daysOverdue / 30);
    }

    if (config.maxPenalty !== undefined) lateFee = Math.min(lateFee, config.maxPenalty);
    return { lateFee: Math.round(lateFee * 100) / 100, daysOverdue, gracePeriodDays: config.gracePeriodDays, isInGrace };
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async applyLateFees(): Promise<void> {
    this.logger.log('Running daily late fee calculation...');

    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        status:  { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        dueDate: { lt: new Date() },
      },
      include: { lateFees: { orderBy: { appliedAt: 'desc' }, take: 1 } },
      take: 1000,
    });

    let applied = 0;

    for (const invoice of overdueInvoices) {
      try {
        const dueDate   = new Date(invoice.dueDate);
        const dueAmount = Number(invoice.dueAmount);
        const config    = await this.getTenantConfig(invoice.tenantId);
        const { lateFee, daysOverdue } = this.calculateLateFee(dueAmount, dueDate, new Date(), config);

        if (lateFee <= 0) continue;

        // Check if late fee already applied today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastFee = (invoice as any).lateFees?.[0];
        if (lastFee && new Date(lastFee.appliedAt) >= today) continue;

        // Invoice has no lateFeeAmount field — use LateFee relation model
        await this.prisma.lateFee.create({
          data: {
            tenantId: invoice.tenantId,
            invoiceId:   invoice.id,
            amount:      lateFee,
            daysOverdue,
          },
        });

        // Update invoice dueAmount and totalAmount
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            dueAmount:   dueAmount + lateFee,
            totalAmount: Number(invoice.totalAmount) + lateFee,
            status:      'OVERDUE',
          },
        });

        applied++;
      } catch (err: any) {
        this.logger.error(`Late fee error for invoice ${invoice.id}: ${err.message}`);
      }
    }

    this.logger.log(`Late fees applied to ${applied}/${overdueInvoices.length} invoices`);
  }

  private async getTenantConfig(_tenantId: string): Promise<LateFeeConfig> {
    return DEFAULT_CONFIG;
  }
}
