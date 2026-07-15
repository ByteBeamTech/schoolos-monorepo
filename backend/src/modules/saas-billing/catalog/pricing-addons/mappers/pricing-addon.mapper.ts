import { Injectable } from '@nestjs/common';
import { PricingAddon } from '@prisma/client';

import {
  PricingAddonListResponse,
  PricingAddonResponse,
} from '../interfaces/pricing-addon-response.interface';

@Injectable()
export class PricingAddonMapper {
  toResponse(
    addon: PricingAddon,
  ): PricingAddonResponse {
    return {
      id: addon.id,

      code: addon.code,

      name: addon.name,

      description: addon.description,

      category: addon.category,

      billingType: addon.billingType,

      amount: Number(addon.amount),

      currency: addon.currency,

      isActive: addon.isActive,

      metadata:
        (addon.metadata ??
          null) as Record<
          string,
          unknown
        > | null,

      createdAt: addon.createdAt,

      updatedAt: addon.updatedAt,
    };
  }

  toResponses(
    addons: PricingAddon[],
  ): PricingAddonResponse[] {
    return addons.map((addon) =>
      this.toResponse(addon),
    );
  }

  toPagedResponse(
    data: {
      items: PricingAddon[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    },
  ): PricingAddonListResponse {
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
