import { Injectable, NotImplementedException } from '@nestjs/common';
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

  // ─── PR-2 (COMM-004 gap-fill scaffolding) ──────────────────────────────────
  //
  // These are read-side helpers only. `update()` above is UNCHANGED — it still
  // mutates the plan row in place. Full immutable versioning (update() closing
  // out the old row and creating a new one) is PR-4 scope; see ADR COMM-004.
  //
  // Until PR-4 lands, each `code` has exactly one row, so getCurrentVersion()
  // and findByCode() return the same thing today. The methods are written
  // against the eventual multi-row-per-code model now so their *callers*
  // don't need to change when PR-4 ships -- only these methods' internals will.

  /**
   * The version of a plan that is effective right now (effectiveFrom <= now
   * <= effectiveTo, or effectiveTo is null). NOT necessarily the highest
   * version number -- a future-dated version can exist without being current.
   */
  async getCurrentVersion(
    code: string,
  ): Promise<PricingPlan | null> {
    const now = new Date();
    return this.prisma.pricingPlan.findFirst({
      where: {
        code,
        deletedAt: null,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /** A specific plan version row, by its own id. */
  async getVersion(
    id: string,
  ): Promise<PricingPlan | null> {
    return this.findById(id);
  }

  /** A specific plan version, by (code, version number) rather than row id. */
  async getVersionByNumber(
    code: string,
    version: number,
  ): Promise<PricingPlan | null> {
    return this.prisma.pricingPlan.findFirst({
      where: { code, version, deletedAt: null },
    });
  }

  /**
   * NOT YET IMPLEMENTED. Will close out the current version
   * (set effectiveTo = now) and create version+1 in its place. This is the
   * PR-4 change (ADR COMM-004) -- see PR-1/PR-2 scoping discussion for why
   * it's deliberately excluded here: update()'s blast radius (subscription
   * creation, upgrade, invoice generation, admin UI, unique constraints)
   * needs to be handled as one coordinated change, not bolted onto a
   * gap-fill PR.
   */
  async createNextVersion(
    _code: string,
    _changes: Partial<CreatePricingPlanDto>,
  ): Promise<PricingPlan> {
    throw new NotImplementedException(
      'Plan versioning (createNextVersion) is PR-4 scope — see ADR COMM-004. ' +
      'update() still mutates in place until then.',
    );
  }
}
