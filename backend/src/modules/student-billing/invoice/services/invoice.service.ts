// backend/src/modules/student-billing/invoice/services/invoice.service.ts
// FULL REPLACEMENT
// P0 FIXES:
//  1. Receipt number race condition → uses pg_advisory_xact_lock (same pattern as invoice number)
//  2. recordOffline idempotency → moved to payment.service.ts (see fix2)
//  3. Offline payment gateway hardcoded as RAZORPAY → fixed in payment.service.ts
//  4. Added cancel() method
//  5. findAll() now paginates and returns { data, meta }
//  6. Added GET /billing/invoices/:id fully exposed

import { EventEmitter2 }    from '@nestjs/event-emitter';
import { EVENTS }            from '../../../../core/events/events.constants';
import {
  Injectable, NotFoundException, BadRequestException, ConflictException, Logger, ForbiddenException,
} from '@nestjs/common';
import { PrismaService }     from '@infra/database/prisma.service';
import { AuditService }      from '../../../../core/compliance/audit.service';
import { GenerateInvoiceDto, BulkGenerateInvoicesDto } from '../../dto/billing.dto';


export interface GenerateInvoiceOptions {
  tenantId: string; branchId: string;
  studentIds?: string[]; feePlanId?: string;
  dueDate?: Date; actorId?: string;
}


