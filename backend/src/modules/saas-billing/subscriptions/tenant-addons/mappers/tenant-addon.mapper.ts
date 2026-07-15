import { Injectable } from '@nestjs/common';
import { TenantAddon } from '@prisma/client';

import {
  TenantAddonListResponse,
  TenantAddonResponse,
} from '../interfaces/tenant-addon-response.interface';

@Injectable()
export class TenantAddonMapper {
  toResponse(
    addon: TenantAddon,
  ): TenantAddonResponse {
    return {
      id: addon.id,

      tenantId: addon.tenantId,

      subscriptionId: addon.subscriptionId,

      addonId: addon.addonId,

      quantity: addon.quantity,

      unitPrice:
        Number(addon.unitPrice),

      status: addon.status,

      startsAt: addon.startsAt,

      endsAt: addon.endsAt,

      notes: addon.notes,

      metadata:
        (addon.metadata ??
          null) as Record<
          string,
          unknown
        > | null,

      createdAt:
        addon.createdAt,

      updatedAt:
        addon.updatedAt,
    };
  }

  toResponses(
    addons: TenantAddon[],
  ): TenantAddonResponse[] {
    return addons.map((addon) =>
      this.toResponse(addon),
    );
  }

  toPagedResponse(
    data: {
      items: TenantAddon[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    },
  ): TenantAddonListResponse {
    return {
      data:
        this.toResponses(
          data.items,
        ),

      total:
        data.total,

      page:
        data.page,

      limit:
        data.limit,

      totalPages:
        data.totalPages,
    };
  }
}
