import { PartialType } from '@nestjs/swagger';

import { CreateTenantAddonDto } from './create-tenant-addon.dto';

export class UpdateTenantAddonDto extends PartialType(
  CreateTenantAddonDto,
) {}
