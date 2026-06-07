import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

import { NotificationProviderMode } from '@prisma/client';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsEnum(NotificationProviderMode)
  providerMode?: NotificationProviderMode;

  @IsOptional()
  @IsString()
  smsProvider?: string;

  @IsOptional()
  @IsString()
  emailProvider?: string;

  @IsOptional()
  @IsString()
  whatsappProvider?: string;

  @IsOptional()
  senderName?: string;

  @IsOptional()
  replyTo?: string;
}
