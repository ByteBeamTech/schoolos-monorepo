import { Injectable } from '@nestjs/common';
import { TenantSubscription } from '@prisma/client';

export interface TenantSubscriptionResponse {
  id: string;

  tenantId: string;

  planId: string;

  status: string;

  model: string;

  gateway: string | null;

  currency: string;

  isCurrent: boolean;

  autoRenew: boolean;

  currentPeriodStart: Date;

  currentPeriodEnd: Date;

  startedAt: Date;

  renewalDate: Date | null;

  trialEndsAt: Date | null;

  cancelledAt: Date | null;

  createdAt: Date;

  updatedAt: Date;
}

@Injectable()
export class TenantSubscriptionMapper {
  toResponse(
    subscription: TenantSubscription,
  ): TenantSubscriptionResponse {
    return {
      id: subscription.id,

      tenantId: subscription.tenantId,

      planId: subscription.planId,

      status: subscription.status,

      model: subscription.model,

      gateway: subscription.gateway,

      currency: subscription.currency,

      isCurrent: subscription.isCurrent,

      autoRenew: subscription.autoRenew,

      currentPeriodStart:
        subscription.currentPeriodStart,

      currentPeriodEnd:
        subscription.currentPeriodEnd,

      startedAt:
        subscription.startedAt,

      renewalDate:
        subscription.renewalDate,

      trialEndsAt:
        subscription.trialEndsAt,

      cancelledAt:
        subscription.cancelledAt,

      createdAt:
        subscription.createdAt,

      updatedAt:
        subscription.updatedAt,
    };
  }

  toResponses(
    subscriptions: TenantSubscription[],
  ): TenantSubscriptionResponse[] {
    return subscriptions.map((subscription) =>
      this.toResponse(subscription),
    );
  }

  toPagedResponse(data: {
    items: TenantSubscription[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }) {
    return {
      data: this.toResponses(
        data.items,
      ),

      total: data.total,

      page: data.page,

      limit: data.limit,

      totalPages:
        data.totalPages,
    };
  }
}
