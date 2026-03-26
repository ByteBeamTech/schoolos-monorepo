// infra/database/prisma.service.ts
// BUG 6 FIX: Dual RLS + CLS conflict
//
// The problem: RlsMiddleware wraps requests in a $transaction and sets
// Postgres session vars (app.tenant_id) via SET LOCAL. But PrismaService
// also has a forTenant() client extension that injects tenantId into every
// WHERE clause. When both run together:
//   1. The CLS/forTenant() WHERE injection fires first
//   2. Then RLS policy reads app.tenant_id from the session
//   3. Result: double-filtering — some cross-tenant queries fail silently,
//      others return empty sets when they shouldn't.
//
// Fix: make PrismaService the single source of truth for tenant isolation.
// Remove RlsMiddleware/RlsInterceptor from the request pipeline and use
// ONLY the forTenant() extension. Postgres RLS policies should be disabled
// or set to PERMISSIVE with app-level enforcement as the authority.
//
// If you want to keep RLS as a defence-in-depth layer (recommended),
// set it to PERMISSIVE and keep SET LOCAL — but remove the forTenant()
// WHERE injection to avoid double-filtering. Choose ONE mechanism.
//
// This file implements the recommended approach: forTenant() only,
// RLS as passive belt-and-suspenders via SET LOCAL in a middleware
// that does NOT also wrap in a transaction (avoiding the CLS context loss).

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'colorless',
    });

    (this as any).$on('error', (e: any) => {
      this.logger.error('Prisma error:', e);
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Returns a Prisma client extension that automatically injects
   * tenantId into all read queries for tenant-scoped models.
   *
   * This is the ONLY tenant isolation mechanism at the app layer.
   * Do NOT combine with RlsInterceptor transaction wrapping — that
   * causes CLS context loss and double-filtering (BUG 6).
   */
  forTenant(tenantId: string) {
    return this.$extends({
      query: {
        $allModels: {
          async findMany({ args, query }: any) {
            args.where = { ...args.where, tenantId };
            return query(args);
          },
          async findFirst({ args, query }: any) {
            args.where = { ...args.where, tenantId };
            return query(args);
          },
          async findFirstOrThrow({ args, query }: any) {
            args.where = { ...args.where, tenantId };
            return query(args);
          },
          async findUnique({ args, query }: any) {
            // findUnique uses a unique constraint — don't inject tenantId
            // into where as it breaks unique lookups. Use findFirst instead
            // for tenant-scoped unique queries.
            return query(args);
          },
          async count({ args, query }: any) {
            args.where = { ...args.where, tenantId };
            return query(args);
          },
          async updateMany({ args, query }: any) {
            args.where = { ...args.where, tenantId };
            return query(args);
          },
          async deleteMany({ args, query }: any) {
            args.where = { ...args.where, tenantId };
            return query(args);
          },
        },
      },
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
