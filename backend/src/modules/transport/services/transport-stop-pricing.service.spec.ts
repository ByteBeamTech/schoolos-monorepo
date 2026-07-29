import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransportStopPricingService } from './transport-stop-pricing.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import { TransportSettingsService } from './transport-settings.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';

describe('TransportStopPricingService', () => {
  let service: TransportStopPricingService;
  let prisma: any;
  let audit: any;
  let settings: any;

  const branchUser = {
    id: 'u-1',
    tenantId: 't-1',
    role: 'TRANSPORT_MANAGER',
    branchId: 'b-1',
    branchIds: ['b-1'],
    email: 'tm@school.test',
    jti: 'jti-1',
  } as unknown as AuthenticatedUser;

  const routeStopWithRoute = {
    id: 'rs-1',
    tenantId: 't-1',
    routeId: 'r-1',
    stopId: 's-1',
    route: { id: 'r-1', tenantId: 't-1', branchId: 'b-1' },
  };

  beforeEach(async () => {
    prisma = {
      routeStop: { findFirst: jest.fn() },
      transportStopPricing: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    audit = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
    };
    settings = {
      getOrCreate: jest.fn().mockResolvedValue({ feeRevisionMinNoticeDays: 7 }),
    };

    const module = await Test.createTestingModule({
      providers: [
        TransportStopPricingService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: TransportSettingsService, useValue: settings },
      ],
    }).compile();
    service = module.get(TransportStopPricingService);
  });

  describe('create', () => {
    it('creates the very first price for a stop without a min-notice check (not a revision)', async () => {
      prisma.routeStop.findFirst.mockResolvedValue(routeStopWithRoute);
      prisma.transportStopPricing.findFirst.mockResolvedValue(null); // no current open-ended price
      const created = { id: 'p-1', feeAmount: 500 };
      prisma.transportStopPricing.create.mockReturnValue(created);

      const result = await service.create(branchUser, 'rs-1', { feeAmount: 500 });

      expect(result).toBe(created);
      expect(settings.getOrCreate).not.toHaveBeenCalled();
      expect(audit.logCreate).toHaveBeenCalled();
    });

    it('closes out the previous open-ended price at the new effectiveFrom (overlap prevention)', async () => {
      const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      prisma.routeStop.findFirst.mockResolvedValue(routeStopWithRoute);
      const current = { id: 'p-old', effectiveFrom: new Date('2026-01-01'), effectiveTo: null };
      prisma.transportStopPricing.findFirst.mockResolvedValue(current);
      prisma.transportStopPricing.update.mockReturnValue({ ...current, effectiveTo: new Date(farFuture) });
      prisma.transportStopPricing.create.mockReturnValue({ id: 'p-new', feeAmount: 600 });

      await service.create(branchUser, 'rs-1', { feeAmount: 600, effectiveFrom: farFuture });

      expect(prisma.transportStopPricing.update).toHaveBeenCalledWith({
        where: { id: 'p-old' },
        data: { effectiveTo: new Date(farFuture) },
      });
    });

    it('rejects a revision that violates the branch Fee Revision Policy min-notice window', async () => {
      prisma.routeStop.findFirst.mockResolvedValue(routeStopWithRoute);
      prisma.transportStopPricing.findFirst.mockResolvedValue({
        id: 'p-old',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
      });
      settings.getOrCreate.mockResolvedValue({ feeRevisionMinNoticeDays: 7 });

      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await expect(service.create(branchUser, 'rs-1', { feeAmount: 600, effectiveFrom: tomorrow })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.transportStopPricing.create).not.toHaveBeenCalled();
    });

    it('rejects a new effectiveFrom that is not after the current active price', async () => {
      prisma.routeStop.findFirst.mockResolvedValue(routeStopWithRoute);
      const current = { id: 'p-old', effectiveFrom: new Date('2026-06-01'), effectiveTo: null };
      prisma.transportStopPricing.findFirst.mockResolvedValue(current);
      settings.getOrCreate.mockResolvedValue({ feeRevisionMinNoticeDays: 0 });

      await expect(
        service.create(branchUser, 'rs-1', { feeAmount: 600, effectiveFrom: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a RouteStop outside the caller branch scope', async () => {
      prisma.routeStop.findFirst.mockResolvedValue({
        ...routeStopWithRoute,
        route: { ...routeStopWithRoute.route, branchId: 'b-OTHER' },
      });

      await expect(service.create(branchUser, 'rs-1', { feeAmount: 500 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('end', () => {
    it('ends an open pricing row', async () => {
      prisma.routeStop.findFirst.mockResolvedValue(routeStopWithRoute);
      const before = { id: 'p-1', effectiveFrom: new Date('2026-01-01'), effectiveTo: null };
      prisma.transportStopPricing.findFirst.mockResolvedValue(before);
      const after = { ...before, effectiveTo: new Date('2026-06-01') };
      prisma.transportStopPricing.update.mockResolvedValue(after);

      const result = await service.end(branchUser, 'rs-1', 'p-1', { effectiveTo: '2026-06-01' });
      expect(result).toBe(after);
    });

    it('rejects ending a pricing row that has already ended', async () => {
      prisma.routeStop.findFirst.mockResolvedValue(routeStopWithRoute);
      prisma.transportStopPricing.findFirst.mockResolvedValue({
        id: 'p-1',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-03-01'),
      });

      await expect(service.end(branchUser, 'rs-1', 'p-1', {})).rejects.toThrow(BadRequestException);
    });
  });
});
