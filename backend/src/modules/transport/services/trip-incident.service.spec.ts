import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TripIncidentService } from './trip-incident.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';

describe('TripIncidentService', () => {
  let service: TripIncidentService;
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

  const trip = { id: 'trip-1', tenantId: 't-1', branchId: 'b-1', vehicleId: 'v-1', driverId: 'd-1' };

  beforeEach(async () => {
    prisma = {
      trip: { findFirst: jest.fn() },
      tripIncident: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    audit = { logCreate: jest.fn().mockResolvedValue(undefined), logUpdate: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        TripIncidentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(TripIncidentService);
  });

  describe('report', () => {
    it('creates an incident tagged with the trip current vehicle/driver', async () => {
      prisma.trip.findFirst.mockResolvedValue(trip);
      const created = { id: 'inc-1' };
      prisma.tripIncident.create.mockResolvedValue(created);

      const result = await service.report(branchUser, 'trip-1', {
        type: 'VEHICLE_BREAKDOWN',
        description: 'Flat tyre near Hazratganj',
      });

      expect(result).toBe(created);
      expect(prisma.tripIncident.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tripId: 'trip-1', vehicleId: 'v-1', driverId: 'd-1', type: 'VEHICLE_BREAKDOWN' }),
      });
    });

    it('throws NotFoundException for a trip outside the caller scope', async () => {
      prisma.trip.findFirst.mockResolvedValue(null);
      await expect(
        service.report(branchUser, 'missing', { type: 'OTHER', description: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolve', () => {
    it('resolves an open incident', async () => {
      prisma.trip.findFirst.mockResolvedValue(trip);
      prisma.tripIncident.findFirst.mockResolvedValue({ id: 'inc-1', tenantId: 't-1', resolvedAt: null });
      prisma.tripIncident.update.mockResolvedValue({ id: 'inc-1', resolvedAt: new Date() });

      const result = await service.resolve(branchUser, 'trip-1', 'inc-1', { resolutionNotes: 'Vehicle swapped' });
      expect(result.resolvedAt).toBeTruthy();
    });

    it('rejects resolving an already-resolved incident', async () => {
      prisma.trip.findFirst.mockResolvedValue(trip);
      prisma.tripIncident.findFirst.mockResolvedValue({ id: 'inc-1', resolvedAt: new Date('2026-01-01') });

      await expect(service.resolve(branchUser, 'trip-1', 'inc-1', {})).rejects.toThrow(BadRequestException);
    });
  });
});
