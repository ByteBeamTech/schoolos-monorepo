import { Module } from '@nestjs/common';

import { PrismaModule } from '@infra/database/prisma.module';

import { TenantSubscriptionsController } from './controllers/tenant-subscriptions.controller';
import { TenantSubscriptionsService } from './services/tenant-subscriptions.service';
import { TenantSubscriptionRepository } from './repositories/tenant-subscription.repository';
import { TenantSubscriptionValidator } from './validators/tenant-subscription.validator';
import { TenantSubscriptionMapper } from './mappers/tenant-subscription.mapper';
import { TenantSubscriptionPolicy } from './policies/tenant-subscription.policy';

@Module({
  imports: [PrismaModule],

  controllers: [
    TenantSubscriptionsController,
  ],

  providers: [
    TenantSubscriptionsService,
    TenantSubscriptionRepository,
    TenantSubscriptionValidator,
    TenantSubscriptionMapper,
    TenantSubscriptionPolicy,
  ],

  exports: [
    TenantSubscriptionsService,
  ],
})
export class TenantSubscriptionsModule {}
