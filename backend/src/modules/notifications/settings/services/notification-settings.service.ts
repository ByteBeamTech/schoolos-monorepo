import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';

import { UpdateNotificationSettingsDto } from '../dto/update-notification-settings.dto';

@Injectable()
export class NotificationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private maskSettings(settings: any) {
    return {
      ...settings,

      smsConfig: settings.smsConfig
        ? { configured: true }
        : null,

      emailConfig: settings.emailConfig
        ? { configured: true }
        : null,

      whatsappConfig: settings.whatsappConfig
        ? { configured: true }
        : null,
    };
  }

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

    return this.maskSettings(settings);
  }

  async updateSettings(
    tenantId: string,
    dto: UpdateNotificationSettingsDto,
  ) {
    const settings =
      await this.prisma.notificationSetting.upsert({
        where: {
          tenantId,
        },
        create: {
          tenantId,
          ...dto,
        },
        update: dto,
      });

    return this.maskSettings(settings);
  }
}
