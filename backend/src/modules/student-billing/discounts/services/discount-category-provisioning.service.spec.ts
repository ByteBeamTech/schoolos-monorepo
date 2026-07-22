import { Test } from '@nestjs/testing';
import { DiscountCategoryProvisioningService } from './discount-category-provisioning.service';
import { DEFAULT_DISCOUNT_CATEGORIES } from '../constants/default-discount-categories';
import { DiscountCategory as DiscountCategoryEnum } from '../../dto/billing.dto';

describe('DiscountCategoryProvisioningService', () => {
  let service: DiscountCategoryProvisioningService;
  let tx: any;

  beforeEach(async () => {
    tx = {
      discountCategory: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const module = await Test.createTestingModule({
      providers: [DiscountCategoryProvisioningService],
    }).compile();
    service = module.get(DiscountCategoryProvisioningService);
  });

  // The contract that keeps the API surface and the provisioned data in sync.
  // A code accepted by CreateDiscountDto but never provisioned would pass
  // validation and then fail category resolution at the service layer.
  it('every DiscountCategory enum value the DTO accepts has a provisioned template', () => {
    const templateCodes = new Set(DEFAULT_DISCOUNT_CATEGORIES.map((t) => t.code));
    for (const value of Object.values(DiscountCategoryEnum)) {
      expect(templateCodes.has(value as string)).toBe(true);
    }
  });

  it('provisions no codes beyond what the DTO enum accepts (no orphan templates)', () => {
    const enumValues = new Set(Object.values(DiscountCategoryEnum) as string[]);
    for (const t of DEFAULT_DISCOUNT_CATEGORIES) {
      expect(enumValues.has(t.code)).toBe(true);
    }
  });

  it('creates the full default set for a fresh branch, scoped to tenant and branch', async () => {
    const result = await service.provisionForBranch(tx, 't-1', 'b-1');

    expect(result).toEqual({
      created: DEFAULT_DISCOUNT_CATEGORIES.length,
      skipped: 0,
    });
    const rows = tx.discountCategory.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(DEFAULT_DISCOUNT_CATEGORIES.length);
    for (const row of rows) {
      expect(row.tenantId).toBe('t-1');
      expect(row.branchId).toBe('b-1');
      expect(row.isActive).toBe(true);
      // No explicit id: Prisma's @default(cuid()) must generate it.
      expect(row.id).toBeUndefined();
    }
    expect(rows.map((r: any) => r.code).sort()).toEqual(
      DEFAULT_DISCOUNT_CATEGORIES.map((t) => t.code).sort(),
    );
  });

  it('is idempotent: a fully-provisioned branch creates nothing', async () => {
    tx.discountCategory.findMany.mockResolvedValue(
      DEFAULT_DISCOUNT_CATEGORIES.map((t) => ({ code: t.code })),
    );

    const result = await service.provisionForBranch(tx, 't-1', 'b-1');

    expect(result).toEqual({
      created: 0,
      skipped: DEFAULT_DISCOUNT_CATEGORIES.length,
    });
    expect(tx.discountCategory.createMany).not.toHaveBeenCalled();
  });

  it('fills only the gap on a partially-provisioned branch', async () => {
    tx.discountCategory.findMany.mockResolvedValue([
      { code: 'SIBLING' },
      { code: 'MERIT' },
    ]);

    const result = await service.provisionForBranch(tx, 't-1', 'b-1');

    expect(result.created).toBe(DEFAULT_DISCOUNT_CATEGORIES.length - 2);
    expect(result.skipped).toBe(2);
    const created = tx.discountCategory.createMany.mock.calls[0][0].data.map(
      (r: any) => r.code,
    );
    expect(created).not.toContain('SIBLING');
    expect(created).not.toContain('MERIT');
  });

  it('scopes the existing-row lookup to the branch (not tenant-wide)', async () => {
    await service.provisionForBranch(tx, 't-1', 'b-1');
    expect(tx.discountCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { branchId: 'b-1' } }),
    );
  });

  it('uses the caller-supplied transaction client, never a separate connection', async () => {
    await service.provisionForBranch(tx, 't-1', 'b-1');
    expect(tx.discountCategory.createMany).toHaveBeenCalled();
    expect((service as any).prisma).toBeUndefined();
  });
});
