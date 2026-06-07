import { Injectable } from '@nestjs/common';

import { PrismaService } from '@infra/database/prisma.service';

import { NotificationHistoryQueryDto }
from '../dto/notification-history-query.dto';

@Injectable()
export class NotificationHistoryService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async history(
    tenantId: string,
    query: NotificationHistoryQueryDto,
  ) {
    const where: any = {
      tenantId,
    };

    if (query.channel) {
      where.channel = query.channel;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.recipientId) {
      where.recipientId = query.recipientId;
    }

    const [rows, total] =
      await Promise.all([
        this.prisma.notification.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          take: 100,
        }),
        this.prisma.notification.count({
          where,
        }),
      ]);

    return {
      total,
      data: rows,
    };
  }

  async stats(
    tenantId: string,
  ) {
    const [
      total,
      pending,
      sent,
      delivered,
      failed,
      read,
    ] = await Promise.all([
      this.prisma.notification.count({
        where: { tenantId },
      }),

      this.prisma.notification.count({
        where: {
          tenantId,
          status: 'PENDING',
        },
      }),

      this.prisma.notification.count({
        where: {
          tenantId,
          status: 'SENT',
        },
      }),

      this.prisma.notification.count({
        where: {
          tenantId,
          status: 'DELIVERED',
        },
      }),

      this.prisma.notification.count({
        where: {
          tenantId,
          status: 'FAILED',
        },
      }),

      this.prisma.notification.count({
        where: {
          tenantId,
          status: 'READ',
        },
      }),
    ]);

    return {
      total,
      pending,
      sent,
      delivered,
      failed,
      read,
    };
  }
}
