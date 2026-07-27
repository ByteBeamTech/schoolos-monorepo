import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TransportSettingsService } from './transport-settings.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';

describe('TransportSettingsService', () => {
  let service: TransportSettingsService;
  let prisma: any;
  let audit: any;

  const branchAdmin = { id: 'u-1', role: 'SCHOOL_ADMIN', branchId: 'b-1', branchIds: ['b-1'] };
  const transportManager = { id: 'u-2', role: 'TRANSPORT_MANAGER', branchId: 'b-1', branchIds: ['b-1'] };
  const otherBranchStaff = { id: 'u-3', role: 'TRANSPORT_MANAGER', branchId: 'b-2', branchIds: ['b-2'] };

  const existingRow = { id: 's-1', tenantId: 't-1', branchId: 'b-1', capacityBufferSeats: 0 };

  beforeEach(async () => {
    prisma = {
      transportSettings: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        TransportSettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(TransportSettingsService);
  });

  describe('getOrCreate', () => {
    it('returns the existing row scoped by (tenantId, branchId) without creating', async () => {
      prisma.transportSettings.findUnique.mockResolvedValue(existingRow);

      const result = await service.getOrCreate('t-1', 'b-1', branchAdmin);

      expect(result).toBe(existingRow);
      expect(prisma.transportSettings.findUnique).toHaveBeenCalledWith({
        where: { tenantId_branchId: { tenantId: 't-1', branchId: 'b-1' } },
      });
      expect(prisma.transportSettings.create).not.toHaveBeenCalled();
    });

    it('lazily creates a row with schema defaults (empty data payload) on first read', async () => {
      prisma.transportSettings.findUnique.mockResolvedValue(null);
      prisma.transportSettings.create.mockResolvedValue(existingRow);

      const result = await service.getOrCreate('t-1', 'b-1', transportManager);

      expect(result).toBe(existingRow);
      expect(prisma.transportSettings.create).toHaveBeenCalledWith({
        data: { tenantId: 't-1', branchId: 'b-1' },
      });
    });

    it('allows tenant-wide roles (SCHOOL_ADMIN) even without branchIds membership', async () => {
      prisma.transportSettings.findUnique.mockResolvedValue(existingRow);
      const tenantWideAdmin = { id: 'u-9', role: 'SCHOOL_ADMIN', branchId: 'b-99', branchIds: ['b-99'] };

      await expect(service.getOrCreate('t-1', 'b-1', tenantWideAdmin)).resolves.toBe(existingRow);
    });

    it('rejects a branch-scoped caller with no access to the requested branch', async () => {
      await expect(service.getOrCreate('t-1', 'b-1', otherBranchStaff)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.transportSettings.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates the branch row and writes an audit entry with before/after', async () => {
      prisma.transportSettings.findUnique.mockResolvedValue(existingRow);
      const updated = { ...existingRow, capacityBufferSeats: 5 };
      prisma.transportSettings.update.mockResolvedValue(updated);

      const result = await service.update(
        't-1',
        'b-1',
        { capacityBufferSeats: 5 },
        transportManager,
      );

      expect(result).toBe(updated);
      expect(prisma.transportSettings.update).toHaveBeenCalledWith({
        where: { tenantId_branchId: { tenantId: 't-1', branchId: 'b-1' } },
        data: { capacityBufferSeats: 5 },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't-1',
          actorId: 'u-2',
          action: 'UPDATE',
          entityType: 'TransportSettings',
          entityId: existingRow.id,
          before: existingRow,
          after: updated,
        }),
      );
    });

    it('rejects an update from a caller with no access to the branch', async () => {
      await expect(
        service.update('t-1', 'b-1', { capacityBufferSeats: 5 }, otherBranchStaff),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.transportSettings.update).not.toHaveBeenCalled();
    });
  });
});
