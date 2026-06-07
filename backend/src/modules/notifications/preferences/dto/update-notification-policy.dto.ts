import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
} from 'class-validator';

import {
  NotificationChannel,
  Priority,
} from '@prisma/client';

export class UpdateNotificationPolicyDto {
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @IsOptional()
  @IsBoolean()
  fallbackEnabled?: boolean;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
