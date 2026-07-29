import { Test } from '@nestjs/testing';
import { TransportPricingService } from './transport-pricing.service';
import { PrismaService } from '@infra/database/prisma.service';

describe('TransportPricingService', () => {
  let service: TransportPricingService;
  let prisma: any;

  const assignment = {
    id: 'a-1',
    studentId: 'stu-1',
    routeId: 'r-1',
    pickupRouteStopId: 'rs-1',
    route: { name: 'Route A' },
    pickupRouteStop: { stop: { name: 'Hazratganj' } },
  };

  const pricing = {
    feeAmount: 500,
    currency: 'INR',
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
  };

  beforeEach(async () => {
    prisma = {
      studentTransportAssignment: { findMany: jest.fn() },
      transportStopPricing: { findFirst: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [TransportPricingService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(TransportPricingService);
  });

  describe('resolveChargesForStudent', () => {
    it('resolves one charge per active assignment that has an active price', async () => {
      prisma.studentTransportAssignment.findMany.mockResolvedValue([assignment]);
      prisma.transportStopPricing.findFirst.mockResolvedValue(pricing);

      const result = await service.resolveChargesForStudent('t-1', 'stu-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        assignmentId: 'a-1',
        routeName: 'Route A',
        pickupStopName: 'Hazratganj',
        feeAmount: 500,
        currency: 'INR',
      });
    });

    it('skips an assignment whose pickup stop has no active price (no throw)', async () => {
      prisma.studentTransportAssignment.findMany.mockResolvedValue([assignment]);
      prisma.transportStopPricing.findFirst.mockResolvedValue(null);

      const result = await service.resolveChargesForStudent('t-1', 'stu-1');
      expect(result).toEqual([]);
    });

    it('returns an empty array for a student with no active assignment', async () => {
      prisma.studentTransportAssignment.findMany.mockResolvedValue([]);
      const result = await service.resolveChargesForStudent('t-1', 'stu-nobody');
      expect(result).toEqual([]);
    });
  });

  describe('resolvePrimaryChargeForStudent', () => {
    it('returns the first resolved charge', async () => {
      prisma.studentTransportAssignment.findMany.mockResolvedValue([assignment]);
      prisma.transportStopPricing.findFirst.mockResolvedValue(pricing);

      const result = await service.resolvePrimaryChargeForStudent('t-1', 'stu-1');
      expect(result?.feeAmount).toBe(500);
    });

    it('returns null when there is nothing billable', async () => {
      prisma.studentTransportAssignment.findMany.mockResolvedValue([]);
      const result = await service.resolvePrimaryChargeForStudent('t-1', 'stu-1');
      expect(result).toBeNull();
    });
  });
});
