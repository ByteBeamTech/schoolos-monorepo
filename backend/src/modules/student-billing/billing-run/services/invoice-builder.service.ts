// backend/src/modules/student-billing/billing-run/services/invoice-builder.service.ts
//
// Phase 4 (frozen). [BUILD NEW] -- no existing service does this.
// Called once per BillingRunAttempt, inside that attempt's own
// transaction (BillingRunService.execute()). This method does NOT catch
// errors from module providers or its own queries -- letting them
// propagate is what allows the caller to correctly mark the attempt
// FAILED and roll back, per the frozen §7 failure-handling rule.

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InvoiceService } from '../../invoice/services/invoice.service';
import { LedgerService } from '../../ledger/services/ledger.service';
import { FeePlanAssignmentService } from '../../plans/services/fee-plan-assignment.service';
import { resolveClassSectionAsOf } from '../../plans/utils/student-resolution.util';
import { lastDayOfMonth } from '../../plans/utils/billing-period.util';
import { MODULE_CHARGE_PROVIDERS, ModuleChargeProvider } from '../providers/module-charge-provider.interface';

export interface BuildForStudentResult {
  feePlanId: string | null;
  invoiceId: string | null;
}

@Injectable()
export class InvoiceBuilderService {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly ledger: LedgerService,
    private readonly feePlanAssignments: FeePlanAssignmentService,
    @Inject(MODULE_CHARGE_PROVIDERS) private readonly moduleProviders: ModuleChargeProvider[],
  ) {}

  async buildForStudent(
    tenantId: string,
    branchId: string,
    studentId: string,
    periodMonth: number,
    periodYear: number,
    tx: Prisma.TransactionClient,
  ): Promise<BuildForStudentResult> {
    // Class/section AS OF the start of the target period -- per the
    // frozen "do not simply assume the student's current section applies
    // to every historical period" rule. Reuses Phase 3's resolver
    // unchanged.
    const periodDate = new Date(periodYear, periodMonth - 1, 1);
    const { classId, sectionId } = await resolveClassSectionAsOf(tx, tenantId, studentId, periodDate);

    // AcademicSession is tenant-wide (confirmed, no branchId field) --
    // resolving "current" is a tenant-level question, not a branch-level
    // one. Missing entirely is a genuine tenant-wide misconfiguration,
    // not a per-student outcome -- this throws, which will mark every
    // attempt in the run FAILED with the same clear message, making the
    // misconfiguration immediately visible rather than silently skipped.
    const session = await tx.academicSession.findFirst({ where: { tenantId, isCurrent: true } });
    if (!session) throw new Error('No current AcademicSession configured for this tenant.');

    const assignment = await this.feePlanAssignments.resolveForClassSection(
      tenantId, branchId, session.id, classId, sectionId,
    );
    if (!assignment) return { feePlanId: null, invoiceId: null }; // §7: no resolvable plan, a valid outcome

    const plan = await tx.feePlan.findUnique({
      where:   { id: assignment.feePlanId },
      include: { feeItems: { where: { isOptional: false }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!plan) return { feePlanId: assignment.feePlanId, invoiceId: null };

    // Items without a billingRuleId predate Phase 2 or were created
    // outside the new flow -- they have nothing to check billingMonths
    // against, so they are not compatible with BillingRun-driven
    // generation. They remain billable via the pre-existing
    // InvoiceService.generate() path; this engine simply does not
    // consider them.
    const ruleIds = [...new Set(plan.feeItems.map((i) => i.billingRuleId).filter((id): id is string => !!id))];
    const rules = ruleIds.length ? await tx.billingRule.findMany({ where: { id: { in: ruleIds } } }) : [];
    const ruleById = new Map(rules.map((r) => [r.id, r]));

    const dueItems = plan.feeItems.filter((item) => {
      if (!item.billingRuleId) return false;
      const rule = ruleById.get(item.billingRuleId);
      return rule ? rule.billingMonths.includes(periodMonth) : false;
    });

    // Money arithmetic in Decimal end-to-end, matching InvoiceService.
    // generate()'s exact convention -- GST rounded explicitly to 2dp.
    const itemData = dueItems.map((item) => {
      const amount    = new Prisma.Decimal(item.amount);
      const gstRate   = new Prisma.Decimal(item.gstRate ?? 0);
      const gstAmount = amount.times(gstRate).dividedBy(100).toDecimalPlaces(2);
      return {
        feeItemId: item.id, feeHeadId: item.feeHeadId, chargeCategory: 'ACADEMIC',
        name: item.name, amount, discountAmount: new Prisma.Decimal(0),
        gstRate: gstRate.isZero() ? null : gstRate, gstAmount,
        netAmount: amount.plus(gstAmount), sortOrder: item.sortOrder,
      };
    });

    // Module charges. A throw here propagates unchanged -- not caught,
    // per the frozen §7 rule: one module's failure must fail this
    // student's whole attempt (rolled back by the caller's transaction),
    // never silently produce a partial invoice missing that charge.
    for (const provider of this.moduleProviders) {
      const charges = await provider.getCharges(tenantId, branchId, studentId, periodMonth, periodYear, tx);
      for (const charge of charges) {
        const amount = new Prisma.Decimal(charge.amount);
        itemData.push({
          feeItemId: null, feeHeadId: charge.feeHeadId, chargeCategory: 'MODULE',
          name: charge.description, amount, discountAmount: new Prisma.Decimal(0),
          gstRate: null, gstAmount: new Prisma.Decimal(0), netAmount: amount, sortOrder: 999,
        });
      }
    }

    if (!itemData.length) return { feePlanId: assignment.feePlanId, invoiceId: null }; // §7: nothing due, a valid outcome

    // Discounts -- identical query to InvoiceService.generate(), same
    // conventions, not reinterpreted.
    const approvedDiscounts = await tx.discount.findMany({
      where: { studentId, tenantId, approvalStatus: 'APPROVED', isActive: true },
    });
    let totalDiscount = new Prisma.Decimal(0);
    const subtotalBeforeDiscount = itemData.reduce((s, i) => s.plus(i.amount), new Prisma.Decimal(0));
    for (const d of approvedDiscounts) {
      const discountAmt = d.type === 'PERCENTAGE'
        ? subtotalBeforeDiscount.times(new Prisma.Decimal(d.value)).dividedBy(100).toDecimalPlaces(2)
        : new Prisma.Decimal(d.value);
      totalDiscount = totalDiscount.plus(discountAmt);
    }

    const subtotal    = subtotalBeforeDiscount;
    const gstTotal     = itemData.reduce((s, i) => s.plus(i.gstAmount), new Prisma.Decimal(0));
    const totalRaw     = subtotal.plus(gstTotal).minus(totalDiscount);
    const totalAmount  = totalRaw.isNegative() ? new Prisma.Decimal(0) : totalRaw;

    // One due date per invoice (confirmed real constraint: Invoice.dueDate
    // is a single field, not per-item) -- sourced from the first due
    // item's rule, matching the Phase 3 note that resolved this same
    // ambiguity when BillingPeriod moved to branch/session level.
    const primaryRuleId = dueItems[0]?.billingRuleId;
    const primaryRule   = primaryRuleId ? ruleById.get(primaryRuleId) : undefined;
    const dueDay  = Math.min(primaryRule?.dueDayOfMonth ?? 5, lastDayOfMonth(periodYear, periodMonth));
    const dueDate = new Date(periodYear, periodMonth - 1, dueDay);

    // Reused directly, not duplicated -- InvoiceService.generateInvoiceNumber
    // made public specifically for this call.
    const invoiceNumber = await this.invoiceService.generateInvoiceNumber(tenantId, branchId);

    const invoice = await tx.invoice.create({
      data: {
        tenantId, branchId, studentId, invoiceNumber,
        academicYear: plan.academicYear,
        status: 'DRAFT', currency: plan.currency,
        subtotal, discountAmount: totalDiscount, gstAmount: gstTotal,
        totalAmount, paidAmount: new Prisma.Decimal(0), dueAmount: totalAmount,
        dueDate,
        items: { create: itemData },
      },
    });

    // Closes the long-standing InvoiceItem.feeHeadId gap as a side
    // effect of this engine populating it correctly from the start --
    // not a separate fix, per Phase 5's own finding.
    await this.ledger.recordInvoiceIssued(tx, {
      tenantId, branchId, studentId,
      occurredAt: new Date(),
      amount: totalAmount,
      referenceId: invoice.id,
    });

    return { feePlanId: assignment.feePlanId, invoiceId: invoice.id };
  }
}
