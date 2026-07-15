import { Injectable } from '@nestjs/common';
import { TenantAddon } from '@prisma/client';

import { PrismaService } from '@infra/database/prisma.service';

import { CreateTenantAddonDto } from '../dto/create-tenant-addon.dto';
import { UpdateTenantAddonDto } from '../dto/update-tenant-addon.dto';
import { TenantAddonQueryDto } from '../dto/tenant-addon-query.dto';
import { TenantAddonQueryBuilder } from '../queries/tenant-addon.query';

@Injectable()
export class TenantAddonRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
  tenantId: string,
  dto: CreateTenantAddonDto,
): Promise<TenantAddon> {
  const pricingAddon =
    await this.prisma.pricingAddon.findUnique({
      where: {
        id: dto.addonId,
      },
      select: {
        amount: true,
      },
    });

  if (!pricingAddon) {
    throw new Error(
      'Pricing addon not found.',
    );
  }

  return this.prisma.tenantAddon.create({
    data: {
      tenant: {
        connect: {
          id: tenantId,
        },
      },

      subscription: {
        connect: {
          id: dto.subscriptionId,
        },
      },

      addon: {
        connect: {
          id: dto.addonId,
        },
      },

      quantity: dto.quantity,

      unitPrice:
        pricingAddon.amount,

      status: dto.status,

      startsAt: dto.startsAt,

      endsAt: dto.endsAt,

      notes: dto.notes,
    },
  });
}
  
  
  
  
  
  async update(
    id: string,
    dto: UpdateTenantAddonDto,
  ): Promise<TenantAddon> {
    return this.prisma.tenantAddon.update({
      where: {
        id,
      },
      data: {
        ...dto,
      },
    });
  }

  async findById(
    id: string,
  ): Promise<TenantAddon | null> {
    return this.prisma.tenantAddon.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        addon: true,
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });
  }

  async exists(
    tenantId: string,
    subscriptionId: string,
    addonId: string,
  ): Promise<boolean> {
    const count =
      await this.prisma.tenantAddon.count({
        where: {
          tenantId,
          subscriptionId,
          addonId,
          deletedAt: null,
        },
      });

    return count > 0;
  }

  async findBySubscription(
    subscriptionId: string,
  ): Promise<TenantAddon[]> {
    return this.prisma.tenantAddon.findMany({
      where: {
        subscriptionId,
        deletedAt: null,
      },
      include: {
        addon: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async findAll(
    query: TenantAddonQueryDto,
  ) {
    const where =
      TenantAddonQueryBuilder.buildWhere(
        query,
      );

    const orderBy =
      TenantAddonQueryBuilder.buildOrderBy(
        query,
      );

    const pagination =
      TenantAddonQueryBuilder.buildPagination(
        query,
      );

    const [items, total] =
      await Promise.all([
        this.prisma.tenantAddon.findMany({
          where,
          include: {
            addon: true,
            subscription: {
              include: {
                plan: true,
              },
            },
          },
          orderBy,
          ...pagination,
        }),
        this.prisma.tenantAddon.count({
          where,
        }),
      ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(
        total / query.limit,
      ),
    };
  }

  async activate(
    id: string,
  ): Promise<TenantAddon> {
    return this.prisma.tenantAddon.update({
      where: {
        id,
      },
      data: {
        status: 'ACTIVE',
      },
    });
  }


  async deactivate(
  id: string,
): Promise<TenantAddon> {
  return this.prisma.tenantAddon.update({
    where: {
      id,
    },
    data: {
      status: 'CANCELLED',
    },
  });
}

  async archive(
    id: string,
  ): Promise<TenantAddon> {
    return this.prisma.tenantAddon.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
