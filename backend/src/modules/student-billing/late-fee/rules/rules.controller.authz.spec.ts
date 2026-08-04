// FEE-0/AUTH-041 tripwire pattern, applied to RulesController (Late Fee
// Module FDD v2 / Implementation Roadmap v2 Sprint 3): every route must
// carry explicit @Roles metadata, and rule mutation (create, deactivate)
// is SCHOOL_ADMIN/PRINCIPAL only, never ACCOUNTANT -- matching the same
// restriction level Fee Heads' own mutating routes already use.

import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../../../core/roles/roles.decorator';
import { RulesController } from './rules.controller';

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

describe('RulesController — explicit @Roles on every route (AUTH-041)', () => {
  const handlers = routeHandlerNames(RulesController);

  it('discovers the expected route handlers (update deliberately when routes change)', () => {
    expect(handlers.sort()).toEqual(['create', 'deactivate', 'findAll'].sort());
  });

  it.each(handlers.map((h) => [h]))('%s has non-empty @Roles metadata', (name) => {
    const handler = (RulesController.prototype as any)[name];
    const roles = Reflect.getMetadata(ROLES_KEY, handler);
    expect(Array.isArray(roles)).toBe(true);
    expect(roles.length).toBeGreaterThan(0);
  });

  it('create and deactivate are SCHOOL_ADMIN/PRINCIPAL only -- never ACCOUNTANT', () => {
    for (const name of ['create', 'deactivate']) {
      const handler = (RulesController.prototype as any)[name];
      const roles = Reflect.getMetadata(ROLES_KEY, handler);
      expect(roles).not.toContain('ACCOUNTANT');
      expect(roles).toEqual(expect.arrayContaining(['SCHOOL_ADMIN', 'PRINCIPAL']));
    }
  });

  it('findAll includes ACCOUNTANT -- read-only, matching the broader finance-staff set', () => {
    const handler = (RulesController.prototype as any).findAll;
    const roles = Reflect.getMetadata(ROLES_KEY, handler);
    expect(roles).toContain('ACCOUNTANT');
  });
});
