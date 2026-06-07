import {
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';

export class NotificationHistoryQueryDto {
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsString()
  recipientId?: string;
}
