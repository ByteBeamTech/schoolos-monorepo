import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';

import { UpdateNotificationSettingsDto } from '../dto/update-notification-settings.dto';

@Injectable()
export class NotificationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getSettings(tenantId: string) {
    let settings =
      await this.prisma.notificationSetting.findUnique({
        where: { tenantId },
      });

    if (!settings) {
      settings =
        await this.prisma.notificationSetting.create({
          data: {
            tenantId,
          },
        });
    }

    return settings;
  }

  async updateSettings(
    tenantId: string,
    dto: UpdateNotificationSettingsDto,
  ) {
    return this.prisma.notificationSetting.upsert({
      where: {
        tenantId,
      },
      create: {
        tenantId,
        ...dto,
      },
      update: dto,
    });
  }
}
