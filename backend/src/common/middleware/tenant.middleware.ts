import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../infra/database/prisma.service';

export const TENANT_ID_KEY  = 'tenantId';
export const TENANT_SLUG_KEY = 'tenantSlug';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger('TenantMiddleware');

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls:    ClsService,          // ← inject CLS
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    // 1. Read identifier from header (ID or slug both accepted)
    const identifier = req.headers['x-tenant-id'] as string;
    if (!identifier) {
      this.logger.error('No x-tenant-id header found');
      throw new UnauthorizedException('Missing tenant identifier.');
    }

    // 2. Resolve tenant from DB
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
      select: { id: true, slug: true, status: true },
    });

    if (!tenant) {
      this.logger.error(`Tenant not found in DB: ${identifier}`);
      throw new UnauthorizedException(`Tenant not found: ${identifier}`);
    }

    if (tenant.status !== 'ACTIVE') {
      this.logger.warn(`Tenant ${tenant.slug} is not active (status: ${tenant.status})`);
      throw new UnauthorizedException(`Tenant account is ${tenant.status.toLowerCase()}.`);
    }

    // 3. Write to request object (backwards compat for anything reading req.tenantId)
    (req as any).tenantId   = tenant.id;
    (req as any).tenantSlug = tenant.slug;

    // 4. Write to CLS store — this is what PrismaService reads automatically
    this.cls.set(TENANT_ID_KEY,  tenant.id);
    this.cls.set(TENANT_SLUG_KEY, tenant.slug);

    this.logger.log(`✅ Resolved Tenant: ${tenant.slug} (${tenant.id})`);
    next();
  }
}
