// FEE-0 (Security Hardening): mechanical guard against the root cause of the
// audit's P0s — RolesGuard allows any authenticated user through when a
// handler has no @Roles() decorator. Under AUTH-041 (absence of an explicit
// grant is a denial) every route handler on this controller must therefore
// carry explicit @Roles metadata. This test fails the moment anyone adds a
// route without one. (The repo-wide version of this check lands with the
// FEE-0 invariant suite; this file protects InvoiceController from this
// commit onward.)

import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../../../core/roles/roles.decorator';
import { InvoiceController } from './invoice.controller';

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

describe('InvoiceController — explicit @Roles on every route (AUTH-041)', () => {
  const handlers = routeHandlerNames(InvoiceController);

  it('discovers the expected route handlers (sanity — update deliberately when routes change)', () => {
    expect(handlers.sort()).toEqual(
      [
        'generate',
        'bulkGenerate',
        'findAll',
        'findOverdue',
        'getDefaulters',
        'getStats',
        'findOne',
        'send',
        'cancel',
      ].sort(),
    );
  });

  it.each(handlers.map((h) => [h]))(
    '%s has non-empty @Roles metadata',
    (name) => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        InvoiceController.prototype[name as keyof InvoiceController] as any,
      );
      expect(Array.isArray(roles)).toBe(true);
      expect((roles as string[]).length).toBeGreaterThan(0);
    },
  );

  it('the previously-unguarded read endpoints are staff-only (PARENT deferred to FEE-4)', () => {
    for (const name of ['findAll', 'findOne']) {
      const roles: string[] = Reflect.getMetadata(
        ROLES_KEY,
        InvoiceController.prototype[name as keyof InvoiceController] as any,
      );
      expect(roles).toEqual(
        expect.arrayContaining(['SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT']),
      );
      expect(roles).not.toContain('PARENT');
      expect(roles).not.toContain('STUDENT');
    }
  });
});
