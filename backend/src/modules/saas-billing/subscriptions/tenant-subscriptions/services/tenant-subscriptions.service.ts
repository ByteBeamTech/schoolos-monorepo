import { Injectable } from '@nestjs/common';

import { TenantSubscriptionQueryDto } from '../dto/tenant-subscription-query.dto';

import { TenantSubscriptionMapper } from '../mappers/tenant-subscription.mapper';
import { TenantSubscriptionRepository } from '../repositories/tenant-subscription.repository';
import { TenantSubscriptionValidator } from '../validators/tenant-subscription.validator';

@Injectable()
export class TenantSubscriptionsService {
  constructor(
    private readonly repository: TenantSubscriptionRepository,
    private readonly validator: TenantSubscriptionValidator,
    private readonly mapper: TenantSubscriptionMapper,
  ) {}

  async getCurrentSubscription(
    tenantId: string,
  ) {
    const subscription =
      await this.validator.ensureCurrentSubscription(
        tenantId,
      );

    return this.mapper.toResponse(
      subscription,
    );
  }

  async getById(
    id: string,
  ) {
    const subscription =
      await this.validator.ensureExists(
        id,
      );

    return this.mapper.toResponse(
      subscription,
    );
  }

  async findAll(
    query: TenantSubscriptionQueryDto,
  ) {
    const result =
      await this.repository.findAll(
        query,
      );

    return this.mapper.toPagedResponse(
      result,
    );
  }

  async cancel(
    id: string,
    reason?: string,
  ) {
    await this.validator.ensureCanCancel(
      id,
    );

    const subscription =
      await this.repository.update(
        id,
        {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason,
          isCurrent: false,
        },
      );

    return this.mapper.toResponse(
      subscription,
    );
  }

  async enableAutoRenew(
    id: string,
  ) {
    await this.validator.ensureExists(
      id,
    );

    const subscription =
      await this.repository.update(
        id,
        {
          autoRenew: true,
        },
      );

    return this.mapper.toResponse(
      subscription,
    );
  }

  async disableAutoRenew(
    id: string,
  ) {
    await this.validator.ensureExists(
      id,
    );

    const subscription =
      await this.repository.update(
        id,
        {
          autoRenew: false,
        },
      );

    return this.mapper.toResponse(
      subscription,
    );
  }
}
