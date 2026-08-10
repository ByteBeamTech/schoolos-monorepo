// backend/src/modules/student-billing/billing-run/providers/transport-charge.provider.ts
//
// Phase 4 (frozen). [REUSE EXISTING] TransportAssignment/TransportRoute,
// confirmed real, unchanged -- this is an adapter only, [BUILD NEW].

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ModuleCharge, ModuleChargeProvider } from './module-charge-provider.interface';

@Injectable()
export class TransportChargeProvider implements ModuleChargeProvider {
  private readonly logger = new Logger(TransportChargeProvider.name);

  async getCharges(
    tenantId: string,
    branchId: string,
    studentId: string,
    periodMonth: number,
    periodYear: number,
    tx: Prisma.TransactionClient,
  ): Promise<ModuleCharge[]> {
    const periodStart = new Date(periodYear, periodMonth - 1, 1);
    const periodEnd   = new Date(periodYear, periodMonth, 0, 23, 59, 59, 999); // last instant of the month

    const assignment = await tx.transportAssignment.findFirst({
      where: {
        studentId,
        route: { tenantId },
        assignedAt: { lte: periodEnd },
        OR: [{ endedAt: null }, { endedAt: { gte: periodStart } }],
      },
      include: { route: true },
    });
    if (!assignment) return [];

    // Resolved by stable code, not a hardcoded id -- FeeHead is
    // tenant-scoped, so a fixed constant id could never be correct
    // across tenants. A missing Transport FeeHead is a genuine
    // configuration failure, not a "nothing to charge" case -- this
    // throws rather than returning [], per the interface contract.
    const feeHead = await tx.feeHead.findFirst({ where: { tenantId, branchId, code: 'TRANSPORT' } });
    if (!feeHead) {
      throw new Error(`No FeeHead with code 'TRANSPORT' configured for this branch -- cannot charge Transport fees.`);
    }

    return [{
      feeHeadId:   feeHead.id,
      amount:      Number(assignment.route.feeAmount),
      description: `Transport (${assignment.route.name})`,
    }];
  }
}
