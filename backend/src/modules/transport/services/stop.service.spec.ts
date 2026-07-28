import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StopService } from './stop.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';

describe('StopService', () => {
  let service: StopService;
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

  const tenantWideUser = {
    id: 'u-2',
    tenantId: 't-1',
    role: 'SCHOOL_ADMIN',
    branchId: undefined,
    branchIds: [],
    email: 'admin@school.test',
    jti: 'jti-2',
  } as unknown as AuthenticatedUser;

  const stopRow = {
    id: 's-1',
    tenantId: 't-1',
    branchId: 'b-1',
    name: 'Hazratganj Crossing',
    landmark: 'Near GPO',
    latitude: 26.8467,
    longitude: 80.9462,
    stopGroup: 'Zone A',
    isActive: true,
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      stop: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    audit = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        StopService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(StopService);
  });

  describe('getOne', () => {
    it('returns the stop when found within the caller scope', async () => {
      prisma.stop.findFirst.mockResolvedValue(stopRow);

      const result = await service.getOne(branchUser, 's-1');

      expect(result).toBe(stopRow);
      expect(prisma.stop.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 't-1', branchId: 'b-1', id: 's-1', deletedAt: null },
      });
    });

    it('throws NotFoundException when no row matches', async () => {
      prisma.stop.findFirst.mockResolvedValue(null);
      await expect(service.getOne(branchUser, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('filters by stopGroup and search across name/landmark', async () => {
      prisma.stop.findMany.mockResolvedValue([stopRow]);
      prisma.stop.count.mockResolvedValue(1);

      const result = await service.list(branchUser, { stopGroup: 'Zone A', search: 'ganj' } as any);

      expect(result.items).toEqual([stopRow]);
      expect(prisma.stop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stopGroup: 'Zone A',
            OR: [
              { name: { contains: 'ganj', mode: 'insensitive' } },
              { landmark: { contains: 'ganj', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('creates a stop scoped to the caller branch and logs an audit CREATE', async () => {
      prisma.stop.create.mockResolvedValue(stopRow);

      const result = await service.create(branchUser, {
        name: 'Hazratganj Crossing',
        landmark: 'Near GPO',
        latitude: 26.8467,
        longitude: 80.9462,
        stopGroup: 'Zone A',
      });

      expect(result).toBe(stopRow);
      expect(prisma.stop.create).toHaveBeenCalledWith({
        data: {
          tenantId: 't-1',
          branchId: 'b-1',
          name: 'Hazratganj Crossing',
          landmark: 'Near GPO',
          latitude: 26.8467,
          longitude: 80.9462,
          stopGroup: 'Zone A',
          isActive: undefined,
        },
      });
      expect(audit.logCreate).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't-1', entityType: 'Stop', entityId: 's-1' }),
      );
    });

    it('rejects a tenant-wide caller with no branch context and no branchId in the DTO', async () => {
      await expect(
        service.create(tenantWideUser, { name: 'Hazratganj Crossing' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.stop.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates only the provided fields and logs a before/after audit UPDATE', async () => {
      prisma.stop.findFirst.mockResolvedValue(stopRow);
      const updated = { ...stopRow, isActive: false };
      prisma.stop.update.mockResolvedValue(updated);

      const result = await service.update(branchUser, 's-1', { isActive: false });

      expect(result).toBe(updated);
      expect(prisma.stop.update).toHaveBeenCalledWith({
        where: { id: 's-1' },
        data: { isActive: false },
      });
      expect(audit.logUpdate).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting deletedAt and logs an audit DELETE', async () => {
      prisma.stop.findFirst.mockResolvedValue(stopRow);
      const deleted = { ...stopRow, deletedAt: new Date() };
      prisma.stop.update.mockResolvedValue(deleted);

      const result = await service.remove(branchUser, 's-1');

      expect(result).toBe(deleted);
      expect(prisma.stop.update).toHaveBeenCalledWith({
        where: { id: 's-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.logDelete).toHaveBeenCalled();
    });
  });
});
