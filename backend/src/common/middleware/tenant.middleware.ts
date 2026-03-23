import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger('TenantMiddleware');

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    // 1. Header se ID ya Slug uthao
    const identifier = req.headers['x-tenant-id'] as string;

    if (!identifier) {
      this.logger.error('No x-tenant-id header found');
      throw new UnauthorizedException('Missing tenant identifier.');
    }

    // 2. Database mein dhoondo (ID ya Slug dono check karega)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { id: identifier },
          { slug: identifier }
        ]
      },
      select: { id: true, slug: true, status: true }
    });

    if (!tenant) {
      this.logger.error(`Tenant not found in DB: ${identifier}`);
      throw new UnauthorizedException(`Tenant not found: ${identifier}`);
    }

    // 3. Request object mein data daal do
    (req as any).tenantId = tenant.id;
    (req as any).tenantSlug = tenant.slug;

    this.logger.log(`✅ Resolved Tenant: ${tenant.slug}`);
    next();
  }
}
