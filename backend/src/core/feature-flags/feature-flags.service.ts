import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { RedisService }  from '../../infra/cache/redis.service';

@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async isEnabled(flagName: string, tenantId: string): Promise<boolean> {
    const cacheKey = this.redis.featureFlagKey(tenantId);
    const cached = await this.redis.getJson<Record<string, boolean>>(cacheKey);
    if (cached && flagName in cached) return cached[flagName];

    const flag = await (this.prisma as any).featureFlag?.findFirst({
      where: { name: flagName, tenantId },
    }).catch(() => null);

    const value = flag?.enabled ?? false;
    const all = cached ?? {};
    all[flagName] = value;
    await this.redis.setJson(cacheKey, all, 60);
    return value;
  }

  async getAllForTenant(tenantId: string): Promise<Record<string, boolean>> {
    const cacheKey = this.redis.featureFlagKey(tenantId);
    const cached = await this.redis.getJson<Record<string, boolean>>(cacheKey);
    if (cached) return cached;

    const flags = await (this.prisma as any).featureFlag?.findMany({
      where: { tenantId },
    }).catch(() => []) ?? [];

    const map: Record<string, boolean> = {};
    for (const f of flags) map[f.name] = f.enabled;
    await this.redis.setJson(cacheKey, map, 60);
    return map;
  }

  async setFlag(tenantId: string, name: string, enabled: boolean): Promise<void> {
    await (this.prisma as any).featureFlag?.upsert({
      where:  { tenantId_name: { tenantId, name } },
      update: { enabled },
      create: { tenantId, name, enabled },
    }).catch(() => null);

    await this.redis.del(this.redis.featureFlagKey(tenantId));
  }
}
