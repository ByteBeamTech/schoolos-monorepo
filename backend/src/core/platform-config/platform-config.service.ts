// core/platform-config/platform-config.service.ts
//
// Generic get/set for the PlatformConfig key-value table. Kept small and
// generic on purpose -- SLA policy is the first real consumer, but the
// Settings page's own placeholder text already named several other
// future config needs (region control, gateway config, platform-wide
// toggles) that can reuse this same get/set without their own service.
// Lives in core/ (not modules/superadmin/) and is registered via a
// @Global() module, same pattern as RealtimeModule -- this is a
// cross-cutting utility multiple unrelated modules need (superadmin's
// own controller, support.service.ts for SLA policy, and whatever else
// grows out of the Settings page later), not superadmin-domain business
// logic that belongs bundled into SuperadminModule.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';

@Injectable()
export class PlatformConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get<T = any>(key: string): Promise<T | null> {
    const row = await this.prisma.platformConfig.findUnique({ where: { key } });
    return row ? (row.value as T) : null;
  }

  async set(key: string, value: unknown, updatedBy: string): Promise<void> {
    await this.prisma.platformConfig.upsert({
      where:  { key },
      update: { value: value as any, updatedBy },
      create: { key, value: value as any, updatedBy },
    });
  }
}
