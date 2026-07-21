// FEE-0 (Security Hardening): every PaymentController route must carry
// explicit @Roles metadata (AUTH-041 — decorator absence means RolesGuard
// admits any authenticated user). Same tripwire pattern as
// invoice.controller.authz.spec.ts.

import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../../../core/roles/roles.decorator';
import { PaymentController } from './payment.controller';

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

describe('PaymentController — explicit @Roles on every route (AUTH-041)', () => {
  const handlers = routeHandlerNames(PaymentController);

  it('discovers the expected route handlers (update deliberately when routes change)', () => {
    expect(handlers.sort()).toEqual(
      ['initiate', 'verify', 'recordOffline', 'getHistory'].sort(),
    );
  });

  it.each(handlers.map((h) => [h]))('%s has non-empty @Roles metadata', (name) => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      PaymentController.prototype[name as keyof PaymentController] as any,
    );
    expect(Array.isArray(roles)).toBe(true);
    expect((roles as string[]).length).toBeGreaterThan(0);
  });

  it('payment history is staff-only (PARENT deferred to FEE-4)', () => {
    const roles: string[] = Reflect.getMetadata(
      ROLES_KEY,
      PaymentController.prototype.getHistory as any,
    );
    expect(roles).toEqual(
      expect.arrayContaining(['SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT']),
    );
    expect(roles).not.toContain('PARENT');
    expect(roles).not.toContain('STUDENT');
  });

  it('pre-existing PARENT grants on initiate/verify are unchanged (not FEE-0 scope to alter)', () => {
    for (const name of ['initiate', 'verify'] as const) {
      const roles: string[] = Reflect.getMetadata(ROLES_KEY, PaymentController.prototype[name] as any);
      expect(roles).toContain('PARENT');
    }
  });
});
