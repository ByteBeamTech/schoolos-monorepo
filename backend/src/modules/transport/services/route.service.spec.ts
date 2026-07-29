import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RouteService } from './route.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';

describe('RouteService', () => {
  let service: RouteService;
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

  const draftRoute = {
    id: 'r-1',
    tenantId: 't-1',
    branchId: 'b-1',
    name: 'Route A',
    description: null,
    status: 'DRAFT',
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      route: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      routeStop: { count: jest.fn(), findMany: jest.fn(), createMany: jest.fn() },
      studentTransportAssignment: { findMany: jest.fn() },
      trip: { findMany: jest.fn() },
      eventOutbox: { create: jest.fn().mockResolvedValue(undefined) },
      $transaction: jest.fn((arg: any) => {
        if (typeof arg === 'function') {
          // interactive transaction — pass a tx that mirrors prisma itself
          return arg(prisma);
        }
        return Promise.all(arg);
      }),
    };
    audit = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        RouteService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(RouteService);
  });

  describe('create', () => {
    it('creates a route (status defaults to DRAFT via the schema, not set here)', async () => {
      prisma.route.create.mockResolvedValue(draftRoute);

      const result = await service.create(branchUser, { name: 'Route A' });

      expect(result).toBe(draftRoute);
      expect(prisma.route.create).toHaveBeenCalledWith({
        data: { tenantId: 't-1', branchId: 'b-1', name: 'Route A', description: undefined },
      });
      expect(audit.logCreate).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('allows deleting a DRAFT route', async () => {
      prisma.route.findFirst.mockResolvedValue(draftRoute);
      prisma.route.update.mockResolvedValue({ ...draftRoute, deletedAt: new Date() });

      await service.remove(branchUser, 'r-1');
      expect(prisma.route.update).toHaveBeenCalledWith({
        where: { id: 'r-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('rejects deleting a non-DRAFT route', async () => {
      prisma.route.findFirst.mockResolvedValue({ ...draftRoute, status: 'ACTIVE' });
      await expect(service.remove(branchUser, 'r-1')).rejects.toThrow(BadRequestException);
      expect(prisma.route.update).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('activates a DRAFT route that has at least one stop', async () => {
      prisma.route.findFirst.mockResolvedValue(draftRoute);
      prisma.routeStop.count.mockResolvedValue(2);
      prisma.route.update.mockResolvedValue({ ...draftRoute, status: 'ACTIVE' });

      const result = await service.activate(branchUser, 'r-1');

      expect(result.status).toBe('ACTIVE');
      expect(prisma.eventOutbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'transport.route.activated' }),
        }),
      );
    });

    it('rejects activation with zero stops', async () => {
      prisma.route.findFirst.mockResolvedValue(draftRoute);
      prisma.routeStop.count.mockResolvedValue(0);

      await expect(service.activate(branchUser, 'r-1')).rejects.toThrow(BadRequestException);
      expect(prisma.route.update).not.toHaveBeenCalled();
    });

    it('rejects activating an already-ACTIVE route', async () => {
      prisma.route.findFirst.mockResolvedValue({ ...draftRoute, status: 'ACTIVE' });
      await expect(service.activate(branchUser, 'r-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('archive', () => {
    it('archives an ACTIVE route', async () => {
      prisma.route.findFirst.mockResolvedValue({ ...draftRoute, status: 'ACTIVE' });
      prisma.route.update.mockResolvedValue({ ...draftRoute, status: 'ARCHIVED' });

      const result = await service.archive(branchUser, 'r-1');
      expect(result.status).toBe('ARCHIVED');
    });

    it('rejects archiving a DRAFT route', async () => {
      prisma.route.findFirst.mockResolvedValue(draftRoute);
      await expect(service.archive(branchUser, 'r-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('clone', () => {
    it('creates a new DRAFT route and copies the source stops', async () => {
      prisma.route.findFirst.mockResolvedValue(draftRoute);
      prisma.routeStop.findMany.mockResolvedValue([
        { id: 'rs-1', stopId: 's-1', sequence: 0, distanceFromStartKm: 1.5, etaMinutesFromStart: 5, boardingOrder: 0 },
      ]);
      const clonedRoute = { ...draftRoute, id: 'r-2', name: 'Route A Copy' };
      prisma.route.create.mockResolvedValue(clonedRoute);

      const result = await service.clone(branchUser, 'r-1', { name: 'Route A Copy' });

      expect(result).toBe(clonedRoute);
      expect(prisma.routeStop.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ routeId: 'r-2', stopId: 's-1', sequence: 0 }),
        ],
      });
    });
  });

  describe('suspend wizard (AF-007)', () => {
    const activeRoute = { ...draftRoute, status: 'ACTIVE' };

    it('preview returns affected counts and an impactToken', async () => {
      prisma.route.findFirst.mockResolvedValue(activeRoute);
      prisma.studentTransportAssignment.findMany.mockResolvedValue([{ id: 'a-1', studentId: 'stu-1' }]);
      prisma.trip.findMany.mockResolvedValue([{ id: 'trip-1', tripDate: new Date() }]);

      const preview = await service.previewSuspend(branchUser, 'r-1');

      expect(preview.affectedStudentCount).toBe(1);
      expect(preview.upcomingTripCount).toBe(1);
      expect(typeof preview.impactToken).toBe('string');
      expect(preview.impactToken.length).toBeGreaterThan(0);
    });

    it('confirm succeeds when impactToken matches a fresh recompute', async () => {
      prisma.route.findFirst.mockResolvedValue(activeRoute);
      prisma.studentTransportAssignment.findMany.mockResolvedValue([{ id: 'a-1', studentId: 'stu-1' }]);
      prisma.trip.findMany.mockResolvedValue([{ id: 'trip-1', tripDate: new Date() }]);

      const preview = await service.previewSuspend(branchUser, 'r-1');

      prisma.route.update.mockResolvedValue({ ...activeRoute, status: 'SUSPENDED' });
      const result = await service.confirmSuspend(branchUser, 'r-1', { impactToken: preview.impactToken });

      expect(result.route.status).toBe('SUSPENDED');
      expect(result.completionReport.affectedStudentCount).toBe(1);
      expect(prisma.eventOutbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'transport.route.suspended' }),
        }),
      );
    });

    it('confirm rejects a stale impactToken (impact changed since preview)', async () => {
      prisma.route.findFirst.mockResolvedValue(activeRoute);
      prisma.studentTransportAssignment.findMany.mockResolvedValue([{ id: 'a-1', studentId: 'stu-1' }]);
      prisma.trip.findMany.mockResolvedValue([]);

      await expect(
        service.confirmSuspend(branchUser, 'r-1', { impactToken: 'stale-token-from-earlier-preview' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.route.update).not.toHaveBeenCalled();
    });

    it('rejects suspending a non-ACTIVE route', async () => {
      prisma.route.findFirst.mockResolvedValue(draftRoute); // DRAFT
      await expect(service.previewSuspend(branchUser, 'r-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOne', () => {
    it('throws NotFoundException when no route matches', async () => {
      prisma.route.findFirst.mockResolvedValue(null);
      await expect(service.getOne(branchUser, 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
