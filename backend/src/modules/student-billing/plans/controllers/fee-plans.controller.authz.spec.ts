// FEE-0: FeePlansController — @Roles tripwire + ownership-check wiring.
// The student-scoped endpoints here were the audit's canonical example of the
// missing ownership check ("any authenticated user can query any student's
// summary"); these tests pin both the decorator metadata and the fact that
// assertCanAccessStudent gates the service call.

import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../../../core/roles/roles.decorator';
import { FeePlansController } from './fee-plans.controller';
import { FeePlansService } from '../services/fee-plans.service';
import { StudentBillingAccessService } from '../../access/student-billing-access.service';

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

describe('FeePlansController — explicit @Roles on every route (AUTH-041)', () => {
  const handlers = routeHandlerNames(FeePlansController);

  it('discovers the expected route handlers (update deliberately when routes change)', () => {
    expect(handlers.sort()).toEqual(
      ['create', 'findAll', 'getStudentFeePlans', 'getStudentFeeSummary', 'findOne', 'assign', 'createFeeItem', 'supersedeFeeItem'].sort(),
    );
  });

  it.each(handlers.map((h) => [h]))('%s has non-empty @Roles metadata', (name) => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      FeePlansController.prototype[name as keyof FeePlansController] as any,
    );
    expect(Array.isArray(roles)).toBe(true);
    expect((roles as string[]).length).toBeGreaterThan(0);
  });

  it('all reads staff-only (PARENT deferred to FEE-4)', () => {
    for (const name of ['findAll', 'findOne', 'getStudentFeePlans', 'getStudentFeeSummary'] as const) {
      const roles: string[] = Reflect.getMetadata(ROLES_KEY, FeePlansController.prototype[name] as any);
      expect(roles).not.toContain('PARENT');
      expect(roles).not.toContain('STUDENT');
    }
  });
});

describe('FeePlansController — student-scoped reads gate on assertCanAccessStudent', () => {
  let controller: FeePlansController;
  let service: any;
  let access: any;
  const user: any = { id: 'u-1', tenantId: 't-1', role: 'ACCOUNTANT', branchIds: ['b-1'] };

  beforeEach(async () => {
    service = {
      getStudentFeePlans: jest.fn().mockResolvedValue([]),
      getStudentFeeSummary: jest.fn().mockResolvedValue({}),
    };
    access = { assertCanAccessStudent: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      controllers: [FeePlansController],
      providers: [
        { provide: FeePlansService, useValue: service },
        { provide: StudentBillingAccessService, useValue: access },
      ],
    }).compile();
    controller = module.get(FeePlansController);
  });

  it('getStudentFeePlans calls the ownership check before the service', async () => {
    await controller.getStudentFeePlans('s-1', user);
    expect(access.assertCanAccessStudent).toHaveBeenCalledWith(user, 's-1');
    expect(access.assertCanAccessStudent.mock.invocationCallOrder[0])
      .toBeLessThan(service.getStudentFeePlans.mock.invocationCallOrder[0]);
  });

  it('getStudentFeeSummary calls the ownership check before the service', async () => {
    await controller.getStudentFeeSummary('s-1', '2025-26', user);
    expect(access.assertCanAccessStudent).toHaveBeenCalledWith(user, 's-1');
    expect(access.assertCanAccessStudent.mock.invocationCallOrder[0])
      .toBeLessThan(service.getStudentFeeSummary.mock.invocationCallOrder[0]);
  });

  it('a denied ownership check propagates and the service is NEVER called', async () => {
    access.assertCanAccessStudent.mockRejectedValue(new NotFoundException());
    await expect(controller.getStudentFeeSummary('s-x', '2025-26', user))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(service.getStudentFeeSummary).not.toHaveBeenCalled();
  });
});
