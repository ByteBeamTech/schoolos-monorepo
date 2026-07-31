// backend/src/modules/student-billing/allocation/services/payment-allocation.service.ts
//
// M10 (redesigned roadmap): the durable record of where a payment's money
// actually went (C-10). This service does NOT recompute or validate
// crediting arithmetic -- PaymentService.updateInvoice() and
// LateFeeService.allocatePayment() already correctly compute how much
// goes where (oldest-due-first, capped at each target's outstanding
// amount) and update each target's cached balance; this is the shared
// write path both call once they've decided an amount and a target,
// so the record is written consistently rather than each caller
// constructing its own insert.
//
// No domain event: per v1.2 §3.4 (frozen), "no separate PaymentAllocated
// event exists -- allocation and completion are the same moment." The
// PAYMENT_COMPLETED ledger entry (M2) already covers this financial fact.
//
// M11 (redesigned roadmap, C-15): the funding source is now generalized
// (fundingSourceType/fundingSourceId) rather than a bare paymentId --
// callers must be explicit about which source they mean, no implicit
// "assume payment" default, matching how chargeType/chargeId already
// work. STUDENT_ACCOUNT is structurally representable (so M17's
// StudentAccount work doesn't need to reshape this table) but actively
// rejected here: there is no StudentAccount aggregate yet to enforce its
// own ceiling against, and creating an allocation with no real source to
// validate against would be worse than refusing outright.

import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface RecordAllocationParams {
  tenantId: string;
  branchId: string;
  fundingSourceType: 'PAYMENT' | 'STUDENT_ACCOUNT';
  fundingSourceId: string;
  chargeType: 'INVOICE' | 'LATE_FEE';
  chargeId: string;
  amount: Prisma.Decimal | number | string;
  rule: 'OLDEST_DUE_FIRST' | 'MANUAL';
}

@Injectable()
export class PaymentAllocationService {
  async record(tx: Prisma.TransactionClient, params: RecordAllocationParams): Promise<void> {
    if (params.fundingSourceType === 'STUDENT_ACCOUNT') {
      // M17 has not landed -- there is no StudentAccount aggregate to
      // enforce a held-balance ceiling against yet. Reject outright
      // rather than create an allocation with nothing real backing it.
      throw new BadRequestException(
        'STUDENT_ACCOUNT-sourced allocations are not yet supported.',
      );
    }

    await tx.paymentAllocation.create({
      data: {
        tenantId:   params.tenantId,
        branchId:   params.branchId,
        fundingSourceType: params.fundingSourceType,
        fundingSourceId:   params.fundingSourceId,
        // Convenience FK, always populated alongside fundingSourceId for
        // a PAYMENT source -- never the sole reference (M11).
        paymentId:  params.fundingSourceId,
        chargeType: params.chargeType,
        chargeId:   params.chargeId,
        amount:     params.amount,
        rule:       params.rule,
      },
    });
  }
}
