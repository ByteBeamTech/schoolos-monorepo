// backend/src/modules/student-billing/allocation/services/payment-allocation.service.spec.ts
import { PaymentAllocationService } from './payment-allocation.service';

describe('PaymentAllocationService', () => {
  let service: PaymentAllocationService;
  let tx: any;

  beforeEach(() => {
    service = new PaymentAllocationService();
    tx = { paymentAllocation: { create: jest.fn().mockResolvedValue({}) } };
  });

  it('writes chargeType/chargeId/amount/rule exactly as given, targeting an invoice', async () => {
    await service.record(tx, {
      tenantId: 't-1', branchId: 'b-1', paymentId: 'pay-1',
      chargeType: 'INVOICE', chargeId: 'inv-1', amount: 5000, rule: 'OLDEST_DUE_FIRST',
    });

    expect(tx.paymentAllocation.create).toHaveBeenCalledWith({
      data: {
        tenantId: 't-1', branchId: 'b-1', paymentId: 'pay-1',
        chargeType: 'INVOICE', chargeId: 'inv-1', amount: 5000, rule: 'OLDEST_DUE_FIRST',
      },
    });
  });

  it('writes a LATE_FEE-targeted allocation identically, differing only by chargeType/chargeId', async () => {
    await service.record(tx, {
      tenantId: 't-1', branchId: 'b-1', paymentId: 'pay-1',
      chargeType: 'LATE_FEE', chargeId: 'lf-1', amount: 250, rule: 'OLDEST_DUE_FIRST',
    });

    const written = tx.paymentAllocation.create.mock.calls[0][0].data;
    expect(written.chargeType).toBe('LATE_FEE');
    expect(written.chargeId).toBe('lf-1');
  });

  it('writes through the given transaction client, not a fresh connection', async () => {
    const otherTx = { paymentAllocation: { create: jest.fn().mockResolvedValue({}) } };

    await service.record(tx, {
      tenantId: 't-1', branchId: 'b-1', paymentId: 'pay-1',
      chargeType: 'INVOICE', chargeId: 'inv-1', amount: 100, rule: 'MANUAL',
    });

    expect(tx.paymentAllocation.create).toHaveBeenCalledTimes(1);
    expect(otherTx.paymentAllocation.create).not.toHaveBeenCalled();
  });
});
