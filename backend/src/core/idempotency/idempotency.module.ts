import { Global, Module } from '@nestjs/common';
import { IdempotencyGuard } from './idempotency.guard';

@Global()
@Module({
  providers: [IdempotencyGuard],
  exports:   [IdempotencyGuard],
})
export class IdempotencyModule {}
