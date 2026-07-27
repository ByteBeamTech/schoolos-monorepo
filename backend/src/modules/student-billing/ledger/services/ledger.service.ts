// backend/src/modules/student-billing/ledger/services/ledger.service.ts
//
// M2 (redesigned roadmap): the Ledger's write path. Per C-6
// (FINANCE_ARCHITECTURE_FREEZE_v1.2.md), this is authoritative history,
// not current state -- nothing here computes or returns a balance; every
// aggregate continues to own its own current-state figure independently.
//
// Per §4.9 (frozen decision 29): each event type has exactly ONE posting
// entry point, owned by the milestone that first ships it. A later
// milestone touching the same underlying fact (e.g. M13's PaymentTender
// T2 "tender cleared" transition, which represents the same moment as
// PAYMENT_COMPLETED) MUST call the relevant method below rather than
// issuing its own `prisma.ledger.create(...)`. This class is the
// enforcement mechanism for that rule, not just documentation of it --
// there is deliberately no exported way to write a Ledger row except
// through these named methods.
//
// Per §4.8 (frozen decision 28): each method's parameter shape is the
// frozen contract for that event type. A later milestone MAY extend the
// `metadata` bag; it MUST NOT add new required top-level parameters to an
// existing method, since that would be modifying an already-shipped
// contract rather than appending to it.
//
// Per invariant 12 / IMM-009 / IMM-010: no update method, no delete
// method, no soft-delete field exists anywhere in this file, deliberately.

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { financialYearFor } from '../financial-year.util';

interface RecordPaymentCompletedParams {
  tenantId: string;
  branchId: string;
  studentId?: string | null;
  occurredAt: Date;
  amount: Prisma.Decimal | number | string;
  /** Payment.id -- the record that produced this fact. */
  referenceId: string;
  /** Append-only extension point (§4.8). Never restructure; only add. */
  metadata?: Record<string, unknown>;
}

interface RecordRefundCompletedParams {
  tenantId: string;
  branchId: string;
  studentId?: string | null;
  occurredAt: Date;
  amount: Prisma.Decimal | number | string;
  /** Refund.id -- the record that produced this fact. */
  referenceId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class LedgerService {
  /**
   * The single owner of PAYMENT_COMPLETED. Established here at M2; any
   * later milestone representing the same fact (M13's tender-cleared
   * transition) calls this method rather than writing its own entry.
   *
   * `tx` is REQUIRED, not optional: per R-2, the ledger write MUST occur
   * within the same transaction as the state change that produced it.
   * There is no standalone (non-transactional) variant, deliberately --
   * offering one would make it easy to accidentally violate R-2.
   */
  async recordPaymentCompleted(
    tx: Prisma.TransactionClient,
    params: RecordPaymentCompletedParams,
  ): Promise<void> {
    await tx.ledger.create({
      data: {
        tenantId: params.tenantId,
        branchId: params.branchId,
        studentId: params.studentId ?? null,
        financialYear: financialYearFor(params.occurredAt),
        eventType: 'PAYMENT_COMPLETED',
        amount: params.amount,
        occurredAt: params.occurredAt,
        referenceType: 'Payment',
        referenceId: params.referenceId,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /**
   * The single owner of REFUND_COMPLETED. Same transactional requirement
   * and same reuse rule as recordPaymentCompleted above.
   */
  async recordRefundCompleted(
    tx: Prisma.TransactionClient,
    params: RecordRefundCompletedParams,
  ): Promise<void> {
    await tx.ledger.create({
      data: {
        tenantId: params.tenantId,
        branchId: params.branchId,
        studentId: params.studentId ?? null,
        financialYear: financialYearFor(params.occurredAt),
        eventType: 'REFUND_COMPLETED',
        amount: params.amount,
        occurredAt: params.occurredAt,
        referenceType: 'Refund',
        referenceId: params.referenceId,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  // Deliberately no update(), no delete(), no soft-delete field anywhere
  // in this class. Invariant 12 / IMM-009 / IMM-010 are enforced by this
  // being the only way to touch the table, not by convention alone.
}
