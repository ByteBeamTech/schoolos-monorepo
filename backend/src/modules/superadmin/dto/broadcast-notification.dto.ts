import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class BroadcastNotificationDto {
  @IsArray()
  tenantIds: string[];

  @IsEnum(['EMAIL', 'SMS', 'WHATSAPP'])
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';

  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsOptional()
  data?: Record<string, any>;
}
