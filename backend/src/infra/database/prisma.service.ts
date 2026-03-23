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
          async count({ args, query }: any) {
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
