// backend/src/modules/student-billing/dto/billing.dto.spec.ts
//
// Launch Readiness Review follow-up: "validate paymentMethod against an
// enum matching the five supported [MVP] methods at the DTO layer... not
// left as an assumption resting on staff discipline alone." This is the
// proof that assumption is actually closed, not just decorated -- a
// service-level unit test calling recordOffline() directly bypasses
// class-validator entirely (the ValidationPipe never runs in that path),
// so this exercises validate() directly, the way NestJS's own
// ValidationPipe does under the hood. First test of this kind anywhere in
// this backend (confirmed by search before writing it) -- there was no
// existing convention to match; if a second DTO gains this kind of test,
// consider extracting a small validate-and-expect helper rather than
// duplicating the plainToInstance/validate boilerplate a third time.

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecordOfflinePaymentDto, OfflinePaymentMethod } from './billing.dto';

function baseDto(overrides: Record<string, unknown> = {}) {
  return plainToInstance(RecordOfflinePaymentDto, {
    invoiceId: 'inv-1',
    amount: 1000,
    paymentMethod: 'CASH',
    payerName: 'Parent Name',
    ...overrides,
  });
}

describe('RecordOfflinePaymentDto.paymentMethod -- MVP allowlist', () => {
  it.each(['CASH', 'UPI', 'CARD', 'INSTANT_BANK_TRANSFER'])(
    'accepts %s -- an in-scope MVP counter-collection method',
    async (method) => {
      const errors = await validate(baseDto({ paymentMethod: method }));
      expect(errors).toHaveLength(0);
    },
  );

  it('rejects CHEQUE -- explicitly out of MVP scope (Launch Readiness Review, M13 reclassification)', async () => {
    const errors = await validate(baseDto({ paymentMethod: 'CHEQUE' }));
    expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
  });

  it('rejects DD -- explicitly out of MVP scope', async () => {
    const errors = await validate(baseDto({ paymentMethod: 'DD' }));
    expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
  });

  it('rejects NEFT/generic BANK_TRANSFER -- distinct from the in-scope INSTANT_BANK_TRANSFER, deliberately not aliased to it', async () => {
    const errors = await validate(baseDto({ paymentMethod: 'BANK_TRANSFER' }));
    expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
  });

  it('rejects RAZORPAY -- that flow goes through initiateRazorpay/verifyRazorpay, never recordOffline', async () => {
    const errors = await validate(baseDto({ paymentMethod: 'RAZORPAY' }));
    expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
  });

  it('rejects an arbitrary free-text value -- confirms this is a real allowlist, not permissive free text with cosmetic typing', async () => {
    const errors = await validate(baseDto({ paymentMethod: 'Whatever the counter clerk types' }));
    expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
  });

  it('rejects a missing paymentMethod entirely', async () => {
    const dto = baseDto();
    delete (dto as any).paymentMethod;
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
  });
});
