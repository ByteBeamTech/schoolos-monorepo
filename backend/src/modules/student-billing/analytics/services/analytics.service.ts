import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * P0 FIX: no branch scoping at all. Every other read across this module
   * (invoice findAll/getDefaulters/findById/getStats/findOverdue) filters by
   * authorizedBranchIds per ADR-FEE-002; this dashboard endpoint didn't, so a
   * branch-restricted caller (PRINCIPAL/ACCOUNTANT mapped to one branch) saw
   * tenant-wide financial totals -- a cross-branch data leak within the same
   * tenant. Every sub-query below now takes the same optional branch filter.
   *
   * The late-fee figures here (lateFeeCollected/lateFeeWaived/
   * lateFeeOutstanding) were also structurally wrong before the P0 fix to
   * LateFeeService.allocatePayment()/waiveLateFee(): paidAmount/amountWaived
   * were never written anywhere, so this aggregate always summed zeros. No
   * change needed in the aggregate itself -- it was already summing the
   * right fields, just from data nothing ever populated. It is correct now
   * that those fields are written.
   */
  async getOverview(tenantId: string, authorizedBranchIds?: string[] | null) {
    const branchFilter = authorizedBranchIds != null ? { branchId: { in: authorizedBranchIds } } : {};

    const [
      invoices,
      payments,
      refunds,
      discounts,
      lateFees,
      overdueInvoices,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { tenantId, ...branchFilter },
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
          ...branchFilter,
        },
        _sum: {
          amount: true,
        },
      }),

      this.prisma.refund.aggregate({
        where: {
          tenantId,
          status: 'COMPLETED',
          ...branchFilter,
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
          ...branchFilter,
        },
        _sum: {
          appliedAmount: true,
        },
      }),

      (this.prisma as any).lateFee.aggregate({
        where: {
          tenantId,
          ...branchFilter,
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
          ...branchFilter,
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
