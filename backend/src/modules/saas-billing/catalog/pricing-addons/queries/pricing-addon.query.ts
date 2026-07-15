import { Prisma } from '@prisma/client';

import { PricingAddonQueryDto } from '../dto/pricing-addon-query.dto';
import {
  PricingAddonSearch,
  PricingAddonSorting,
} from '../constants/pricing-addon.constants';

export class PricingAddonQueryBuilder {
  static buildWhere(
    query: PricingAddonQueryDto,
  ): Prisma.PricingAddonWhereInput {
    const where: Prisma.PricingAddonWhereInput = {
      deletedAt: null,
    };

    if (query.search) {
      where.OR = PricingAddonSearch.SEARCHABLE_FIELDS.map(
        (field) => ({
          [field]: {
            contains: query.search,
            mode: 'insensitive',
          },
        }),
      ) as Prisma.PricingAddonWhereInput[];
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.billingType) {
      where.billingType = query.billingType;
    }

    if (query.currency) {
      where.currency = query.currency;
    }

    if (query.isActive !== undefined) {
      where.isActive =
        query.isActive === 'true';
    }

    return where;
  }

  static buildOrderBy(
    query: PricingAddonQueryDto,
  ): Prisma.PricingAddonOrderByWithRelationInput {
    return {
      [
        query.sortBy ??
          PricingAddonSorting.DEFAULT_SORT_FIELD
      ]:
        query.sortOrder ??
        PricingAddonSorting.DEFAULT_SORT_ORDER,
    };
  }

  static buildPagination(
    query: PricingAddonQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return {
      skip: (page - 1) * limit,
      take: limit,
    };
  }
}
