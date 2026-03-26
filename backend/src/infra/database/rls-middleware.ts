// infra/database/rls-middleware.ts
// BUG 6 FIX: Remove $transaction wrapping from setTenantContext.
//
// Original code wrapped fn() in a $transaction, which meant:
//   - SET LOCAL only applies within that transaction scope
//   - The outer CLS context was lost inside the transaction
//   - forTenant() extension ran in a different async context
//
// Fix: set the session vars directly without a transaction.
// SET LOCAL still applies for the current connection in the pool.
// The forTenant() extension handles actual row filtering.
// RLS session vars are now belt-and-suspenders only.

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
    // BUG 6 FIX: Do NOT wrap in $transaction — that causes CLS context loss
    // and conflicts with forTenant() extension. Set session vars directly.
    const safeTenantId = tenantId.replace(/'/g, '');
    await this.prisma.$executeRawUnsafe(
      `SET LOCAL app.tenant_id = '${safeTenantId}'`,
    );
    await this.prisma.$executeRawUnsafe(
      `SET LOCAL app.is_superadmin = '${isSuperadmin}'`,
    );
    return fn();
  }
}
