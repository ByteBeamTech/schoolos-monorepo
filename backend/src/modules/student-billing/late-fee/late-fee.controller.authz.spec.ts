// FEE-0/AUTH-041 tripwire pattern, applied to the new LateFeeController
// (P0): every route must carry explicit @Roles metadata, and the waiver
// endpoint is finance-staff only, never PARENT/STUDENT.

import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../../core/roles/roles.decorator';
import { LateFeeController } from './late-fee.controller';
import { LateFeeService } from './late-fee.service';

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

describe('LateFeeController — explicit @Roles on every route (AUTH-041)', () => {
  const handlers = routeHandlerNames(LateFeeController);

  it('discovers the expected route handlers (update deliberately when routes change)', () => {
    expect(handlers.sort()).toEqual(['findAll', 'getWaivers', 'preview', 'waive'].sort());
  });

  it.each(handlers.map((h) => [h]))('%s has non-empty @Roles metadata', (name) => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      LateFeeController.prototype[name as keyof LateFeeController] as any,
    );
    expect(Array.isArray(roles)).toBe(true);
    expect((roles as string[]).length).toBeGreaterThan(0);
  });

  it('the waiver endpoint is finance-staff only', () => {
    const roles: string[] = Reflect.getMetadata(ROLES_KEY, LateFeeController.prototype.waive as any);
    expect(roles).not.toContain('PARENT');
    expect(roles).not.toContain('STUDENT');
    expect(roles).not.toContain('TEACHER');
  });
});

describe('LateFeeController.waive — delegates to the service', () => {
  let controller: LateFeeController;
  let service: any;
  const user: any = { id: 'u-1', tenantId: 't-1', role: 'ACCOUNTANT', branchIds: ['b-1'] };

  beforeEach(async () => {
    service = { waiveLateFee: jest.fn().mockResolvedValue({ lateFee: { id: 'lf-1', status: 'WAIVED' } }) };
    const module = await Test.createTestingModule({
      controllers: [LateFeeController],
      providers: [{ provide: LateFeeService, useValue: service }],
    }).compile();
    controller = module.get(LateFeeController);
  });

  it('passes tenantId, id, amount, actorId and reason through to the service', async () => {
    await controller.waive('lf-1', { amount: 25, reason: 'goodwill' }, user);
    expect(service.waiveLateFee).toHaveBeenCalledWith('t-1', 'lf-1', 25, 'u-1', 'goodwill');
  });
});
