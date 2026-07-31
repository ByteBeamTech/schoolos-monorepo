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

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface RecordAllocationParams {
  tenantId: string;
  branchId: string;
  paymentId: string;
  chargeType: 'INVOICE' | 'LATE_FEE';
  chargeId: string;
  amount: Prisma.Decimal | number | string;
  rule: 'OLDEST_DUE_FIRST' | 'MANUAL';
}

@Injectable()
export class PaymentAllocationService {
  async record(tx: Prisma.TransactionClient, params: RecordAllocationParams): Promise<void> {
    await tx.paymentAllocation.create({
      data: {
        tenantId:   params.tenantId,
        branchId:   params.branchId,
        paymentId:  params.paymentId,
        chargeType: params.chargeType,
        chargeId:   params.chargeId,
        amount:     params.amount,
        rule:       params.rule,
      },
    });
  }
}
