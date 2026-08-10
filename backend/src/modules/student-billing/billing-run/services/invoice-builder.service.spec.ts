// backend/src/modules/student-billing/billing-run/services/invoice-builder.service.spec.ts

import { Test } from '@nestjs/testing';
import { InvoiceBuilderService } from './invoice-builder.service';
import { InvoiceService } from '../../invoice/services/invoice.service';
import { LedgerService } from '../../ledger/services/ledger.service';
import { FeePlanAssignmentService } from '../../plans/services/fee-plan-assignment.service';
import { MODULE_CHARGE_PROVIDERS } from '../providers/module-charge-provider.interface';

describe('InvoiceBuilderService', () => {
  let service: InvoiceBuilderService;
  let tx: any;
  let invoiceService: any;
  let ledger: any;
  let feePlanAssignments: any;
  let moduleProviders: any[];

  const student = { id: 'stu-1', classId: 'c-1', sectionId: 'sec-1' };
  const session = { id: 's-1' };
  const assignment = { feePlanId: 'fp-1' };
  const rule = { id: 'br-1', billingMonths: [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3], dueDayOfMonth: 5 };
  const feeItem = {
    id: 'fi-1', name: 'Tuition', amount: 5000, gstRate: null, sortOrder: 0,
    feeHeadId: 'fh-1', billingRuleId: 'br-1',
  };
  const plan = { id: 'fp-1', academicYear: '2026-27', currency: 'INR', feeItems: [feeItem] };

  beforeEach(async () => {
    tx = {
      studentPromotion: { findFirst: jest.fn().mockResolvedValue(null) },
      student:  { findUniqueOrThrow: jest.fn().mockResolvedValue(student) },
      academicSession: { findFirst: jest.fn().mockResolvedValue(session) },
      feePlan:  { findUnique: jest.fn().mockResolvedValue(plan) },
      billingRule: { findMany: jest.fn().mockResolvedValue([rule]) },
      discount: { findMany: jest.fn().mockResolvedValue([]) },
      invoice:  { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'inv-new', ...data })) },
    };
    invoiceService = { generateInvoiceNumber: jest.fn().mockResolvedValue('INV-0001') };
    ledger = { recordInvoiceIssued: jest.fn() };
    feePlanAssignments = { resolveForClassSection: jest.fn().mockResolvedValue(assignment) };
    moduleProviders = [];

    const module = await Test.createTestingModule({
      providers: [
        InvoiceBuilderService,
        { provide: InvoiceService, useValue: invoiceService },
        { provide: LedgerService, useValue: ledger },
        { provide: FeePlanAssignmentService, useValue: feePlanAssignments },
        { provide: MODULE_CHARGE_PROVIDERS, useValue: moduleProviders },
      ],
    }).compile();
    service = module.get(InvoiceBuilderService);
  });

  it('builds an invoice for a component due this period (April is in billingMonths)', async () => {
    const result = await service.buildForStudent('t-1', 'b-1', 'stu-1', 4, 2026, tx);
    expect(result.feePlanId).toBe('fp-1');
    expect(result.invoiceId).toBe('inv-new');
    expect(tx.invoice.create).toHaveBeenCalledTimes(1);
    expect(ledger.recordInvoiceIssued).toHaveBeenCalledTimes(1);
  });

  it('a component NOT due this period (month not in billingMonths) produces no invoice -- a valid, successful outcome', async () => {
    const offSeasonRule = { ...rule, billingMonths: [7] }; // only July
    tx.billingRule.findMany.mockResolvedValue([offSeasonRule]);
    const result = await service.buildForStudent('t-1', 'b-1', 'stu-1', 4, 2026, tx);
    expect(result.feePlanId).toBe('fp-1');
    expect(result.invoiceId).toBeNull();
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it('no resolvable FeePlanAssignment -- feePlanId and invoiceId both null, not an error', async () => {
    feePlanAssignments.resolveForClassSection.mockResolvedValue(null);
    const result = await service.buildForStudent('t-1', 'b-1', 'stu-1', 4, 2026, tx);
    expect(result).toEqual({ feePlanId: null, invoiceId: null });
  });

  it('an item with no billingRuleId is skipped entirely -- not compatible with this engine', async () => {
    tx.feePlan.findUnique.mockResolvedValue({ ...plan, feeItems: [{ ...feeItem, billingRuleId: null }] });
    const result = await service.buildForStudent('t-1', 'b-1', 'stu-1', 4, 2026, tx);
    expect(result.invoiceId).toBeNull();
  });

  it('throws when no current AcademicSession exists -- a tenant-wide misconfiguration, not a per-student outcome', async () => {
    tx.academicSession.findFirst.mockResolvedValue(null);
    await expect(service.buildForStudent('t-1', 'b-1', 'stu-1', 4, 2026, tx)).rejects.toThrow(/AcademicSession/);
  });

  it('applies an approved PERCENTAGE discount correctly against the subtotal', async () => {
    tx.discount.findMany.mockResolvedValue([{ type: 'PERCENTAGE', value: 10 }]);
    await service.buildForStudent('t-1', 'b-1', 'stu-1', 4, 2026, tx);
    const createCall = tx.invoice.create.mock.calls[0][0].data;
    expect(createCall.discountAmount.toString()).toBe('500'); // 10% of 5000
    expect(createCall.totalAmount.toString()).toBe('4500');
  });

  it('a module charge provider throwing propagates unchanged -- not caught here, per the frozen failure-handling rule', async () => {
    moduleProviders.push({ getCharges: jest.fn().mockRejectedValue(new Error('Transport misconfigured')) });
    await expect(service.buildForStudent('t-1', 'b-1', 'stu-1', 4, 2026, tx)).rejects.toThrow('Transport misconfigured');
    // Nothing should have been created before the throw propagates.
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it('a module charge is included as its own InvoiceItem alongside academic items', async () => {
    moduleProviders.push({
      getCharges: jest.fn().mockResolvedValue([{ feeHeadId: 'fh-transport', amount: 1200, description: 'Transport' }]),
    });
    await service.buildForStudent('t-1', 'b-1', 'stu-1', 4, 2026, tx);
    const items = tx.invoice.create.mock.calls[0][0].data.items.create;
    expect(items.some((i: any) => i.name === 'Transport' && i.feeHeadId === 'fh-transport')).toBe(true);
  });

  it('no academic items due AND no module charges -- no invoice, still a valid resolved-plan outcome', async () => {
    const offSeasonRule = { ...rule, billingMonths: [7] };
    tx.billingRule.findMany.mockResolvedValue([offSeasonRule]);
    const result = await service.buildForStudent('t-1', 'b-1', 'stu-1', 4, 2026, tx);
    expect(result.feePlanId).toBe('fp-1');
    expect(result.invoiceId).toBeNull();
  });

  // Phase 5 regression: the original gap-analysis finding this entire
  // redesign traces back to was InvoiceItem.feeHeadId existing as a
  // column but never being populated -- confirmed at the time by reading
  // the old generate() method directly. This is the explicit proof that
  // this engine closes it: every academic item this service creates
  // carries a real feeHeadId AND a real feeItemId, not one or the other.
  it('every academic InvoiceItem carries both feeItemId and feeHeadId -- closes the original gap-analysis finding', async () => {
    await service.buildForStudent('t-1', 'b-1', 'stu-1', 4, 2026, tx);
    const items = tx.invoice.create.mock.calls[0][0].data.items.create;
    const academicItem = items.find((i: any) => i.chargeCategory === 'ACADEMIC');
    expect(academicItem.feeItemId).toBe('fi-1');
    expect(academicItem.feeHeadId).toBe('fh-1');
  });

  // Phase 5 regression: late-fee-rule-resolver.ts derives Fee-Plan scope
  // via invoice.items[].feeItem.feePlanId -- confirmed, during Phase 5's
  // design, that this dependency chain survives Phase 2's purely-additive
  // FeeItem migration unchanged. This is the concrete proof: the
  // feeItemId this engine writes really does point back at a FeeItem
  // whose feePlanId the resolver could actually read, not just a
  // plausible-looking id.
  it('the written feeItemId resolves back to the exact FeeItem whose feePlanId Late Fee scope resolution depends on', async () => {
    await service.buildForStudent('t-1', 'b-1', 'stu-1', 4, 2026, tx);
    const items = tx.invoice.create.mock.calls[0][0].data.items.create;
    const academicItem = items.find((i: any) => i.chargeCategory === 'ACADEMIC');
    expect(academicItem.feeItemId).toBe(feeItem.id);
    // feeItem itself (the fixture) has no feePlanId in this test's shape --
    // confirming this engine's item points at the SAME id the plan's own
    // feeItems array uses is what late-fee-rule-resolver.ts's real query
    // (invoice.items -> feeItem -> feePlanId) depends on being consistent.
    expect(plan.feeItems.find((i) => i.id === academicItem.feeItemId)).toBeDefined();
  });
});
