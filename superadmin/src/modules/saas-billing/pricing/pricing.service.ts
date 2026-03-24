import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/infra/prisma/prisma.service';
import type {
  PricingPlan,
  PricingCalculationResult,
  AssignPricingDto,
  CalculatePricingDto,
  CreatePricingPlanDto,
} from '@schoolos/api-contracts/pricing';
import { PricingFactory } from './pricing.factory';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Plans CRUD -------------------------------------------------------------

  async listPlans(region?: string): Promise<PricingPlan[]> {
    const plans = await this.prisma.pricingPlan.findMany({
      where: {
        isActive: true,
        ...(region ? { region: region as any } : {}),
      },
      orderBy: [{ tier: 'asc' }, { billingCycleMonths: 'asc' }],
    });
    return plans as unknown as PricingPlan[];
  }

  async getPlan(planId: string): Promise<PricingPlan> {
    const plan = await this.prisma.pricingPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`PricingPlan ${planId} not found`);
    return plan as unknown as PricingPlan;
  }

  async createPlan(dto: CreatePricingPlanDto): Promise<PricingPlan> {
    // Validate model-specific required fields
    if (dto.model === 'PER_STUDENT' && dto.perStudentRate === undefined) {
      throw new BadRequestException('perStudentRate is required for PER_STUDENT model');
    }
    if (dto.model === 'SUBSCRIPTION' && dto.baseFee === undefined) {
      throw new BadRequestException('baseFee is required for SUBSCRIPTION model');
    }
    if (dto.model === 'HYBRID') {
      if (dto.baseFee === undefined) throw new BadRequestException('baseFee is required for HYBRID model');
      if (dto.perStudentRate === undefined && dto.overageRate === undefined) {
        throw new BadRequestException('perStudentRate or overageRate is required for HYBRID model');
      }
    }

    const plan = await this.prisma.pricingPlan.create({
      data: {
        ...dto,
        features: dto.features ?? [],
      },
    });
    return plan as unknown as PricingPlan;
  }

  async updatePlan(planId: string, dto: Partial<CreatePricingPlanDto>): Promise<PricingPlan> {
    await this.getPlan(planId); // throws if not found
    const plan = await this.prisma.pricingPlan.update({
      where: { id: planId },
      data: dto,
    });
    return plan as unknown as PricingPlan;
  }

  async deactivatePlan(planId: string): Promise<void> {
    await this.getPlan(planId);
    await this.prisma.pricingPlan.update({
      where: { id: planId },
      data: { isActive: false },
    });
  }

  // --- Calculate --------------------------------------------------------------

  async calculate(dto: CalculatePricingDto): Promise<PricingCalculationResult> {
    const plan = await this.getPlan(dto.planId);
    return PricingFactory.calculate({
      plan,
      studentCount: dto.studentCount,
      taxPercent: dto.taxPercent ?? 0,
      customPerStudentRate: dto.customPerStudentRate,
      customBaseFee: dto.customBaseFee,
    });
  }

  // --- Assign plan to tenant --------------------------------------------------

  async assignToTenant(dto: AssignPricingDto): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${dto.tenantId} not found`);

    const plan = await this.getPlan(dto.planId);

    const now = new Date();
    const trialDays = dto.trialDays ?? plan.trialDays ?? 30;
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    // Period end = now + billingCycleMonths
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + plan.billingCycleMonths);

    await this.prisma.tenantSubscription.upsert({
      where: { tenantId: dto.tenantId },
      create: {
        tenantId: dto.tenantId,
        planId: dto.planId,
        model: plan.model,
        status: 'TRIAL',
        currency: plan.currency,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEndsAt,
        gateway: dto.gateway,
        customPerStudentRate: dto.customPerStudentRate ?? null,
        customBaseFee: dto.customBaseFee ?? null,
      },
      update: {
        planId: dto.planId,
        model: plan.model,
        currency: plan.currency,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        gateway: dto.gateway,
        customPerStudentRate: dto.customPerStudentRate ?? null,
        customBaseFee: dto.customBaseFee ?? null,
        updatedAt: now,
      },
    });
  }

  // --- Get tenant subscription ------------------------------------------------

  async getTenantSubscription(tenantId: string) {
    return this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
  }

  // --- Preview bill for tenant ------------------------------------------------

  async previewBillForTenant(
    tenantId: string,
    taxPercent = 0,
  ): Promise<PricingCalculationResult | null> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription) return null;

    const studentCount = await this.prisma.student.count({
      where: { tenantId, status: 'active' },
    });

    return PricingFactory.calculate({
      plan: subscription.plan as unknown as PricingPlan,
      studentCount,
      taxPercent,
      customPerStudentRate: subscription.customPerStudentRate
        ? Number(subscription.customPerStudentRate)
        : undefined,
      customBaseFee: subscription.customBaseFee
        ? Number(subscription.customBaseFee)
        : undefined,
    });
  }
}