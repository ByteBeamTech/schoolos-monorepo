// FEE-0: every DiscountController route must carry explicit @Roles (AUTH-041).
// Same tripwire pattern as the invoice/payment controller specs.

import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../../../core/roles/roles.decorator';
import { DiscountController } from './discount.controller';

function routeHandlerNames(controller: any): string[] {
  return Object.getOwnPropertyNames(controller.prototype).filter((name) => {
    if (name === 'constructor') return false;
    const handler = controller.prototype[name];
    return (
      typeof handler === 'function' &&
      (Reflect.getMetadata(PATH_METADATA, handler) !== undefined ||
        Reflect.getMetadata(METHOD_METADATA, handler) !== undefined)
    );
  });
}

describe('DiscountController — explicit @Roles on every route (AUTH-041)', () => {
  const handlers = routeHandlerNames(DiscountController);

  it('discovers the expected route handlers (update deliberately when routes change)', () => {
    expect(handlers.sort()).toEqual(
      ['create', 'findAll', 'getPending', 'findOne', 'approve', 'reject'].sort(),
    );
  });

  it.each(handlers.map((h) => [h]))('%s has non-empty @Roles metadata', (name) => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      DiscountController.prototype[name as keyof DiscountController] as any,
    );
    expect(Array.isArray(roles)).toBe(true);
    expect((roles as string[]).length).toBeGreaterThan(0);
  });

  it('discount reads are staff-only — approval detail is staff-classified (ADR-FEE-001 §7)', () => {
    for (const name of ['findAll', 'findOne'] as const) {
      const roles: string[] = Reflect.getMetadata(ROLES_KEY, DiscountController.prototype[name] as any);
      expect(roles).toEqual(
        expect.arrayContaining(['SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT']),
      );
      expect(roles).not.toContain('PARENT');
      expect(roles).not.toContain('STUDENT');
    }
  });
});
