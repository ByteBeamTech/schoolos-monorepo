import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RouteStopService } from './route-stop.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';

describe('RouteStopService', () => {
  let service: RouteStopService;
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

  const route = { id: 'r-1', tenantId: 't-1', branchId: 'b-1', status: 'DRAFT' };

  beforeEach(async () => {
    prisma = {
      route: { findFirst: jest.fn() },
      stop: { findFirst: jest.fn() },
      routeStop: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      studentTransportAssignment: { findFirst: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    audit = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        RouteStopService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(RouteStopService);
  });

  describe('add', () => {
    it('adds a stop to the route', async () => {
      prisma.route.findFirst.mockResolvedValue(route);
      prisma.stop.findFirst.mockResolvedValue({ id: 's-1', tenantId: 't-1' });
      const created = { id: 'rs-1', routeId: 'r-1', stopId: 's-1', sequence: 0 };
      prisma.routeStop.create.mockResolvedValue(created);

      const result = await service.add(branchUser, 'r-1', { stopId: 's-1', sequence: 0 });
      expect(result).toBe(created);
    });

    it('throws NotFoundException when the route does not exist in scope', async () => {
      prisma.route.findFirst.mockResolvedValue(null);
      await expect(service.add(branchUser, 'r-1', { stopId: 's-1', sequence: 0 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('translates a unique-constraint violation into ConflictException (duplicate stop on route)', async () => {
      prisma.route.findFirst.mockResolvedValue(route);
      prisma.stop.findFirst.mockResolvedValue({ id: 's-1', tenantId: 't-1' });
      prisma.routeStop.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.add(branchUser, 'r-1', { stopId: 's-1', sequence: 0 })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('reorder', () => {
    it('reassigns sequence 0..n-1 in the given order', async () => {
      prisma.route.findFirst.mockResolvedValue(route);
      prisma.routeStop.findMany.mockResolvedValueOnce([{ id: 'rs-1' }, { id: 'rs-2' }]);
      prisma.routeStop.update.mockResolvedValue({});
      prisma.routeStop.findMany.mockResolvedValueOnce([{ id: 'rs-2', sequence: 0 }, { id: 'rs-1', sequence: 1 }]);

      await service.reorder(branchUser, 'r-1', { routeStopIds: ['rs-2', 'rs-1'] });

      expect(prisma.routeStop.update).toHaveBeenNthCalledWith(1, { where: { id: 'rs-2' }, data: { sequence: 0 } });
      expect(prisma.routeStop.update).toHaveBeenNthCalledWith(2, { where: { id: 'rs-1' }, data: { sequence: 1 } });
    });

    it('rejects when routeStopIds does not match the current set exactly', async () => {
      prisma.route.findFirst.mockResolvedValue(route);
      prisma.routeStop.findMany.mockResolvedValue([{ id: 'rs-1' }, { id: 'rs-2' }]);

      await expect(
        service.reorder(branchUser, 'r-1', { routeStopIds: ['rs-1'] }), // missing rs-2
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('removes a stop with no active assignments', async () => {
      prisma.route.findFirst.mockResolvedValue(route);
      prisma.routeStop.findFirst.mockResolvedValue({ id: 'rs-1', tenantId: 't-1', stopId: 's-1' });
      prisma.studentTransportAssignment.findFirst.mockResolvedValue(null);

      await service.remove(branchUser, 'r-1', 'rs-1');
      expect(prisma.routeStop.delete).toHaveBeenCalledWith({ where: { id: 'rs-1' } });
    });

    it('blocks removal when the stop has an active student assignment', async () => {
      prisma.route.findFirst.mockResolvedValue(route);
      prisma.routeStop.findFirst.mockResolvedValue({ id: 'rs-1', tenantId: 't-1', stopId: 's-1' });
      prisma.studentTransportAssignment.findFirst.mockResolvedValue({ id: 'a-1' });

      await expect(service.remove(branchUser, 'r-1', 'rs-1')).rejects.toThrow(BadRequestException);
      expect(prisma.routeStop.delete).not.toHaveBeenCalled();
    });
  });
});
