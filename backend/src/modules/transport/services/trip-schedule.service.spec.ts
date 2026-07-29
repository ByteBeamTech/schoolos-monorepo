import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TripScheduleService } from './trip-schedule.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';

describe('TripScheduleService', () => {
  let service: TripScheduleService;
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

  const scheduleRow = {
    id: 'ts-1',
    tenantId: 't-1',
    branchId: 'b-1',
    routeId: 'r-1',
    tripType: 'MORNING',
    departureTime: '07:30',
    daysOfWeek: [1, 2, 3, 4, 5],
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      route: { findFirst: jest.fn() },
      tripSchedule: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    audit = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        TripScheduleService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(TripScheduleService);
  });

  describe('create', () => {
    it('creates a schedule when the route is in the same branch', async () => {
      prisma.route.findFirst.mockResolvedValue({ id: 'r-1', tenantId: 't-1', branchId: 'b-1' });
      prisma.tripSchedule.create.mockResolvedValue(scheduleRow);

      const result = await service.create(branchUser, {
        routeId: 'r-1',
        tripType: 'MORNING',
        departureTime: '07:30',
        daysOfWeek: [1, 2, 3, 4, 5],
      });

      expect(result).toBe(scheduleRow);
    });

    it('rejects when the route belongs to a different branch than the schedule', async () => {
      prisma.route.findFirst.mockResolvedValue({ id: 'r-1', tenantId: 't-1', branchId: 'b-OTHER' });

      await expect(
        service.create(branchUser, {
          routeId: 'r-1',
          tripType: 'MORNING',
          departureTime: '07:30',
          daysOfWeek: [1],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.tripSchedule.create).not.toHaveBeenCalled();
    });

    it('allows a tenant-wide (branchId: null) route', async () => {
      prisma.route.findFirst.mockResolvedValue({ id: 'r-1', tenantId: 't-1', branchId: null });
      prisma.tripSchedule.create.mockResolvedValue(scheduleRow);

      await expect(
        service.create(branchUser, {
          routeId: 'r-1',
          tripType: 'MORNING',
          departureTime: '07:30',
          daysOfWeek: [1],
        }),
      ).resolves.toBe(scheduleRow);
    });
  });

  describe('deactivate', () => {
    it('sets isActive to false via update()', async () => {
      prisma.tripSchedule.findFirst.mockResolvedValue(scheduleRow);
      prisma.tripSchedule.update.mockResolvedValue({ ...scheduleRow, isActive: false });

      const result = await service.deactivate(branchUser, 'ts-1');
      expect(result.isActive).toBe(false);
      expect(prisma.tripSchedule.update).toHaveBeenCalledWith({
        where: { id: 'ts-1' },
        data: { isActive: false },
      });
    });
  });
});
