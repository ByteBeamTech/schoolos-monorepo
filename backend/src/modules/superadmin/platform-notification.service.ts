import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { SendEmailDto } from './dto/send-email.dto';
import { NotificationService } from '../notifications/services/notification.service';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { AuditService } from '../../core/compliance/audit.service';


@Injectable()
export class PlatformNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}




  async broadcast(
    dto: BroadcastNotificationDto,
    actorId: string,
  ) {
    let sent = 0;
    let failed = 0;

    const tenants = await this.prisma.tenant.findMany({
      where: {
        id: {
          in: dto.tenantIds,
        },
      },
      select: {
        id: true,
        contactEmail: true,
      },
    });

    for (const tenant of tenants) {
      try {
        if (!tenant.contactEmail) {
          failed++;
          continue;
        }

        await this.notifications.send(
          tenant.id,
          {
            channel: dto.channel,
            email: tenant.contactEmail,
            subject: dto.subject,
            body: dto.body,
          } as any,
          actorId,
        );

        sent++;
      } catch {
        failed++;
      }
    }


    await this.audit.log({
  tenantId: 'cmpr9a5h80000zruspxyjew1l', // SchoolOS Platform
  actorId,
  actorRole: 'SUPER_ADMIN',
  action: 'BROADCAST_NOTIFICATION_SENT' as any,
  entityType: 'Notification',
  entityId: null,
  after: {
    channel: dto.channel,
    subject: dto.subject,
    sent,
    failed,
    total: tenants.length,
  },
});

    return {
      sent,
      failed,
      total: tenants.length,
    };
  }

async sendEmail(
  dto: SendEmailDto,
  actorId: string,
) {
  const platformTenant = await this.prisma.tenant.findFirst({
    where: {
      slug: 'schoolos-platform',
    },
    select: {
      id: true,
    },
  });

  if (!platformTenant) {
    throw new Error('Platform tenant not found');
  }

  await this.notifications.send(
    platformTenant.id,
    {
      channel: 'EMAIL',
      email: dto.email,
      subject: dto.subject,
      body: dto.body,
    } as any,
    actorId,
  );
await this.audit.log({
  tenantId: 'cmpr9a5h80000zruspxyjew1l',
  actorId,
  actorRole: 'SUPER_ADMIN',
  action: 'EMAIL_SENT' as any,
  entityType: 'Notification',
  entityId: null,
  after: {
    recipient: dto.email,
    subject: dto.subject,
  },
});
  return {
    success: true,
    email: dto.email,
    subject: dto.subject,
  };
}

}
