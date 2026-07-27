import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConductorService } from './conductor.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';

describe('ConductorService', () => {
  let service: ConductorService;
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

  const conductorRow = {
    id: 'c-1',
    tenantId: 't-1',
    branchId: 'b-1',
    name: 'Ramesh Kumar',
    phone: '+919999999999',
    isActive: true,
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      conductor: {
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
        ConductorService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(ConductorService);
  });

  describe('getOne', () => {
    it('returns the conductor when found within the caller scope', async () => {
      prisma.conductor.findFirst.mockResolvedValue(conductorRow);

      const result = await service.getOne(branchUser, 'c-1');

      expect(result).toBe(conductorRow);
      expect(prisma.conductor.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 't-1', branchId: 'b-1', id: 'c-1', deletedAt: null },
      });
    });

    it('throws NotFoundException when no row matches', async () => {
      prisma.conductor.findFirst.mockResolvedValue(null);
      await expect(service.getOne(branchUser, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a conductor scoped to the caller branch and logs an audit CREATE', async () => {
      prisma.conductor.create.mockResolvedValue(conductorRow);

      const result = await service.create(branchUser, { name: 'Ramesh Kumar', phone: '+919999999999' });

      expect(result).toBe(conductorRow);
      expect(prisma.conductor.create).toHaveBeenCalledWith({
        data: { tenantId: 't-1', branchId: 'b-1', name: 'Ramesh Kumar', phone: '+919999999999', isActive: undefined },
      });
      expect(audit.logCreate).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't-1', entityType: 'Conductor', entityId: 'c-1' }),
      );
    });

    it('rejects a tenant-wide caller with no branch context and no branchId in the DTO', async () => {
      await expect(
        service.create(tenantWideUser, { name: 'Ramesh Kumar' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.conductor.create).not.toHaveBeenCalled();
    });

    it('honours an explicit branchId for a tenant-wide caller', async () => {
      prisma.conductor.create.mockResolvedValue(conductorRow);

      await service.create(tenantWideUser, { name: 'Ramesh Kumar', branchId: 'b-1' });

      expect(prisma.conductor.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ branchId: 'b-1' }) }),
      );
    });
  });

  describe('update', () => {
    it('updates only the provided fields and logs a before/after audit UPDATE', async () => {
      prisma.conductor.findFirst.mockResolvedValue(conductorRow);
      const updated = { ...conductorRow, isActive: false };
      prisma.conductor.update.mockResolvedValue(updated);

      const result = await service.update(branchUser, 'c-1', { isActive: false });

      expect(result).toBe(updated);
      expect(prisma.conductor.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { isActive: false },
      });
      expect(audit.logUpdate).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting deletedAt and logs an audit DELETE', async () => {
      prisma.conductor.findFirst.mockResolvedValue(conductorRow);
      const deleted = { ...conductorRow, deletedAt: new Date() };
      prisma.conductor.update.mockResolvedValue(deleted);

      const result = await service.remove(branchUser, 'c-1');

      expect(result).toBe(deleted);
      expect(prisma.conductor.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.logDelete).toHaveBeenCalled();
    });
  });
});
