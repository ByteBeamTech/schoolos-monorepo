import { Injectable } from '@nestjs/common';
import { PricingAddon } from '@prisma/client';

import { PrismaService } from '@infra/database/prisma.service';

import { CreatePricingAddonDto } from '../dto/create-pricing-addon.dto';
import { PricingAddonQueryDto } from '../dto/pricing-addon-query.dto';
import { UpdatePricingAddonDto } from '../dto/update-pricing-addon.dto';
import { PricingAddonQueryBuilder } from '../queries/pricing-addon.query';

@Injectable()
export class PricingAddonRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    dto: CreatePricingAddonDto,
  ): Promise<PricingAddon> {
    return this.prisma.pricingAddon.create({
      data: {
        ...dto,
      },
    });
  }

  async update(
    id: string,
    dto: UpdatePricingAddonDto,
  ): Promise<PricingAddon> {
    return this.prisma.pricingAddon.update({
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
  ): Promise<PricingAddon | null> {
    return this.prisma.pricingAddon.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  async findByCode(
    code: string,
  ): Promise<PricingAddon | null> {
    return this.prisma.pricingAddon.findFirst({
      where: {
        code,
        deletedAt: null,
      },
    });
  }

  async exists(
    code: string,
  ): Promise<boolean> {
    const count =
      await this.prisma.pricingAddon.count({
        where: {
          code,
          deletedAt: null,
        },
      });

    return count > 0;
  }

  async findAll(
    query: PricingAddonQueryDto,
  ) {
    const where =
      PricingAddonQueryBuilder.buildWhere(
        query,
      );

    const orderBy =
      PricingAddonQueryBuilder.buildOrderBy(
        query,
      );

    const pagination =
      PricingAddonQueryBuilder.buildPagination(
        query,
      );

    const [items, total] =
      await Promise.all([
        this.prisma.pricingAddon.findMany({
          where,
          orderBy,
          ...pagination,
        }),
        this.prisma.pricingAddon.count({
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

  async findActive(): Promise<PricingAddon[]> {
    return this.prisma.pricingAddon.findMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async archive(
    id: string,
  ): Promise<PricingAddon> {
    return this.prisma.pricingAddon.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  async restore(
    id: string,
  ): Promise<PricingAddon> {
    return this.prisma.pricingAddon.update({
      where: {
        id,
      },
      data: {
        deletedAt: null,
        isActive: true,
      },
    });
  }
}
