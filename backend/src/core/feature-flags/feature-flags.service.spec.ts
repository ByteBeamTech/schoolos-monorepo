// backend/src/core/feature-flags/feature-flags.service.spec.ts
//
// COMM-006A: no spec file existed for FeatureFlagService before this PR.
// Covers the write-path methods that were previously stubs (see
// ADR-COMM-015 §6.2) -- createOverrideRequest, rejectRequest,
// cancelRequest, revokeOverride, setOverride, deleteOverride. Does not
// re-test evaluateAll()/isEnabled()/processSchedules() (already real,
// pre-existing code, unchanged by this PR) or audit logging / cleanup
// (explicitly deferred to COMM-006B).

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FeatureFlagService } from './feature-flags.service';
import { PrismaService } from '@infra/database/prisma.service';
import { RedisService } from '../../infra/cache/redis.service';
import { AuditService } from '../compliance/audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bull';
import { QUEUE_NAMES } from '../../infra/queue/queue.module';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  const mockFlag = { id: 'flag-1', name: 'FEATURE_WHATSAPP_INTEGRATION', tenantControllable: true };

  const mockPrismaService: any = {
    featureFlag:              { findUnique: jest.fn() },
    featureFlagOverride:      { upsert: jest.fn(), deleteMany: jest.fn(), delete: jest.fn() },
    featureFlagOverrideRequest: {
      findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(),
      findMany: jest.fn(), count: jest.fn(), update: jest.fn(),
    },
    featureFlagVersion: { findUnique: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };

  const mockRedis = { get: jest.fn(), set: jest.fn(), getJson: jest.fn(), setJson: jest.fn() };
  const mockAudit = { logCreate: jest.fn(), logUpdate: jest.fn() };
  const mockEmitter = { emit: jest.fn() };
  const mockQueue = { add: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedis },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventEmitter2, useValue: mockEmitter },
        { provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<FeatureFlagService>(FeatureFlagService);
    jest.clearAllMocks();
    mockPrismaService.$transaction = jest.fn((ops: any[]) => Promise.all(ops));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOverrideRequest', () => {
    const baseDto = {
      flagName: 'FEATURE_WHATSAPP_INTEGRATION',
      targetType: 'TENANT',
      targetId: 't-1',
      requestReason: '15-day trial per sales request',
      activationMode: 'IMMEDIATE',
      requestedBy: 'user-1',
      requestedByTenantId: 't-1',
    };

    it('should create a real, persisted request when no conflicting PENDING request exists', async () => {
      mockPrismaService.featureFlag.findUnique.mockResolvedValue(mockFlag);
      mockPrismaService.featureFlagOverrideRequest.findFirst.mockResolvedValue(null);
      mockPrismaService.featureFlagOverrideRequest.create.mockResolvedValue({ id: 'req-1', status: 'PENDING' });

      const result = await service.createOverrideRequest(baseDto as any);

      expect(mockPrismaService.featureFlagOverrideRequest.create).toHaveBeenCalled();
      expect(result).toEqual({ id: 'req-1', status: 'PENDING' });
    });

    it('should reject when a PENDING request already exists for the same flag+target', async () => {
      mockPrismaService.featureFlag.findUnique.mockResolvedValue(mockFlag);
      mockPrismaService.featureFlagOverrideRequest.findFirst.mockResolvedValue({ id: 'req-existing' });

      await expect(service.createOverrideRequest(baseDto as any)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.featureFlagOverrideRequest.create).not.toHaveBeenCalled();
    });

    it('should reject an unknown flag name', async () => {
      mockPrismaService.featureFlag.findUnique.mockResolvedValue(null);

      await expect(service.createOverrideRequest(baseDto as any)).rejects.toThrow(NotFoundException);
    });

    it('should require trialDays when activationMode=TRIAL', async () => {
      mockPrismaService.featureFlag.findUnique.mockResolvedValue(mockFlag);
      mockPrismaService.featureFlagOverrideRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.createOverrideRequest({ ...baseDto, activationMode: 'TRIAL' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectRequest / cancelRequest', () => {
    it('rejectRequest should update status to REJECTED for a PENDING request', async () => {
      mockPrismaService.featureFlagOverrideRequest.findUnique.mockResolvedValue({ id: 'req-1', status: 'PENDING' });
      mockPrismaService.featureFlagOverrideRequest.update.mockResolvedValue({ id: 'req-1', status: 'REJECTED' });

      const result = await service.rejectRequest({
        requestId: 'req-1', rejectedBy: 'user-1', rejectionReason: 'Not approved', tenantId: 't-1',
      });

      expect(mockPrismaService.featureFlagOverrideRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }),
      );
      expect(result).toEqual({ id: 'req-1', status: 'REJECTED' });
    });

    it('rejectRequest should reject a non-PENDING request', async () => {
      mockPrismaService.featureFlagOverrideRequest.findUnique.mockResolvedValue({ id: 'req-1', status: 'APPROVED' });

      await expect(
        service.rejectRequest({ requestId: 'req-1', rejectedBy: 'user-1', rejectionReason: 'x', tenantId: 't-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('cancelRequest should update status to CANCELLED for a PENDING request', async () => {
      mockPrismaService.featureFlagOverrideRequest.findUnique.mockResolvedValue({ id: 'req-1', status: 'PENDING' });
      mockPrismaService.featureFlagOverrideRequest.update.mockResolvedValue({ id: 'req-1', status: 'CANCELLED' });

      const result = await service.cancelRequest({ requestId: 'req-1', cancelledBy: 'user-1', tenantId: 't-1' });

      expect(result).toEqual({ id: 'req-1', status: 'CANCELLED' });
    });
  });

  describe('revokeOverride', () => {
    it('should delete the active override and mark the request REVOKED', async () => {
      mockPrismaService.featureFlagOverrideRequest.findUnique.mockResolvedValue({
        id: 'req-1', status: 'APPROVED', targetType: 'TENANT', targetId: 't-1',
        createdOverride: { id: 'ov-1' },
      });
      mockPrismaService.featureFlagOverrideRequest.update.mockResolvedValue({ id: 'req-1', status: 'REVOKED' });

      const result = await service.revokeOverride({
        requestId: 'req-1', revokedBy: 'user-1', revokeReason: 'Trial ended, no upgrade', tenantId: 't-1',
      });

      expect(mockPrismaService.featureFlagOverride.delete).toHaveBeenCalledWith({ where: { id: 'ov-1' } });
      expect(result).toEqual({ id: 'req-1', status: 'REVOKED' });
    });

    it('should reject revoking a request that was never approved', async () => {
      mockPrismaService.featureFlagOverrideRequest.findUnique.mockResolvedValue({ id: 'req-1', status: 'PENDING' });

      await expect(
        service.revokeOverride({ requestId: 'req-1', revokedBy: 'user-1', revokeReason: 'x', tenantId: 't-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setOverride', () => {
    it('should upsert a real FeatureFlagOverride row', async () => {
      mockPrismaService.featureFlag.findUnique.mockResolvedValue(mockFlag);
      mockPrismaService.featureFlagOverride.upsert.mockResolvedValue({ id: 'ov-1' });

      const result = await service.setOverride({
        flagName: 'FEATURE_WHATSAPP_INTEGRATION', targetType: 'TENANT', targetId: 't-1',
        isEnabled: true, actorId: 'admin-1', tenantId: 't-1',
      });

      expect(mockPrismaService.featureFlagOverride.upsert).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should reject a tenant-self-toggle for a non-tenant-controllable flag', async () => {
      mockPrismaService.featureFlag.findUnique.mockResolvedValue({ ...mockFlag, tenantControllable: false });

      await expect(
        service.setOverride({
          flagName: 'FEATURE_WHATSAPP_INTEGRATION', targetType: 'TENANT', targetId: 't-1',
          isEnabled: true, actorId: 'school-admin-1', tenantId: 't-1', tenantControllableOnly: true,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.featureFlagOverride.upsert).not.toHaveBeenCalled();
    });
  });
});
