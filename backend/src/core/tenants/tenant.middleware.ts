import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '@infra/database/prisma.service';

declare global {
  namespace Express {
    interface Request {
      tenantId:   string;
      tenantSlug: string;
    }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const tenantId = this.extractTenantId(req);

    if (!tenantId) {
      throw new UnauthorizedException(
        'Missing tenant identifier. Provide x-tenant-id header.',
      );
    }

    // Support lookup by both ID and slug
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { id: tenantId },
          { slug: tenantId },
        ],
      },
      select: { id: true, slug: true, status: true },
    });

    if (!tenant) {
      this.logger.warn(`Tenant not found: ${tenantId} | IP: ${req.ip}`);
      throw new UnauthorizedException(`Tenant not found: ${tenantId}`);
    }

    if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
      this.logger.warn(`Blocked ${tenant.status} tenant: ${tenantId}`);
      throw new UnauthorizedException(
        `Tenant account is ${tenant.status.toLowerCase()}. Contact support.`,
      );
    }

    this.logger.debug(`Tenant resolved: ${tenant.slug} (${tenantId})`);
    req.tenantId   = tenant.id;
    req.tenantSlug = tenant.slug;

    next();
  }

  private extractTenantId(req: Request): string | null {
    // Priority 1: x-tenant-id header (always check first)
    const header = req.headers['x-tenant-id'];
    if (header && typeof header === 'string' && header.trim()) {
      return header.trim();
    }

    // Priority 2: Subdomain extraction (skip if host is an IP address)
    const host = req.headers.host || '';
    const hostWithoutPort = host.split(':')[0];
    
    // Check if host is an IP address (skip subdomain logic for IPs)
    const isIPAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostWithoutPort);
    
    if (!isIPAddress) {
      const parts = hostWithoutPort.split('.');
      if (parts.length >= 3) {
        const subdomain = parts[0];
        const reserved = ['www', 'api', 'admin', 'superadmin', 'localhost'];
        if (!reserved.includes(subdomain)) return subdomain;
      }
    }

    // Priority 3: Query param (development only)
    if (process.env.NODE_ENV === 'development') {
      const qp = req.query['tenantId'];
      if (qp && typeof qp === 'string') return qp;
    }

    return null;
  }
}
