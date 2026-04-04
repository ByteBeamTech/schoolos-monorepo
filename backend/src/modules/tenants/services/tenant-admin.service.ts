import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';

@Injectable()
export class TenantAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // God-Mode Toggle for any feature
  async toggleFeature(id: string, feature: string, status: boolean) {
    return this.prisma.tenant.update({
      where: { id },
      data: { [feature]: status } as any,
    });
  }

  // Advanced Filtering for Superadmin
  async listSchools(filters: any) {
    const where: any = {};
    if (filters.region)  where.region = filters.region;
    if (filters.status)  where.status = filters.status;
    if (filters.city)    where.address = { path: ['city'], string_contains: filters.city };

    return this.prisma.tenant.findMany({ where });
  }
}
