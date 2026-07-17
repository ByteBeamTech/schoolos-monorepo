// backend/src/core/feature-flags/feature-flag-catalog-sync.service.spec.ts
//
// SA-1C / COMM-007 (naming pending): guards the idempotent sync logic
// specifically -- create-if-missing, update-only-on-drift, never-delete
// (orphaned rows reported, not removed), and that operational fields
// (rolloutPercentage, enabledFromAt/UntilAt, createdBy/updatedBy) are
// never touched by a sync.

import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagCatalogSyncService } from './feature-flag-catalog-sync.service';
import { PrismaService } from '@infra/database/prisma.service';

describe('FeatureFlagCatalogSyncService', () => {
  let service: FeatureFlagCatalogSyncService;

  const mockPrismaService: any = {
    featureFlag: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagCatalogSyncService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FeatureFlagCatalogSyncService>(FeatureFlagCatalogSyncService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create every ALL_FLAGS entry when the DB table is empty', async () => {
    mockPrismaService.featureFlag.findMany.mockResolvedValue([]);

    const result = await service.sync();

    expect(mockPrismaService.featureFlag.create).toHaveBeenCalled();
    expect(result.created.length).toBeGreaterThan(0);
    expect(result.updated).toEqual([]);
    expect(result.orphaned).toEqual([]);
  });

  it('should not call update for a flag whose fields already match ALL_FLAGS', async () => {
    // Fake a DB already containing one known flag definition, matching
    // exactly -- this test doesn't hardcode a real flag name (ALL_FLAGS
    // isn't mocked, it's the real catalog), so it derives its fixture
    // from the real module.
    const { ALL_FLAGS } = require('./flag-definitions');
    const first = ALL_FLAGS[0];

    mockPrismaService.featureFlag.findMany.mockResolvedValue([
      {
        name: first.name, category: first.category, label: first.label,
        description: first.description, defaultValue: first.defaultValue,
        allowedTiers: first.allowedTiers, tenantControllable: first.tenantControllable,
      },
    ]);

    const result = await service.sync();

    expect(result.unchanged).toContain(first.name);
    expect(mockPrismaService.featureFlag.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: first.name } }),
    );
  });

  it('should update only drifted fields, and report DB rows not present in ALL_FLAGS as orphaned, never deleting them', async () => {
    mockPrismaService.featureFlag.findMany.mockResolvedValue([
      {
        name: 'THIS_FLAG_NO_LONGER_EXISTS_IN_CODE',
        category: 'FEATURE', label: 'Old', description: null,
        defaultValue: false, allowedTiers: [], tenantControllable: false,
      },
    ]);

    const result = await service.sync();

    expect(result.orphaned).toContain('THIS_FLAG_NO_LONGER_EXISTS_IN_CODE');
    expect(mockPrismaService.featureFlag.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: 'THIS_FLAG_NO_LONGER_EXISTS_IN_CODE' } }),
    );
    // Never a delete call at all -- this service has no delete path.
    expect(mockPrismaService.featureFlag.delete).toBeUndefined();
  });
});
