import { Prisma } from '@prisma/client';

import { TenantSubscriptionQueryDto } from '../dto/tenant-subscription-query.dto';
import {
  TenantSubscriptionSearch,
  TenantSubscriptionSorting,
} from '../constants/tenant-subscription.constants';

export class TenantSubscriptionQueryBuilder {
  static buildWhere(
    query: TenantSubscriptionQueryDto,
  ): Prisma.TenantSubscriptionWhereInput {
    const where: Prisma.TenantSubscriptionWhereInput = {};

    if (query.search) {
      where.OR =
        TenantSubscriptionSearch.SEARCHABLE_FIELDS.map(
          (field) => ({
            [field]: {
              contains: query.search,
              mode: 'insensitive',
            },
          }),
        ) as Prisma.TenantSubscriptionWhereInput[];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.model) {
      where.model = query.model;
    }

    if (query.currency) {
      where.currency = query.currency;
    }

    return where;
  }

  static buildOrderBy(
    query: TenantSubscriptionQueryDto,
  ): Prisma.TenantSubscriptionOrderByWithRelationInput {
    return {
      [
        query.sortBy ??
          TenantSubscriptionSorting.DEFAULT_SORT_FIELD
      ]:
        query.sortOrder ??
        TenantSubscriptionSorting.DEFAULT_SORT_ORDER,
    };
  }

  static buildPagination(
    query: TenantSubscriptionQueryDto,
  ) {
    const page = query.page ?? 1;

    const limit = query.limit ?? 20;

    return {
      skip: (page - 1) * limit,

      take: limit,
    };
  }
}
