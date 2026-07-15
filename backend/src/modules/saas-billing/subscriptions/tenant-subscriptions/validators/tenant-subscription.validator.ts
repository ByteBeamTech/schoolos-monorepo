import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { SubscriptionStatus, TenantSubscription } from '@prisma/client';

import { TenantSubscriptionRepository } from '../repositories/tenant-subscription.repository';

@Injectable()
export class TenantSubscriptionValidator {
  constructor(
    private readonly repository: TenantSubscriptionRepository,
  ) {}

  async ensureExists(
    id: string,
  ): Promise<TenantSubscription> {
    const subscription =
      await this.repository.findById(id);

    if (!subscription) {
      throw new NotFoundException(
        'Subscription not found.',
      );
    }

    return subscription;
  }

  async ensureCurrentSubscription(
    tenantId: string,
  ): Promise<TenantSubscription> {
    const subscription =
      await this.repository.findCurrentByTenant(
        tenantId,
      );

    if (!subscription) {
      throw new NotFoundException(
        'Current subscription not found.',
      );
    }

    return subscription;
  }

  async ensureCanUpgrade(
    id: string,
  ): Promise<TenantSubscription> {
    const subscription =
      await this.ensureExists(id);

    if (
      subscription.status ===
      SubscriptionStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cancelled subscriptions cannot be upgraded.',
      );
    }

    return subscription;
  }

  async ensureCanDowngrade(
    id: string,
  ): Promise<TenantSubscription> {
    const subscription =
      await this.ensureExists(id);

    if (
      subscription.status ===
      SubscriptionStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cancelled subscriptions cannot be downgraded.',
      );
    }

    return subscription;
  }

  async ensureCanCancel(
    id: string,
  ): Promise<TenantSubscription> {
    const subscription =
      await this.ensureExists(id);

    if (
      subscription.status ===
      SubscriptionStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Subscription already cancelled.',
      );
    }

    return subscription;
  }

  async ensureCanRenew(
    id: string,
  ): Promise<TenantSubscription> {
    const subscription =
      await this.ensureExists(id);

    if (!subscription.autoRenew) {
      throw new BadRequestException(
        'Auto renewal is disabled.',
      );
    }

    return subscription;
  }

  async ensureTrialNotExpired(
    id: string,
  ): Promise<TenantSubscription> {
    const subscription =
      await this.ensureExists(id);

    if (
      subscription.trialEndsAt &&
      subscription.trialEndsAt <
        new Date()
    ) {
      throw new BadRequestException(
        'Trial period has expired.',
      );
    }

    return subscription;
  }
}
