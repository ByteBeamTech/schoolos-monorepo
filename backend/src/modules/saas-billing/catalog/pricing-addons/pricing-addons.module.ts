import { Module } from '@nestjs/common';

import { PrismaModule } from '@infra/database/prisma.module';

import { PricingAddonsController } from './controllers/pricing-addons.controller';
import { PricingAddonRepository } from './repositories/pricing-addon.repository';
import { PricingAddonsService } from './services/pricing-addons.service';
import { PricingAddonValidator } from './validators/pricing-addon.validator';
import { PricingAddonMapper } from './mappers/pricing-addon.mapper';
import { PricingAddonPolicy } from './policies/pricing-addon.policy';

@Module({
  imports: [PrismaModule],

  controllers: [PricingAddonsController],

  providers: [
    PricingAddonsService,
    PricingAddonRepository,
    PricingAddonValidator,
    PricingAddonMapper,
    PricingAddonPolicy,
  ],

  exports: [
    PricingAddonsService,
    PricingAddonRepository,
  ],
})
export class PricingAddonsModule {}
