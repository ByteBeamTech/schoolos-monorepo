import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '@core/roles/roles.decorator';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from '../services/analytics.service';
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

describe('AnalyticsController — explicit @Roles + branch-scoped delegation (P0)', () => {
  const handlers = routeHandlerNames(AnalyticsController);

  it('discovers the expected route handlers', () => {
    expect(handlers.sort()).toEqual(['getOverview'].sort());
  });

  it('getOverview is finance-staff only', () => {
    const roles: string[] = Reflect.getMetadata(ROLES_KEY, AnalyticsController.prototype.getOverview as any);
    expect(roles).not.toContain('PARENT');
    expect(roles).not.toContain('STUDENT');
    expect(roles).not.toContain('TEACHER');
  });

  it('resolves and passes the caller\'s authorized branch set through to the service', async () => {
    const analytics = { getOverview: jest.fn().mockResolvedValue({}) };
    const access = { resolveAuthorizedBranchIds: jest.fn().mockReturnValue(['b-1']) };

    const module = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: analytics },
        { provide: StudentBillingAccessService, useValue: access },
      ],
    }).compile();
    const controller = module.get(AnalyticsController);

    const user = { id: 'u-1', tenantId: 't-1', role: 'ACCOUNTANT', branchIds: ['b-1'] };
    await controller.getOverview(user);

    expect(access.resolveAuthorizedBranchIds).toHaveBeenCalledWith(user);
    expect(analytics.getOverview).toHaveBeenCalledWith('t-1', ['b-1']);
  });
});
