import { Injectable } from '@nestjs/common';
import { PricingPlan } from '@prisma/client';

import { PrismaService } from '@infra/database/prisma.service';

import { CreatePricingPlanDto } from '../dto/create-pricing-plan.dto';
import { PricingPlanQueryDto } from '../dto/pricing-plan-query.dto';
import { UpdatePricingPlanDto } from '../dto/update-pricing-plan.dto';
import { PricingPlanQueryBuilder } from '../queries/pricing-plan.query';

@Injectable()
export class PricingPlanRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    dto: CreatePricingPlanDto,
  ): Promise<PricingPlan> {
    return this.prisma.pricingPlan.create({
      data: {
        ...dto,
      },
    });
  }

  async update(
    id: string,
    dto: UpdatePricingPlanDto,
  ): Promise<PricingPlan> {
    return this.prisma.pricingPlan.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }

  async findById(
    id: string,
  ): Promise<PricingPlan | null> {
    return this.prisma.pricingPlan.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  async findByCode(
    code: string,
  ): Promise<PricingPlan | null> {
    return this.prisma.pricingPlan.findFirst({
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
      await this.prisma.pricingPlan.count({
        where: {
          code,
          deletedAt: null,
        },
      });

    return count > 0;
  }

  async findAll(
    query: PricingPlanQueryDto,
  ) {
    const where =
      PricingPlanQueryBuilder.buildWhere(query);

    const orderBy =
      PricingPlanQueryBuilder.buildOrderBy(query);

    const pagination =
      PricingPlanQueryBuilder.buildPagination(query);

    const [items, total] =
      await Promise.all([
        this.prisma.pricingPlan.findMany({
          where,
          orderBy,
          ...pagination,
        }),
        this.prisma.pricingPlan.count({
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

  async findPublic() {
    return this.prisma.pricingPlan.findMany({
      where: {
        deletedAt: null,
        isPublic: true,
        isActive: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });
  }

  async findRecommended() {
    return this.prisma.pricingPlan.findMany({
      where: {
        deletedAt: null,
        recommended: true,
        isActive: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });
  }

  async archive(
    id: string,
  ): Promise<PricingPlan> {
    return this.prisma.pricingPlan.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  async restore(
    id: string,
  ): Promise<PricingPlan> {
    return this.prisma.pricingPlan.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: true,
      },
    });
  }

  async publish(
    id: string,
  ): Promise<PricingPlan> {
    return this.prisma.pricingPlan.update({
      where: { id },
      data: {
        isActive: true,
      },
    });
  }
}
