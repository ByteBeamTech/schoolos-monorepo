import { Module } from '@nestjs/common';

import { PrismaModule } from '@infra/database/prisma.module';

import { PricingPlansController } from './controllers/pricing-plans.controller';
import { PricingPlanMapper } from './mappers/pricing-plan.mapper';
import { PricingPlanPolicy } from './policies/pricing-plan.policy';
import { PricingPlanRepository } from './repositories/pricing-plan.repository';
import { PricingPlansService } from './services/pricing-plans.service';
import { PricingPlanValidator } from './validators/pricing-plan.validator';

@Module({
  imports: [PrismaModule],

  controllers: [PricingPlansController],

  providers: [
    PricingPlansService,
    PricingPlanRepository,
    PricingPlanValidator,
    PricingPlanMapper,
    PricingPlanPolicy,
  ],

  exports: [PricingPlansService],
})
export class PricingPlansModule {}
