import { Injectable } from '@nestjs/common';
import { TenantSubscription } from '@prisma/client';

import { PrismaService } from '@infra/database/prisma.service';

import { TenantSubscriptionQueryDto } from '../dto/tenant-subscription-query.dto';
import { TenantSubscriptionQueryBuilder } from '../queries/tenant-subscription.query';

@Injectable()
export class TenantSubscriptionRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findCurrentByTenant(
    tenantId: string,
  ): Promise<TenantSubscription | null> {
    return this.prisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        isCurrent: true,
      },
      include: {
        plan: true,
        addons: {
          include: {
            addon: true,
          },
        },
      },
    });
  }

  async findById(
    id: string,
  ): Promise<TenantSubscription | null> {
    return this.prisma.tenantSubscription.findUnique({
      where: {
        id,
      },
      include: {
        plan: true,
        addons: {
          include: {
            addon: true,
          },
        },
        saasInvoices: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
    });
  }

  async create(
    data: Parameters<
      PrismaService['tenantSubscription']['create']
    >[0]['data'],
  ): Promise<TenantSubscription> {
    return this.prisma.tenantSubscription.create({
      data,
    });
  }

  async update(
    id: string,
    data: Parameters<
      PrismaService['tenantSubscription']['update']
    >[0]['data'],
  ): Promise<TenantSubscription> {
    return this.prisma.tenantSubscription.update({
      where: {
        id,
      },
      data,
    });
  }

  async deactivateCurrent(
    tenantId: string,
  ) {
    return this.prisma.tenantSubscription.updateMany({
      where: {
        tenantId,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    });
  }

  async findAll(
    query: TenantSubscriptionQueryDto,
  ) {
    const where =
      TenantSubscriptionQueryBuilder.buildWhere(
        query,
      );

    const orderBy =
      TenantSubscriptionQueryBuilder.buildOrderBy(
        query,
      );

    const pagination =
      TenantSubscriptionQueryBuilder.buildPagination(
        query,
      );

    const [items, total] =
      await Promise.all([
        this.prisma.tenantSubscription.findMany({
          where,
          include: {
            tenant: true,
            plan: true,
          },
          orderBy,
          ...pagination,
        }),
        this.prisma.tenantSubscription.count({
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
}
