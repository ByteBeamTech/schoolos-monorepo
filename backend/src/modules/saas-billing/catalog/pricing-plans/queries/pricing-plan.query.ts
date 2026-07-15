import { Prisma } from '@prisma/client';

import { PricingPlanQueryDto } from '../dto/pricing-plan-query.dto';
import {
  PricingPlanSearch,
  PricingPlanSorting,
} from '../constants/pricing-plan.constants';

export class PricingPlanQueryBuilder {
  static buildWhere(
    query: PricingPlanQueryDto,
  ): Prisma.PricingPlanWhereInput {
    const where: Prisma.PricingPlanWhereInput = {
      deletedAt: null,
    };

    if (query.search) {
      where.OR = PricingPlanSearch.SEARCHABLE_FIELDS.map((field) => ({
        [field]: {
          contains: query.search,
          mode: 'insensitive',
        },
      })) as Prisma.PricingPlanWhereInput[];
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.tier) {
      where.tier = query.tier;
    }

    if (query.model) {
      where.model = query.model;
    }

    if (query.currency) {
      where.currency = query.currency;
    }

    if (query.region) {
      where.region = query.region;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    return where;
  }

  static buildOrderBy(
    query: PricingPlanQueryDto,
  ): Prisma.PricingPlanOrderByWithRelationInput {
    return {
      [query.sortBy ??
        PricingPlanSorting.DEFAULT_SORT_FIELD]:
        query.sortOrder ??
        PricingPlanSorting.DEFAULT_SORT_ORDER,
    };
  }

  static buildPagination(
    query: PricingPlanQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return {
      skip: (page - 1) * limit,
      take: limit,
    };
  }
}
