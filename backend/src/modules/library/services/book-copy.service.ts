// ADR-LIB-001 §3/§6/§7/§12 -- BookCopy is the aggregate that owns
// physical state. This service is the ONE place BookCopy.status is
// ever written from -- no other file in this module should call
// `prisma.bookCopy.update({ data: { status: ... } })` directly.

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { BookCopyStatus } from '@prisma/client';
import { AuditService } from '../../../core/compliance/audit.service';

/**
 * ADR-LIB-001 §7 legal transition table. Any (from, to) pair not
 * listed here is illegal and transitionCopyStatus() rejects it --
 * this is what "prevent invalid transitions" means structurally
 * rather than just as a rule someone has to remember.
 *
 * RESERVED_HOLD transitions are defined now (schema/enum already
 * carries the state) but unreachable by any Phase 2 caller -- no
 * Reservation aggregate exists yet (Phase 3). Leaving them in the
 * table is not dead code: it is the ADR's finalized state machine,
 * which Phase 3 wires callers into without touching this table again.
 */
const LEGAL_TRANSITIONS: Record<BookCopyStatus, BookCopyStatus[]> = {
  AVAILABLE:     ['RESERVED_HOLD', 'ISSUED'],
  RESERVED_HOLD: ['ISSUED', 'AVAILABLE'],
  ISSUED:        ['AVAILABLE', 'DAMAGED', 'LOST'],
  DAMAGED:       ['IN_REPAIR', 'DISPOSED'],
  IN_REPAIR:     ['AVAILABLE', 'DISPOSED'],
  LOST:          ['DISPOSED'],
  DISPOSED:      [],
};

export interface TransitionCopyStatusParams {
  tenantId:   string;
  copyId:     string;
  toStatus:   BookCopyStatus;
  actorId:    string;
  actorRole?: string;
  reason?:    string;
}

@Injectable()
export class BookCopyService {
  constructor(private readonly audit: AuditService) {}

  /**
   * Per-copy advisory lock key -- same rolling-hash derivation this
   * codebase already uses for RefundService.lockKeyFor() /
   * LateFeeService.lockKeyFor() (FEE-1's established per-aggregate
   * concurrency primitive). Deliberately the SINGLE-argument
   * `pg_advisory_xact_lock($1)` form, matching every existing call
   * site in this codebase (PaymentService, RefundService, LateFeeService)
   * -- see the TODO in late-fee.service.ts explaining why the
   * two-argument form must not be introduced piecemeal.
   */
  lockKeyForCopy(copyId: string): number {
    return copyId
      .split('')
      .reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) & 0x7fffffff), 0);
  }

  private lockKeyForBarcodeSequence(tenantId: string, branchId: string, year: number): number {
    return `barcode:${tenantId}:${branchId}:${year}`
      .split('')
      .reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) & 0x7fffffff), 0);
  }

  /**
   * The ONLY function in this module allowed to write BookCopy.status.
   * Enforces the ADR §7 legal-transition table and writes an
   * AuditService entry for every transition (ADR §6 -- "every status
   * transition, not just issue/return, must go through the
   * audit-logged transition function"). Must be called from inside an
   * existing transaction (`tx`) that the caller also uses for the rest
   * of its operation (e.g. creating the BookIssue row), and the caller
   * is responsible for holding `lockKeyForCopy`'s advisory lock before
   * calling this for any transition that depends on the copy's
   * CURRENT status (issue/return/lost) -- this function re-reads the
   * row itself, but the lock is what prevents two concurrent callers
   * from both reading the same pre-transition status.
   */
  async transitionCopyStatus(tx: any, params: TransitionCopyStatusParams) {
    const copy = await tx.bookCopy.findFirst({
      where: { id: params.copyId, tenantId: params.tenantId },
    });
    if (!copy) {
      throw new NotFoundException(`Book copy not found: ${params.copyId}`);
    }

    const allowed = LEGAL_TRANSITIONS[copy.status as BookCopyStatus] ?? [];
    if (!allowed.includes(params.toStatus)) {
      throw new BadRequestException(
        `Illegal book copy status transition: ${copy.status} -> ${params.toStatus} (copy ${copy.id}).`,
      );
    }

    const updated = await tx.bookCopy.update({
      where: { id: copy.id },
      data:  { status: params.toStatus },
    });

    await this.audit.logUpdate(
      {
        tenantId:   params.tenantId,
        actorId:    params.actorId,
        actorRole:  params.actorRole,
        entityType: 'BookCopy',
        entityId:   copy.id,
        before:     { status: copy.status },
        after:      { status: updated.status },
        metadata:   params.reason ? { reason: params.reason } : undefined,
      },
      tx,
    );

    return updated;
  }

  /**
   * ADR-LIB-001 §12 -- identical shape to InvoiceSequence /
   * ReceiptSequence (student-billing/sequences.prisma): one row per
   * (tenantId, branchId, year), atomically incremented under an
   * advisory lock. Format: "<BRANCHCODE>-<year>-<6-digit-number>".
   * Must be called from inside the caller's transaction (`tx`) so the
   * lock and the increment commit or roll back together with whatever
   * else the caller is doing (e.g. creating the BookCopy row).
   */
  async generateBarcode(tx: any, tenantId: string, branchId: string): Promise<string> {
    const year = new Date().getFullYear();

    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock($1)`,
      this.lockKeyForBarcodeSequence(tenantId, branchId, year),
    );

    const existing = await tx.barcodeSequence.findFirst({ where: { tenantId, branchId, year } });
    const nextNumber = (existing?.lastNumber ?? 0) + 1;

    if (existing) {
      await tx.barcodeSequence.update({ where: { id: existing.id }, data: { lastNumber: nextNumber } });
    } else {
      await tx.barcodeSequence.create({ data: { tenantId, branchId, year, lastNumber: nextNumber } });
    }

    const branch = await tx.branch.findUnique({ where: { id: branchId }, select: { branchCode: true } });
    const prefix = branch?.branchCode?.trim()
      ? branch.branchCode.trim().toUpperCase()
      : branchId.slice(0, 6).toUpperCase();

    return `${prefix}-${year}-${String(nextNumber).padStart(6, '0')}`;
  }
}
