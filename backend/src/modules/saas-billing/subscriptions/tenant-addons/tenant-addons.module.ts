import { Module } from '@nestjs/common';

import { PrismaModule } from '@infra/database/prisma.module';

import { TenantAddonsController } from './controllers/tenant-addons.controller';

import { TenantAddonMapper } from './mappers/tenant-addon.mapper';

import { TenantAddonPolicy } from './policies/tenant-addon.policy';

import { TenantAddonRepository } from './repositories/tenant-addon.repository';

import { TenantAddonsService } from './services/tenant-addons.service';

import { TenantAddonValidator } from './validators/tenant-addon.validator';

@Module({
  imports: [
    PrismaModule,
  ],

  controllers: [
    TenantAddonsController,
  ],

  providers: [
    TenantAddonsService,

    TenantAddonRepository,

    TenantAddonValidator,

    TenantAddonMapper,

    TenantAddonPolicy,
  ],

  exports: [
    TenantAddonsService,
  ],
})
export class TenantAddonsModule {}
