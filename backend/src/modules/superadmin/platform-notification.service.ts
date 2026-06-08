import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { SendEmailDto } from './dto/send-email.dto';
import { NotificationService } from '../notifications/services/notification.service';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

@Injectable()
export class PlatformNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
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

  return {
    success: true,
    email: dto.email,
    subject: dto.subject,
  };
}

}
