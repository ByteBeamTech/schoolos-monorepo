import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

export interface IdempotentOptions {
  ttl?: number;  // seconds. Default: 86400 (24h for payments)
}

// Mark a controller method as idempotent
export const Idempotent = (opts: IdempotentOptions = {}) =>
  SetMetadata(IDEMPOTENT_KEY, { ttl: opts.ttl ?? 86400 });

// Extract the Idempotency-Key header value in the controller
export const IdempotencyKey = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['idempotency-key'];
  },
);
