import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class RlsMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async setTenantContext(
    tenantId: string,
    isSuperadmin: boolean,
    fn: () => Promise<unknown>,
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId.replace(/'/g, '')}'`);
      await tx.$executeRawUnsafe(`SET LOCAL app.is_superadmin = '${isSuperadmin}'`);
      return fn();
    });
  }
}
