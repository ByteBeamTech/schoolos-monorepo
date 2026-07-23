import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import type { PrismaTransactionClient } from '@infra/database/prisma-transaction.type';
import type { AuditAction } from '@prisma/client';

/**
 * A writer for audit rows: either the injected PrismaService or a caller's
 * interactive transaction client.
 */
type AuditWriter = PrismaService | PrismaTransactionClient;

export interface AuditLogParams {
  tenantId:   string;
  actorId?:   string;
  actorRole?: any;
  /**
   * Must be a member of the Prisma `AuditAction` enum.
   *
   * This was `any`, and that is the root cause of a bug class this codebase
   * has hit repeatedly: an action string that is not an enum member is
   * rejected by Prisma with PrismaClientValidationError, which `log()` catches
   * and logs but does not rethrow -- so the audit row is silently never
   * written and nothing surfaces at the call site. Most recently
   * `'REFUND_INITIATED'`, which meant refunds produced no audit trail at all.
   *
   * Typing it turns that runtime silence into a compile error.
   *
   * NOTE: call sites that still cast the action to `any` defeat this check.
   * All current values were verified valid against the enum; removing those
   * casts is mechanical and deliberately left to a follow-up so this commit
   * stays reviewable.
   */
  action:     AuditAction;
  entityType: string;
  entityId:   string;
  before?:    Record<string, any>;
  after?:     Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?:  Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit row.
   *
   * @param tx Optional transaction client. When supplied, the row is written
   *   through the caller's transaction instead of this service's own
   *   connection, so it commits or rolls back together with the change it
   *   describes.
   *
   * BEHAVIOUR IS DELIBERATELY UNCHANGED by the `tx` parameter: a failure is
   * still caught and logged, never rethrown, whether or not a transaction is
   * supplied. Making audit failures abort the caller's transaction is a
   * genuine behavioural decision with consequences for money movement -- an
   * audit-row failure would roll back an already-captured payment -- and it is
   * deliberately NOT taken here. `IMM-022`/`IMM-023` (transactional audit) are
   * therefore still not fully satisfied; this commit only makes joining a
   * transaction possible.
   *
   * Caveat worth knowing when passing `tx`: if Postgres has already aborted
   * the transaction, subsequent statements in it will fail too. Swallowing the
   * audit error does not resurrect the transaction -- it only prevents the
   * audit failure itself from being the cause.
   */
  async log(params: AuditLogParams, tx?: PrismaTransactionClient): Promise<void> {
    const db: AuditWriter = tx ?? this.prisma;
    try {
	    console.log('================ AUDIT =================');
    console.log(JSON.stringify(params, null, 2));

	    await db.auditLog.create({
  data: {
    tenant: {
      connect: {
        id: params.tenantId,
      },
    },

    actor: params.actorId
      ? {
          connect: {
            id: params.actorId,
          },
        }
      : undefined,

    actorRole: params.actorRole ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    before: params.before ?? undefined,
    after: params.after ?? undefined,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    metadata: params.metadata ?? undefined,
  },
});
      



    } catch (err) {
      this.logger.error('Failed to write audit log:', err);
    }
  }

  // `as any` casts dropped from these helpers: with `action` typed, the
  // literals are checked against the enum at compile time. Each helper
  // forwards an optional transaction client.

  async logCreate(params: Omit<AuditLogParams, 'action'>, tx?: PrismaTransactionClient): Promise<void> {
    return this.log({ ...params, action: 'CREATE' }, tx);
  }

  async logUpdate(params: Omit<AuditLogParams, 'action'>, tx?: PrismaTransactionClient): Promise<void> {
    return this.log({ ...params, action: 'UPDATE' }, tx);
  }

  async logDelete(params: Omit<AuditLogParams, 'action'>, tx?: PrismaTransactionClient): Promise<void> {
    return this.log({ ...params, action: 'DELETE' }, tx);
  }

  async logPayment(
    params: Omit<AuditLogParams, 'action'> & { paymentStatus: 'initiated' | 'success' | 'failed' },
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const action: AuditAction = {
      initiated: 'PAYMENT_INITIATED',
      success:   'PAYMENT_SUCCESS',
      failed:    'PAYMENT_FAILED',
    }[params.paymentStatus] as AuditAction;
    return this.log({ ...params, action }, tx);
  }
}
