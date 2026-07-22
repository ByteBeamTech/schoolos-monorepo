// backend/src/modules/onboarding/onboarding.service.spec.ts
//
// PR-5B follow-up: OnboardingService previously had no spec file, and
// (until this same PR) never actually generated a License row for a
// newly onboarded tenant -- see the "3B" comment in onboarding.service.ts
// for the full story. These tests exist specifically to guard the fixed
// behavior: (1) a License row is created, (2) with
// generationReason=ONBOARDING_TRIAL, (3) inside the SAME transaction as
// Tenant/Branch/Subscription (so a license-generation failure rolls back
// the whole onboarding, not just the license), and (4) that onboarding
// itself never depends on EntitlementResolver (it must not enforce quota
// against a tenant that doesn't have a subscription/license yet).

import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '@infra/database/prisma.service';
import { LicenseBuilder } from '@core/license/license-builder.service';
import { DiscountCategoryProvisioningService } from '../student-billing/discounts/services/discount-category-provisioning.service';

describe('OnboardingService', () => {
  let service: OnboardingService;

  const mockPlan = {
    id: 'plan-1',
    tier: 'STARTER',
    currency: 'INR',
    isActive: true,
    trialDays: 14,
    model: 'FLAT_FEE',
    baseFee: { toString: () => '999' },
    perStudentRate: null,
    overageRate: null,
    overageEnabled: false,
    studentLimit: 200,
    branchLimit: 1,
    staffLimit: 20,
    storageLimitGb: 5,
    features: ['core'],
    version: 1,
    code: 'STARTER',
    name: 'Starter',
  };

  const mockTenant = { id: 'tenant-1', name: 'Test School', slug: 'test-school' };
  const mockAdminUser = { id: 'user-1', email: 'admin@test.com' };
  const mockPrimaryBranch = { id: 'branch-1', name: 'Main Campus' };
  const mockSubscription = { id: 'sub-1', trialEndsAt: new Date() };
  const mockSession = { id: 'sess-1', name: '2026-27' };
  const mockLicenseResult = { licenseId: 'lic-1', generationVersion: 1, status: 'TRIAL' };

  // Matches the pattern used elsewhere in this codebase (mockPrismaService
  // with `$transaction: jest.fn((cb) => cb(mockPrismaService))`) -- the tx
  // callback is invoked directly against the same mock object, which is
  // enough to test call-order and error-propagation without a real DB.
  const mockPrismaService: any = {
    tenant:       { findFirst: jest.fn(), create: jest.fn() },
    user:         { findFirst: jest.fn(), create: jest.fn() },
    pricingPlan:  { findUnique: jest.fn(), findFirst: jest.fn() },
    branch:       { create: jest.fn() },
    userBranch:   { create: jest.fn() },
    tenantSubscription: { create: jest.fn() },
    academicSession:    { create: jest.fn() },
    auditLog:     { create: jest.fn() },
    $transaction: jest.fn((cb: any) => cb(mockPrismaService)),
  };

  const mockLicenseBuilder = {
    regenerateForTenant: jest.fn(),
  };

  const mockDiscountCategoryProvisioning = {
    provisionForBranch: jest.fn().mockResolvedValue({ created: 6, skipped: 0 }),
  };

  const baseDto = {
    schoolName: 'Test School',
    slug: 'test-school',
    adminEmail: 'admin@test.com',
    adminPassword: 'Password123!',
    adminFirstName: 'Admin',
    adminLastName: 'User',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LicenseBuilder, useValue: mockLicenseBuilder },
        { provide: DiscountCategoryProvisioningService, useValue: mockDiscountCategoryProvisioning },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);

    jest.clearAllMocks();
    mockPrismaService.tenant.findFirst.mockResolvedValue(null);       // slug free
    mockPrismaService.user.findFirst.mockResolvedValue(null);         // email free
    mockPrismaService.pricingPlan.findUnique.mockResolvedValue(mockPlan);
    mockPrismaService.pricingPlan.findFirst.mockResolvedValue(mockPlan);
    mockPrismaService.tenant.create.mockResolvedValue(mockTenant);
    mockPrismaService.user.create.mockResolvedValue(mockAdminUser);
    mockPrismaService.branch.create.mockResolvedValue(mockPrimaryBranch);
    mockPrismaService.userBranch.create.mockResolvedValue({});
    mockPrismaService.tenantSubscription.create.mockResolvedValue(mockSubscription);
    mockPrismaService.academicSession.create.mockResolvedValue(mockSession);
    mockPrismaService.auditLog.create.mockResolvedValue({});
    mockLicenseBuilder.regenerateForTenant.mockResolvedValue(mockLicenseResult);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Architectural guard, not behavioral: OnboardingService must never be
  // given an EntitlementResolver dependency. If a future change adds one
  // (to "enforce" something during onboarding), this test's constructor
  // list would need updating -- a deliberate friction point, since
  // onboarding running before any subscription/license exists is exactly
  // why it must not call entitlement checks (see PR-5B commit notes on
  // school-management.service.ts's createBranch for the branch-quota
  // side of this same rule).
  it('should not depend on EntitlementResolver', () => {
    const paramTypes = Reflect.getMetadata('design:paramtypes', OnboardingService) || [];
    const dependsOnEntitlementResolver = paramTypes.some(
      (t: any) => t?.name === 'EntitlementResolver',
    );
    expect(dependsOnEntitlementResolver).toBe(false);
  });

  describe('onboardTenant', () => {
    // FEE-1: the primary branch must never exist without its default discount
    // categories -- DiscountService.create() resolves against them and refuses
    // to create them on demand.
    it('should provision the primary branch default discount categories inside the same transaction', async () => {
      await service.onboardTenant(baseDto as any, 'super-admin-1');

      expect(mockDiscountCategoryProvisioning.provisionForBranch).toHaveBeenCalledWith(
        mockPrismaService, // the `tx` -- same object the mock $transaction hands back
        mockTenant.id,
        mockPrimaryBranch.id,
      );
    });

    it('should fail the whole onboarding transaction if category provisioning fails', async () => {
      mockDiscountCategoryProvisioning.provisionForBranch.mockRejectedValueOnce(
        new Error('provisioning failed'),
      );

      await expect(
        service.onboardTenant(baseDto as any, 'super-admin-1'),
      ).rejects.toThrow('provisioning failed');
    });

    it('should generate a License row synchronously with generationReason=ONBOARDING_TRIAL, inside the same transaction', async () => {
      const result = await service.onboardTenant(baseDto as any, 'super-admin-1');

      expect(mockLicenseBuilder.regenerateForTenant).toHaveBeenCalledWith(
        mockTenant.id,
        'ONBOARDING_TRIAL',
        'super-admin-1',
        mockPrismaService, // the `tx` -- same object the mock $transaction hands back
      );
      // Called with exactly 4 args: no sourceEventKey. Onboarding is a
      // synchronous caller per LicenseBuilder's documented "exactly two
      // caller kinds" rule -- passing a 5th arg here would be a symptom
      // of onboarding accidentally being wired as event-driven.
      expect(mockLicenseBuilder.regenerateForTenant.mock.calls[0]).toHaveLength(4);

      expect(result.success).toBe(true);
      expect(result.licenseId).toBe(mockLicenseResult.licenseId);
    });

    it('should call regenerateForTenant AFTER tenantSubscription.create but BEFORE academicSession.create (branch -> subscription -> license ordering)', async () => {
      const callOrder: string[] = [];
      mockPrismaService.tenantSubscription.create.mockImplementation(async () => {
        callOrder.push('subscription');
        return mockSubscription;
      });
      mockLicenseBuilder.regenerateForTenant.mockImplementation(async () => {
        callOrder.push('license');
        return mockLicenseResult;
      });
      mockPrismaService.academicSession.create.mockImplementation(async () => {
        callOrder.push('session');
        return mockSession;
      });

      await service.onboardTenant(baseDto as any, 'super-admin-1');

      expect(callOrder).toEqual(['subscription', 'license', 'session']);
    });

    it('should roll back the entire onboarding transaction when License generation fails', async () => {
      mockLicenseBuilder.regenerateForTenant.mockRejectedValueOnce(
        new Error('DB write failed mid-license-generation'),
      );

      await expect(
        service.onboardTenant(baseDto as any, 'super-admin-1'),
      ).rejects.toThrow('DB write failed mid-license-generation');

      // Steps that come after license generation in the transaction body
      // must never have run -- this is the unit-test-level proxy for "the
      // transaction rolled back" (a real Postgres rollback can only be
      // confirmed on the server, but call-order + non-invocation here is
      // the correct thing to assert against a mocked $transaction).
      expect(mockPrismaService.academicSession.create).not.toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
