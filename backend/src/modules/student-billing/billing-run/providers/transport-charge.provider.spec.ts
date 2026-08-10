// backend/src/modules/student-billing/billing-run/providers/transport-charge.provider.spec.ts

import { Test } from '@nestjs/testing';
import { TransportChargeProvider } from './transport-charge.provider';

describe('TransportChargeProvider', () => {
  let provider: TransportChargeProvider;
  let tx: any;

  beforeEach(async () => {
    tx = {
      transportAssignment: { findFirst: jest.fn() },
      feeHead: { findFirst: jest.fn().mockResolvedValue({ id: 'fh-transport' }) },
    };
    const module = await Test.createTestingModule({ providers: [TransportChargeProvider] }).compile();
    provider = module.get(TransportChargeProvider);
  });

  it('returns [] when the student has no active transport assignment this period -- not an error', async () => {
    tx.transportAssignment.findFirst.mockResolvedValue(null);
    const charges = await provider.getCharges('t-1', 'b-1', 'stu-1', 4, 2026, tx);
    expect(charges).toEqual([]);
  });

  it('returns a real charge, resolving the FeeHead by stable code, not a hardcoded id', async () => {
    tx.transportAssignment.findFirst.mockResolvedValue({ route: { feeAmount: 1500, name: 'Route A' } });
    const charges = await provider.getCharges('t-1', 'b-1', 'stu-1', 4, 2026, tx);
    expect(charges).toEqual([{ feeHeadId: 'fh-transport', amount: 1500, description: 'Transport (Route A)' }]);
    expect(tx.feeHead.findFirst).toHaveBeenCalledWith({ where: { tenantId: 't-1', branchId: 'b-1', code: 'TRANSPORT' } });
  });

  it('throws (a genuine failure, not an empty result) when no Transport FeeHead is configured for this branch', async () => {
    tx.transportAssignment.findFirst.mockResolvedValue({ route: { feeAmount: 1500, name: 'Route A' } });
    tx.feeHead.findFirst.mockResolvedValue(null);
    await expect(provider.getCharges('t-1', 'b-1', 'stu-1', 4, 2026, tx)).rejects.toThrow(/TRANSPORT/);
  });

  it('queries with a date range covering the whole target month, not just a point-in-time check', async () => {
    tx.transportAssignment.findFirst.mockResolvedValue(null);
    await provider.getCharges('t-1', 'b-1', 'stu-1', 4, 2026, tx);
    const where = tx.transportAssignment.findFirst.mock.calls[0][0].where;
    expect(where.assignedAt.lte).toEqual(new Date(2026, 3, 30, 23, 59, 59, 999));
  });
});
