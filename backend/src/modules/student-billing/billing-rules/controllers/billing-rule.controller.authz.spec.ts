// FEE-0/AUTH-041 tripwire pattern, applied to BillingRuleController
// (Phase 2, frozen). Every route must carry explicit @Roles metadata.
// Role list matches FeePlansController's own convention (ACCOUNTANT
// included for create) rather than Late Fee Rules' stricter one --
// BillingRule creation is part of the same fee-configuration workflow
// as Fee Plans/Items, not a late-fee-specific governance action.

import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../../../core/roles/roles.decorator';
import { BillingRuleController } from './billing-rule.controller';

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

describe('BillingRuleController — explicit @Roles on every route (AUTH-041)', () => {
  const handlers = routeHandlerNames(BillingRuleController);

  it('discovers the expected route handlers (update deliberately when routes change)', () => {
    expect(handlers.sort()).toEqual(['create', 'findAll', 'findOne'].sort());
  });

  it.each(handlers.map((h) => [h]))('%s has non-empty @Roles metadata', (name) => {
    const handler = (BillingRuleController.prototype as any)[name];
    const roles = Reflect.getMetadata(ROLES_KEY, handler);
    expect(Array.isArray(roles)).toBe(true);
    expect(roles.length).toBeGreaterThan(0);
  });

  it('no update/patch route exists -- BillingRule is create-only by design (Phase 2, frozen)', () => {
    expect(handlers).not.toContain('update');
    expect(handlers).not.toContain('supersede');
  });
});
