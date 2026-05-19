import { Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';

import { PrismaService } from '@infra/database/prisma.service'; 
@Injectable()
export class NotificationLogService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async logQueued(data: {
    tenantId: string;
    recipient: string;
    channel: NotificationChannel;
    eventType?: string;
    traceId?: string;
  }) {
    return this.prisma.notificationLog.create({
      data: {
        tenantId: data.tenantId,
        recipient: data.recipient,
        channel: data.channel,
        eventType: data.eventType,
        traceId: data.traceId,
        status: NotificationStatus.PENDING,
      },
    });
  }

  async logSent(
    id: string,
    providerMessageId?: string,
  ) {
    return this.prisma.notificationLog.update({
      where: { id },
      data: {
        status: NotificationStatus.SENT,
        providerMessageId,
        sentAt: new Date(),
      },
    });
  }

  async logFailed(
    id: string,
    error: string,
  ) {
    return this.prisma.notificationLog.update({
      where: { id },
      data: {
        status: NotificationStatus.FAILED,
        error,
      },
    });
  }

  async logDelivered(id: string) {
    return this.prisma.notificationLog.update({
      where: { id },
      data: {
        status: NotificationStatus.DELIVERED,
        deliveredAt: new Date(),
      },
    });
  }

  async logRead(id: string) {
    return this.prisma.notificationLog.update({
      where: { id },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });
  }
}
