import {
  Injectable, CanActivate, ExecutionContext,
  ConflictException, Logger,
} from '@nestjs/common';
import { Reflector }    from '@nestjs/core';
import { RedisService } from '../../infra/cache/redis.service';
import { IDEMPOTENT_KEY, IdempotentOptions } from './idempotency.decorator';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  private readonly logger = new Logger(IdempotencyGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis:     RedisService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.get<IdempotentOptions>(IDEMPOTENT_KEY, ctx.getHandler());
    if (!opts) return true; // Not marked as idempotent — skip

    const request = ctx.switchToHttp().getRequest();
    const key     = request.headers['idempotency-key'] as string | undefined;

    if (!key) return true; // No key provided — allow through (optional enforcement)

    const redisKey = `idempotency:${key}`;
    const existing = await this.redis.get(redisKey);

    if (existing) {
      this.logger.warn(`Duplicate request blocked. Idempotency-Key: ${key}`);
      throw new ConflictException({
        message:        'Duplicate request — this operation was already processed.',
        idempotencyKey: key,
        cachedAt:       existing,
      });
    }

    // Store the key — will be set to "processed" after the handler runs
    await this.redis.set(redisKey, new Date().toISOString(), opts.ttl ?? 86400);
    return true;
  }
}
