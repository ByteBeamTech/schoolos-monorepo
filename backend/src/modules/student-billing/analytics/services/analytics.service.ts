import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getOverview(tenantId: string) {
    const [
      invoices,
      payments,
      refunds,
      discounts,
      lateFees,
      overdueInvoices,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { tenantId },
        _sum: {
          totalAmount: true,
          paidAmount: true,
          dueAmount: true,
        },
      }),

      this.prisma.payment.aggregate({
        where: {
          tenantId,
          status: 'SUCCESS',
        },
        _sum: {
          amount: true,
        },
      }),

      this.prisma.refund.aggregate({
        where: {
          tenantId,
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),

      this.prisma.discount.aggregate({
        where: {
          tenantId,
          isActive: true,
          approvalStatus: 'APPROVED',
        },
        _sum: {
          appliedAmount: true,
        },
      }),

      (this.prisma as any).lateFee.aggregate({
        where: {
          tenantId,
        },
        _sum: {
          amount: true,
          paidAmount: true,
          amountWaived: true,
        },
      }),

      this.prisma.invoice.count({
        where: {
          tenantId,
          status: 'OVERDUE',
        },
      }),
    ]);

    const totalInvoiced =
      Number(invoices._sum.totalAmount ?? 0);

    const totalCollected =
      Number(payments._sum.amount ?? 0);

    const outstanding =
      Number(invoices._sum.dueAmount ?? 0);

    const collectionRate =
      totalInvoiced > 0
        ? (totalCollected / totalInvoiced) * 100
        : 0;

    const lateFeeApplied =
      Number(lateFees._sum.amount ?? 0);

    const lateFeeCollected =
      Number(lateFees._sum.paidAmount ?? 0);

    const lateFeeWaived =
      Number(lateFees._sum.amountWaived ?? 0);

    const lateFeeOutstanding =
      lateFeeApplied -
      lateFeeCollected -
      lateFeeWaived;

    return {
      totalInvoiced,
      totalCollected,
      outstanding,
      collectionRate:

        Math.round(collectionRate * 100) / 100,

      lateFeeApplied,
      lateFeeCollected,
      lateFeeWaived,
      lateFeeOutstanding,

      discountsGiven:
        Number(
          discounts._sum.appliedAmount ?? 0,
        ),

      refundsIssued:
        Number(
          refunds._sum.amount ?? 0,
        ),

      overdueInvoices,
    };
  }
}
