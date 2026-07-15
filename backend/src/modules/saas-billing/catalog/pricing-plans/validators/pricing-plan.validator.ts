import { CreatePricingPlanDto } from '../dto/create-pricing-plan.dto';
import { UpdatePricingPlanDto } from '../dto/update-pricing-plan.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PricingPlan } from '@prisma/client';

import { PricingPlanRepository } from '../repositories/pricing-plan.repository';

@Injectable()
export class PricingPlanValidator {
  constructor(
    private readonly repository: PricingPlanRepository,
  ) {}

  async ensureExists(id: string): Promise<PricingPlan> {
    const plan = await this.repository.findById(id);

    if (!plan) {
      throw new NotFoundException('Pricing plan not found.');
    }

    return plan;
  }

  async ensureUniqueCode(code: string, ignoreId?: string): Promise<void> {
    const existing = await this.repository.findByCode(code);

    if (!existing) {
      return;
    }

    if (ignoreId && existing.id === ignoreId) {
      return;
    }

    throw new ConflictException(
      `Pricing plan code '${code}' already exists.`,
    );
  }

  async ensureCanArchive(id: string): Promise<PricingPlan> {
    const plan = await this.ensureExists(id);

    if (!plan.isActive) {
      throw new BadRequestException(
        'Pricing plan is already archived.',
      );
    }

    return plan;
  }

  async ensureCanRestore(id: string): Promise<PricingPlan> {
    const plan = await this.ensureExists(id);

    if (plan.deletedAt === null) {
      throw new BadRequestException(
        'Pricing plan is already active.',
      );
    }

    return plan;
  }

  async ensureCanPublish(id: string): Promise<PricingPlan> {
    const plan = await this.ensureExists(id);

    if (plan.deletedAt) {
      throw new BadRequestException(
        'Archived pricing plans cannot be published.',
      );
    }

    return plan;
  }

async validateCreate(
  dto: CreatePricingPlanDto,
): Promise<void> {
  await this.ensureUniqueCode(dto.code);

}


  async validateUpdate(
    id: string,
     dto: UpdatePricingPlanDto,
  ): Promise<PricingPlan> {
    const plan = await this.ensureExists(id);
if (dto.code) {
    await this.ensureUniqueCode(dto.code, id);
}


    return plan;
  }
}
