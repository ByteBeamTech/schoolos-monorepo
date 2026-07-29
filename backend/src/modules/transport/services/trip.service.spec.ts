import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TripService } from './trip.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';

describe('TripService', () => {
  let service: TripService;
  let prisma: any;
  let audit: any;

  const branchUser = {
    id: 'u-1',
    tenantId: 't-1',
    role: 'TRANSPORT_MANAGER',
    branchId: 'b-1',
    branchIds: ['b-1'],
    email: 'tm@school.test',
    jti: 'jti-1',
  } as unknown as AuthenticatedUser;

  const route = { id: 'r-1', tenantId: 't-1', branchId: 'b-1', status: 'ACTIVE' };

  const scheduledTrip = {
    id: 'trip-1',
    tenantId: 't-1',
    branchId: 'b-1',
    routeId: 'r-1',
    tripType: 'MORNING',
    tripDate: new Date('2026-08-01'),
    status: 'SCHEDULED',
    vehicleId: null,
    driverId: null,
    conductorId: null,
  };

  beforeEach(async () => {
    prisma = {
      route: { findFirst: jest.fn() },
      trip: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), createMany: jest.fn() },
      tripSchedule: { findMany: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    audit = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        TripService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(TripService);
  });

  describe('create', () => {
    it('creates a trip when the route is in scope and resources are free', async () => {
      prisma.route.findFirst.mockResolvedValue(route);
      prisma.trip.findFirst.mockResolvedValue(null); // no clash
      prisma.trip.create.mockResolvedValue(scheduledTrip);

      const result = await service.create(branchUser, {
        routeId: 'r-1',
        tripType: 'MORNING',
        tripDate: '2026-08-01',
      });

      expect(result).toBe(scheduledTrip);
      expect(prisma.trip.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tenantId: 't-1', branchId: 'b-1', routeId: 'r-1' }),
      });
    });

    it('throws NotFoundException when the route is outside the caller scope', async () => {
      prisma.route.findFirst.mockResolvedValue(null);
      await expect(
        service.create(branchUser, { routeId: 'r-OTHER', tripType: 'MORNING', tripDate: '2026-08-01' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the requested vehicle is already on another trip of the same type/date', async () => {
      prisma.route.findFirst.mockResolvedValue(route);
      prisma.trip.findFirst.mockResolvedValue({ id: 'trip-existing' }); // clash found

      await expect(
        service.create(branchUser, {
          routeId: 'r-1',
          tripType: 'MORNING',
          tripDate: '2026-08-01',
          vehicleId: 'v-1',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.trip.create).not.toHaveBeenCalled();
    });
  });

  describe('assignResources', () => {
    it('assigns vehicle/driver/conductor to a SCHEDULED trip', async () => {
      prisma.trip.findFirst.mockResolvedValueOnce(scheduledTrip); // getOne
      prisma.trip.findFirst.mockResolvedValue(null); // no clash for any resource check
      const after = { ...scheduledTrip, vehicleId: 'v-1', driverId: 'd-1' };
      prisma.trip.update.mockResolvedValue(after);

      const result = await service.assignResources(branchUser, 'trip-1', { vehicleId: 'v-1', driverId: 'd-1' });
      expect(result).toBe(after);
    });

    it('rejects reassignment on a non-SCHEDULED trip', async () => {
      prisma.trip.findFirst.mockResolvedValue({ ...scheduledTrip, status: 'RUNNING' });
      await expect(
        service.assignResources(branchUser, 'trip-1', { vehicleId: 'v-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('clearing an assignment with null is allowed and does not run the availability check for that field', async () => {
      prisma.trip.findFirst.mockResolvedValueOnce({ ...scheduledTrip, vehicleId: 'v-1' });
      const after = { ...scheduledTrip, vehicleId: null };
      prisma.trip.update.mockResolvedValue(after);

      const result = await service.assignResources(branchUser, 'trip-1', { vehicleId: null });
      expect(result).toBe(after);
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: 'trip-1' },
        data: { vehicle: { disconnect: true } },
      });
    });
  });

  describe('lifecycle', () => {
    it('start() requires both vehicle and driver assigned', async () => {
      prisma.trip.findFirst.mockResolvedValue(scheduledTrip); // no vehicle/driver
      await expect(service.start(branchUser, 'trip-1')).rejects.toThrow(BadRequestException);
    });

    it('start() succeeds once vehicle+driver are assigned', async () => {
      prisma.trip.findFirst.mockResolvedValue({ ...scheduledTrip, vehicleId: 'v-1', driverId: 'd-1' });
      prisma.trip.update.mockResolvedValue({ ...scheduledTrip, status: 'RUNNING' });

      const result = await service.start(branchUser, 'trip-1');
      expect(result.status).toBe('RUNNING');
    });

    it('complete() requires the trip to be RUNNING', async () => {
      prisma.trip.findFirst.mockResolvedValue(scheduledTrip); // still SCHEDULED
      await expect(service.complete(branchUser, 'trip-1')).rejects.toThrow(BadRequestException);
    });

    it('cancel() works from SCHEDULED or RUNNING but not COMPLETED', async () => {
      prisma.trip.findFirst.mockResolvedValue({ ...scheduledTrip, status: 'COMPLETED' });
      await expect(service.cancel(branchUser, 'trip-1', { reason: 'test' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('generateForBranchAndDate (AF-004)', () => {
    it('materializes one Trip per active TripSchedule matching the weekday, idempotently', async () => {
      // 2026-08-03 is a Monday -> weekday 1
      prisma.tripSchedule.findMany.mockResolvedValue([
        { id: 'ts-1', tenantId: 't-1', branchId: 'b-1', routeId: 'r-1', tripType: 'MORNING' },
      ]);
      prisma.trip.createMany.mockResolvedValue({ count: 1 });

      const result = await service.generateForBranchAndDate('t-1', 'b-1', new Date('2026-08-03T00:00:00Z'));

      expect(result).toEqual({ created: 1, scheduleCount: 1 });
      expect(prisma.trip.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true }),
      );
    });

    it('returns zero without querying trips when no schedule matches the weekday', async () => {
      prisma.tripSchedule.findMany.mockResolvedValue([]);
      const result = await service.generateForBranchAndDate('t-1', 'b-1', new Date('2026-08-03T00:00:00Z'));
      expect(result).toEqual({ created: 0, scheduleCount: 0 });
      expect(prisma.trip.createMany).not.toHaveBeenCalled();
    });
  });
});
