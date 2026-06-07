import { Injectable } from '@nestjs/common';

import { PrismaService } from '@infra/database/prisma.service';

import { UpdateNotificationPolicyDto } from '../dto/update-notification-policy.dto';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async listPolicies(
    tenantId: string,
  ) {
    return this.prisma.communicationPolicy.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        eventType: 'asc',
      },
    });
  }

  async updatePolicy(
    tenantId: string,
    eventType: string,
    dto: UpdateNotificationPolicyDto,
  ) {
    return this.prisma.communicationPolicy.upsert({
      where: {
        tenantId_eventType: {
          tenantId,
          eventType,
        },
      },
      create: {
        tenantId,
        eventType,
        channels: dto.channels ?? ['SMS'],
        fallbackEnabled:
          dto.fallbackEnabled ?? false,
        priority:
          dto.priority ?? 'MEDIUM',
      },
      update: {
        ...(dto.channels && {
          channels: dto.channels,
        }),
        ...(dto.priority && {
          priority: dto.priority,
        }),
        ...(dto.fallbackEnabled !== undefined && {
          fallbackEnabled:
            dto.fallbackEnabled,
        }),
      },
    });
  }
}
