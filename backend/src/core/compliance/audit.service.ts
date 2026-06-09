import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';

export interface AuditLogParams {
  tenantId:   string;
  actorId?:   string;
  actorRole?: any;
  action:     any;
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

  async log(params: AuditLogParams): Promise<void> {
    try {
	    console.log('================ AUDIT =================');
    console.log(JSON.stringify(params, null, 2));

	    await this.prisma.auditLog.create({
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

  async logCreate(params: Omit<AuditLogParams, 'action'>): Promise<void> {
    return this.log({ ...params, action: 'CREATE' as any });
  }

  async logUpdate(params: Omit<AuditLogParams, 'action'>): Promise<void> {
    return this.log({ ...params, action: 'UPDATE' as any });
  }

  async logDelete(params: Omit<AuditLogParams, 'action'>): Promise<void> {
    return this.log({ ...params, action: 'DELETE' as any });
  }

  async logPayment(params: Omit<AuditLogParams, 'action'> & {
    paymentStatus: 'initiated' | 'success' | 'failed';
  }): Promise<void> {
    const action = {
      initiated: 'PAYMENT_INITIATED',
      success:   'PAYMENT_SUCCESS',
      failed:    'PAYMENT_FAILED',
    }[params.paymentStatus];
    return this.log({ ...params, action: action as any });
  }
}
