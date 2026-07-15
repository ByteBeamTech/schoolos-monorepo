import { Prisma } from '@prisma/client';

import { TenantAddonQueryDto } from '../dto/tenant-addon-query.dto';

import {
  TenantAddonSearch,
  TenantAddonSorting,
} from '../constants/tenant-addon.constants';

export class TenantAddonQueryBuilder {
  static buildWhere(
    query: TenantAddonQueryDto,
  ): Prisma.TenantAddonWhereInput {
    const where: Prisma.TenantAddonWhereInput = {};

    if (query.search) {
      where.OR =
        TenantAddonSearch.SEARCHABLE_FIELDS.map(
          (field) => ({
            [field]: {
              contains: query.search,
              mode: 'insensitive',
            },
          }),
        ) as Prisma.TenantAddonWhereInput[];
    }

    if (query.status) {
      where.status = query.status;
    }

    return where;
  }

  static buildOrderBy(
    query: TenantAddonQueryDto,
  ): Prisma.TenantAddonOrderByWithRelationInput {
    return {
      [
        query.sortBy ??
          TenantAddonSorting.DEFAULT_SORT_FIELD
      ]:
        query.sortOrder ??
        TenantAddonSorting.DEFAULT_SORT_ORDER,
    };
  }

  static buildPagination(
    query: TenantAddonQueryDto,
  ) {
    const page = query.page ?? 1;

    const limit = query.limit ?? 20;

    return {
      skip: (page - 1) * limit,

      take: limit,
    };
  }
}