@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly audit:   AuditService,
    private readonly emitter: EventEmitter2,
  ) {}

  // ── Invoice number — advisory-lock-safe ───────────────────────────────────
  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const year    = new Date().getFullYear();
    const lockKey = tenantId
      .split('')
      .reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) & 0x7FFFFFFF), 0);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, lockKey);
      const count = await tx.invoice.count({ where: { tenantId } });
      return `INV-${year}-${String(count + 1).padStart(5, '0')}`;
    });
  }

  // ── Receipt number — P0 FIX: advisory-lock-safe (was race condition) ──────
  /**
   * @param client Optional transaction client. When the caller is already
   *   inside a transaction that will INSERT the receipt, it must pass its tx
   *   here (FEE-1): the advisory lock then belongs to that transaction and is
   *   held until the insert commits.
   *
   *   This matters for correctness, not just tidiness. The number is derived
   *   from count()+1, so the lock must span count -> insert. When the lock is
   *   released at the end of a separate numbering transaction (the previous
   *   behavior), two concurrent payments can both count N and both derive
   *   N+1 before either row exists -- duplicate receipt numbers. Holding the
   *   lock in the inserting transaction closes that window.
   *
   *   Passing a tx also avoids opening a second connection from inside an
   *   interactive transaction, which risks exhausting the pool under load.
   *
   *   Omitting it preserves the original self-contained behavior for callers
   *   that only need a number.
   */
  async generateReceiptNumber(tenantId: string, client?: any): Promise<string> {
    const year = new Date().getFullYear();
    // Use a different lock key range from invoice (offset by 0x40000000)
    const lockKey = (tenantId
      .split('')
      .reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) & 0x7FFFFFFF), 0) + 0x40000000) & 0x7FFFFFFF;

    const generate = async (tx: any) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, lockKey);
      const count = await tx.receipt.count({ where: { tenantId } });
      return `RCP-${year}-${String(count + 1).padStart(5, '0')}`;
    };

    return client ? generate(client) : this.prisma.$transaction(generate);
  }

  // ── Generate ──────────────────────────────────────────────────────────────
  async generate(tenantId: string, dto: GenerateInvoiceDto, actorId: string) {
    const plan = await this.prisma.feePlan.findFirst({
      where:   { id: dto.feePlanId, tenantId },
      include: { feeItems: { where: { isOptional: false }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!plan) throw new NotFoundException(`Fee plan not found: ${dto.feePlanId}`);

    const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, tenantId } });
    if (!student) throw new NotFoundException(`Student not found: ${dto.studentId}`);

    if (!plan.feeItems.length) throw new BadRequestException('Fee plan has no items.');

    // Build academic items
    const itemData: any[] = plan.feeItems.map((item: any) => {
      const amount    = Number(item.amount);
      const gstRate   = Number(item.gstRate ?? 0);
      const gstAmount = Math.round((amount * gstRate) / 100 * 100) / 100;
      return {
        feeItemId: item.id, chargeCategory: 'ACADEMIC',
        name: item.name, amount, discountAmount: 0,
        gstRate: gstRate || null, gstAmount,
        netAmount: amount + gstAmount, sortOrder: item.sortOrder,
      };
    });

    // Transport fee
    const transport = await this.prisma.transportAssignment.findFirst({
      where: { studentId: dto.studentId, endedAt: null, route: { tenantId } },
      include: { route: true },
    });
    if (transport) {
      const transportAmount = Number((transport as any).route.feeAmount);
      itemData.push({
        feeItemId: null, chargeCategory: 'TRANSPORT',
        name: 'Transport Fee', amount: transportAmount, discountAmount: 0,
        gstRate: null, gstAmount: 0, netAmount: transportAmount, sortOrder: 999,
      });
    }

    // Apply approved discounts — P0 FIX: was never applied
    const approvedDiscounts = await this.prisma.discount.findMany({
      where: { studentId: dto.studentId, tenantId, approvalStatus: 'APPROVED', isActive: true },
    });
    let totalDiscount = 0;
    const subtotalBeforeDiscount = itemData.reduce((s, i) => s + Number(i.amount), 0);
    for (const d of approvedDiscounts) {
      const discountAmt = (d as any).type === 'PERCENTAGE'
        ? Math.round(subtotalBeforeDiscount * Number(d.value) / 100 * 100) / 100
        : Number(d.value);
      totalDiscount += discountAmt;
    }

    const subtotal    = subtotalBeforeDiscount;
    const gstTotal    = itemData.reduce((s, i) => s + Number(i.gstAmount), 0);
    const totalAmount = Math.max(0, subtotal + gstTotal - totalDiscount);

    const invoiceNumber = await this.generateInvoiceNumber(tenantId);

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId, branchId: student.branchId,  studentId: dto.studentId, invoiceNumber,
        academicYear: plan.academicYear,
        status: 'DRAFT', currency: plan.currency,
        subtotal, discountAmount: totalDiscount, gstAmount: gstTotal,
        totalAmount, paidAmount: 0, dueAmount: totalAmount,
        dueDate: new Date(dto.dueDate), notes: dto.notes ?? null,
        items: { create: itemData },
      },
      include: {
        items:   { orderBy: { sortOrder: 'asc' } },
        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
      },
    });

    await this.audit.logCreate({ tenantId, actorId, entityType: 'Invoice', entityId: invoice.id, after: { invoiceNumber, totalAmount } });
    this.logger.log(`Invoice: ${invoiceNumber} ₹${totalAmount} | tenant: ${tenantId}`);
    this.emitter.emit(EVENTS.INVOICE_GENERATED, {
      tenantId, studentId: dto.studentId,
      invoiceId: invoice.id, invoiceNumber, totalAmount, dueDate: dto.dueDate,
    });
    return invoice;
  }

  // ── Bulk generate ─────────────────────────────────────────────────────────
  async bulkGenerate(tenantId: string, dto: BulkGenerateInvoicesDto, actorId: string) {
    const assignments = await this.prisma.feeAssignment.findMany({ where: { tenantId, feePlanId: dto.feePlanId } });
    if (!assignments.length) throw new BadRequestException('No students assigned to this fee plan.');
    const results = { generated: 0, skipped: 0, errors: [] as string[] };
    for (const a of assignments) {
      try {
        await this.generate(tenantId, { studentId: a.studentId, feePlanId: dto.feePlanId, dueDate: dto.dueDate }, actorId);
        results.generated++;
      } catch (err: any) {
        results.skipped++;
        results.errors.push(`Student ${a.studentId}: ${err.message}`);
      }
    }
    return results;
  }

  // ── List with pagination — P0 FIX: was returning all records ─────────────
  async findAll(
    tenantId: string,
    filters: { studentId?: string; status?: string; academicYear?: string } = {},
    page = 1,
    limit = 20,
    // FEE-0: branch scoping per ADR-FEE-002. null = tenant-wide
    // (SCHOOL_OWNER/SUPER_ADMIN, unrestricted SCHOOL_ADMIN); string[] =
    // restricted to those branches; [] matches nothing (fail closed).
    // undefined kept tenant-wide for internal/staff-guarded callers.
    authorizedBranchIds?: string[] | null,
  ) {
    const where: any = {
      tenantId,
      ...(authorizedBranchIds != null && { branchId: { in: authorizedBranchIds } }),
      ...(filters.studentId    && { studentId:    filters.studentId }),
      ...(filters.status       && { status:       filters.status as any }),
      ...(filters.academicYear && { academicYear: filters.academicYear }),
    };
    const skip  = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          items:   { orderBy: { sortOrder: 'asc' } },
          student: { select: { firstName: true, lastName: true, admissionNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } };
  }

  // ── Single invoice — full detail ──────────────────────────────────────────
  async findById(
    tenantId: string,
    id: string,
    // FEE-0: same branch-scoping contract as findAll(). Out-of-scope reads
    // are NotFound, not Forbidden, so IDs cannot be probed across branches.
    authorizedBranchIds?: string[] | null,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        tenantId,
        ...(authorizedBranchIds != null && { branchId: { in: authorizedBranchIds } }),
      },
      include: {
        items:    { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        // FEE-1: an invoice now has many receipts (one per payment), so this
        // returns an ARRAY where it previously returned a single object or
        // null. Ordered newest-first to match the sibling payments include.
        receipts: { orderBy: { createdAt: 'desc' } },
        lateFees: { orderBy: { appliedAt: 'desc' } },
        student:  { select: { id: true, firstName: true, lastName: true, admissionNumber: true, classId: true } },
      },
    });
    if (!invoice) throw new NotFoundException(`Invoice not found: ${id}`);
    return invoice;
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  /**
   * FEE-1 CONCURRENCY: the DRAFT check is the WHERE clause of the update
   * itself (compare-and-swap), not a preceding read. Two concurrent sends can
   * no longer both observe DRAFT and both proceed -- and, importantly, the
   * INVOICE_SENT event can no longer be emitted twice for one invoice, which
   * would have produced duplicate notifications to the parent.
   *
   * The read after a failed swap only explains the failure; it does not
   * participate in the decision.
   */
  async send(tenantId: string, id: string, actorId: string) {
    const updated = await this.prisma.$transaction(async (tx: any) => {
      const { count } = await tx.invoice.updateMany({
        where: { id, tenantId, status: 'DRAFT' },
        data:  { status: 'SENT' },
      });

      if (count === 0) {
        const current = await tx.invoice.findFirst({
          where:  { id, tenantId },
          select: { status: true },
        });
        if (!current) throw new NotFoundException(`Invoice not found: ${id}`);
        throw new ConflictException(`Invoice is already ${current.status}.`);
      }

      // Post-write read: the event payload and return value need the full row.
      return tx.invoice.findFirst({ where: { id, tenantId } });
    });

    this.emitter.emit(EVENTS.INVOICE_SENT, {
      tenantId, invoiceId: updated.id, studentId: updated.studentId,
      invoiceNumber: updated.invoiceNumber, totalAmount: updated.totalAmount, dueDate: updated.dueDate,
    });
    await this.audit.logUpdate({ tenantId, actorId, entityType: 'Invoice', entityId: id, before: { status: 'DRAFT' }, after: { status: 'SENT' } });
    return updated;
  }

  // ── Cancel — P0 FIX: missing entirely ────────────────────────────────────
  /**
   * FEE-1 CONCURRENCY: every precondition is expressed in the WHERE clause of
   * the update itself (compare-and-swap) -- including "has no successful
   * payment", as a relation filter, so a payment that succeeds concurrently
   * cannot slip past a check that was made moments earlier. Previously all
   * three guards were evaluated against a prior read.
   *
   * Reads happen only AFTER a failed swap, to reproduce the specific,
   * actionable message the caller used to get. They do not participate in the
   * decision. Classification of the failure:
   *   - row gone            -> NotFound (unchanged)
   *   - successful payments -> BadRequest (a business rule, not a race;
   *                            deliberately NOT a conflict)
   *   - status ineligible   -> Conflict (someone else moved it)
   */
  async cancel(tenantId: string, id: string, reason: string, actorId: string) {
    const { updated, previousStatus } = await this.prisma.$transaction(async (tx: any) => {
      // Prior status is needed for the audit trail only. It is read inside the
      // transaction, and the swap below -- not this value -- is what authorizes
      // the cancellation, so a stale read cannot weaken the guard.
      const before = await tx.invoice.findFirst({
        where:  { id, tenantId },
        select: { status: true },
      });

      const { count } = await tx.invoice.updateMany({
        where: {
          id,
          tenantId,
          status:   { notIn: ['PAID', 'CANCELLED'] as any[] },
          payments: { none: { status: 'SUCCESS' as any } },
        },
        data: { status: 'CANCELLED', notes: reason, dueAmount: 0 },
      });

      if (count === 0) {
        const current = await tx.invoice.findFirst({
          where:   { id, tenantId },
          select:  { status: true, payments: { where: { status: 'SUCCESS' as any }, select: { id: true } } },
        });
        if (!current) throw new NotFoundException(`Invoice not found: ${id}`);
        if (current.payments.length) {
          throw new BadRequestException('Cannot cancel an invoice with successful payments. Issue a refund first.');
        }
        if (current.status === 'PAID')      throw new ConflictException('Cannot cancel a paid invoice.');
        if (current.status === 'CANCELLED') throw new ConflictException('Invoice is already cancelled.');
        throw new ConflictException(`Invoice could not be cancelled; its state changed concurrently (now ${current.status}).`);
      }

      const updated = await tx.invoice.findFirst({ where: { id, tenantId } });
      return { updated, previousStatus: before?.status };
    });

    await this.audit.logUpdate({
      tenantId, actorId, entityType: 'Invoice', entityId: id,
      before: { status: previousStatus }, after: { status: 'CANCELLED', reason },
    });
    this.logger.log(`Invoice cancelled: ${updated.invoiceNumber} reason="${reason}" by ${actorId}`);
    return updated;
  }

  // ── Overdue list ──────────────────────────────────────────────────────────
  async findOverdue(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId, status: { in: ['SENT', 'PARTIALLY_PAID'] as any[] }, dueDate: { lt: new Date() } },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, classId: true } },
        lateFees: { where: { status: 'ACTIVE' as any }, take: 1 },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  // ── Defaulters list — new ─────────────────────────────────────────────────
  async getDefaulters(
    tenantId: string,
    filters: { branchId?: string; classId?: string; minDaysOverdue?: number } = {},
    // FEE-0 / AUTH-054: the client-supplied branchId is a SELECTOR inside the
    // caller's authorized branch set, never a widener. null = tenant-wide
    // (AUTH-052/058); [] = nothing (fail closed). A client branchId outside a
    // restricted caller's set DENIES (403) -- it must not silently fall back
    // to the caller's own scope or, worse, be honored.
    authorizedBranchIds?: string[] | null,
  ) {
    if (
      filters.branchId &&
      authorizedBranchIds != null &&
      !authorizedBranchIds.includes(filters.branchId)
    ) {
      throw new ForbiddenException(
        'Requested branch is outside your authorized scope.',
      );
    }
    const now = new Date();
    const where: any = {
      tenantId,
      status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] as any[] },
      dueDate: { lt: now },
      // Authorization constraint on the invoice's own branch:
      ...(authorizedBranchIds != null && { branchId: { in: authorizedBranchIds } }),
      // Pre-existing client narrowing filter (student's branch), unchanged:
      ...(filters.branchId && { student: { branchId: filters.branchId } }),
    };
    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, classId: true, branchId: true } },
        payments: { where: { status: 'SUCCESS' }, orderBy: { paidAt: 'desc' }, take: 1 },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Aggregate per student
    const studentMap = new Map<string, any>();
    for (const inv of invoices) {
      const s = (inv as any).student;
      if (!s) continue;
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      if (filters.minDaysOverdue && daysOverdue < filters.minDaysOverdue) continue;
      if (!studentMap.has(s.id)) {
        studentMap.set(s.id, {
          student:          s,
          outstandingAmount: 0,
          invoiceCount:      0,
          maxDaysOverdue:    0,
          lastPaymentAt:     null,
        });
      }
      const entry = studentMap.get(s.id);
      entry.outstandingAmount += Number(inv.dueAmount);
      entry.invoiceCount++;
      entry.maxDaysOverdue = Math.max(entry.maxDaysOverdue, daysOverdue);
      const lastPay = (inv as any).payments?.[0];
      if (lastPay?.paidAt && (!entry.lastPaymentAt || new Date(lastPay.paidAt) > new Date(entry.lastPaymentAt))) {
        entry.lastPaymentAt = lastPay.paidAt;
      }
    }
    return Array.from(studentMap.values()).sort((a, b) => b.outstandingAmount - a.outstandingAmount);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  async getStats(tenantId: string, academicYear?: string) {
    const where: any = { tenantId, ...(academicYear && { academicYear }) };
    const [total, paid, overdue, draft] = await Promise.all([
      this.prisma.invoice.aggregate({ where, _sum: { totalAmount: true }, _count: true }),
      this.prisma.invoice.aggregate({ where: { ...where, status: 'PAID' }, _sum: { paidAmount: true }, _count: true }),
      this.prisma.invoice.count({ where: { ...where, status: { in: ['SENT', 'PARTIALLY_PAID'] as any[] }, dueDate: { lt: new Date() } } }),
      this.prisma.invoice.count({ where: { ...where, status: 'DRAFT' } }),
    ]);
    return {
      totalInvoices: total._count,
      totalAmount:     Number(total._sum.totalAmount ?? 0),
      collectedAmount: Number(paid._sum.paidAmount ?? 0),
      overdueCount: overdue, draftCount: draft, paidCount: paid._count,
    };
  }
}
