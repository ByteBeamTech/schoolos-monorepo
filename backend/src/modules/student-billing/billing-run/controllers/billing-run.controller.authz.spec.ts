// AUTH-041 tripwire pattern, applied to BillingRunController (Phase 4,
// frozen). Every route must carry explicit @Roles metadata.

import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../../../core/roles/roles.decorator';
import { BillingRunController } from './billing-run.controller';

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

describe('BillingRunController — explicit @Roles on every route (AUTH-041)', () => {
  const handlers = routeHandlerNames(BillingRunController);

  it('discovers the expected route handlers (update deliberately when routes change)', () => {
    expect(handlers.sort()).toEqual(['findAll', 'trigger', 'execute', 'retryFailed', 'findOne', 'findAttempts'].sort());
  });

  it.each(handlers.map((h) => [h]))('%s has non-empty @Roles metadata', (name) => {
    const handler = (BillingRunController.prototype as any)[name];
    const roles = Reflect.getMetadata(ROLES_KEY, handler);
    expect(Array.isArray(roles)).toBe(true);
    expect(roles.length).toBeGreaterThan(0);
  });

  it('trigger never accepts a feePlanId -- BillingRun is Branch+Period scoped, per the frozen correction', () => {
    // The DTO itself enforces this at the type level (TriggerBillingRunDto
    // has no feePlanId field) -- this test documents that constraint by
    // asserting the controller method's own parameter shape stays that way.
    const source = BillingRunController.prototype.trigger.toString();
    expect(source).not.toMatch(/feePlanId/);
  });
});
