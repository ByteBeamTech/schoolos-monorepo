import { PartialType } from '@nestjs/swagger';

import { CreatePricingAddonDto } from './create-pricing-addon.dto';

export class UpdatePricingAddonDto extends PartialType(
  CreatePricingAddonDto,
) {}
