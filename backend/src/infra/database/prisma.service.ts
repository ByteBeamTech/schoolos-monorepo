import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: ConfigService) {
    const poolSize    = config.get<number>('DATABASE_POOL_SIZE', 10);
    const poolTimeout = config.get<number>('DATABASE_POOL_TIMEOUT', 30);
    const dbUrl       = config.get<string>('DATABASE_URL')!;

    // Append pool params to connection URL if not already present
    const url = new URL(dbUrl);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', String(poolSize));
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', String(poolTimeout));
    }

    super({
      datasources: { db: { url: url.toString() } },
      log: [
        { level: 'warn',  emit: 'event' },
        { level: 'error', emit: 'event' },
        // Uncomment for query logging in dev:
        // { level: 'query', emit: 'event' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      (this as any).$on('query', (e: any) => {
        if (e.duration > 500) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query.slice(0, 120)}`);
        }
      });
    }

    (this as any).$on('error', (e: any) => {
      this.logger.error('Prisma error:', e.message);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /** Health check — used by readiness probe */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
  /**
   * forTenant(tenantId) — tenant-safe query proxy
   *
   * Returns a Proxy over PrismaService that auto-injects
   * { tenantId } into the where clause of:
   *   findMany, findFirst, findFirstOrThrow, count, aggregate, groupBy
   *
   * Usage (as documented in PRISMA_TENANT_GUIDE.md):
   *   const db = this.prisma.forTenant(tenantId);
   *   const students = await db.student.findMany();  // tenantId auto-added
   *
   * Core modules that intentionally query across tenants
   * (audit, sessions, superadmin) should keep using this.prisma directly.
   */
  forTenant(tenantId: string): this {
    const TENANT_METHODS = new Set([
      'findMany', 'findFirst', 'findFirstOrThrow',
      'count', 'aggregate', 'groupBy',
    ]);

    // Proxy the PrismaService instance so model accessors (e.g. .student)
    // return a further proxy that intercepts read methods
    return new Proxy(this, {
      get(target: any, modelProp: string | symbol) {
        const modelDelegate = target[modelProp];

        // Only intercept Prisma model delegates (objects, not functions/scalars)
        if (
          typeof modelProp !== 'string' ||
          typeof modelDelegate !== 'object' ||
          modelDelegate === null
        ) {
          return modelDelegate;
        }

        return new Proxy(modelDelegate, {
          get(model: any, method: string | symbol) {
            const fn = model[method];
            if (typeof method !== 'string' || !TENANT_METHODS.has(method) || typeof fn !== 'function') {
              return typeof fn === 'function' ? fn.bind(model) : fn;
            }

            // Wrap the method to inject tenantId into the where clause
            return (args: Record<string, any> = {}) => {
              const patched = {
                ...args,
                where: { tenantId, ...args.where },
              };
              return fn.call(model, patched);
            };
          },
        });
      },
    }) as this;
  }

}
