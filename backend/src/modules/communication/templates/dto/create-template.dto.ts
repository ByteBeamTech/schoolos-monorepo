import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  Language,
  NotificationChannel,
} from '@prisma/client';

export class CreateTemplateDto {
  @IsString()
  eventType!: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body!: string;

  @IsOptional()
  variables?: any;

  @IsOptional()
  @IsString()
  dltTemplateId?: string;

  @IsOptional()
  @IsString()
  dltPeId?: string;

  @IsOptional()
  @IsString()
  whatsappTemplateId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
