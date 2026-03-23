import {
  IsString, IsOptional, IsNotEmpty, IsNumber, Min,
  IsEnum, IsObject, IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationChannel {
  EMAIL    = 'EMAIL',
  SMS      = 'SMS',
  WHATSAPP = 'WHATSAPP',
  PUSH     = 'PUSH',
  IN_APP   = 'IN_APP',
}

export enum NotificationTemplate {
  ABSENT_ALERT          = 'ABSENT_ALERT',
  LATE_ALERT            = 'LATE_ALERT',
  INVOICE_GENERATED     = 'INVOICE_GENERATED',
  PAYMENT_RECEIVED      = 'PAYMENT_RECEIVED',
  PAYMENT_OVERDUE       = 'PAYMENT_OVERDUE',
  LEAVE_APPROVED        = 'LEAVE_APPROVED',
  LEAVE_REJECTED        = 'LEAVE_REJECTED',
  EXAM_REMINDER         = 'EXAM_REMINDER',
  FEE_REMINDER          = 'FEE_REMINDER',
  WELCOME               = 'WELCOME',
  CUSTOM                = 'CUSTOM',
}

export class SendNotificationDto {
  @ApiProperty({ description: 'Recipient User ID (optional — use phone/email directly for external)' })
  @IsString() @IsOptional()
  recipientId?: string;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiPropertyOptional({ enum: NotificationTemplate })
  @IsEnum(NotificationTemplate) @IsOptional()
  templateId?: NotificationTemplate;

  @ApiPropertyOptional({ example: 'Invoice Due' })
  @IsString() @IsOptional()
  subject?: string;

  @ApiProperty({ example: 'Your invoice #INV-2025-00001 is due on May 31.' })
  @IsString() @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({ description: 'Template data for variable substitution' })
  @IsObject() @IsOptional()
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Direct phone for SMS/WhatsApp (overrides recipientId lookup)' })
  @IsString() @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Direct email (overrides recipientId lookup)' })
  @IsString() @IsOptional()
  email?: string;
}

export class BulkNotificationDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty({ enum: NotificationTemplate })
  @IsEnum(NotificationTemplate)
  templateId!: NotificationTemplate;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  subject?: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  body!: string;

  @ApiProperty({ description: 'List of recipient user IDs' })
  @IsArray()
  recipientIds!: string[];

  @ApiPropertyOptional()
  @IsObject() @IsOptional()
  data?: Record<string, any>;
}

export class AbsentAlertDto {
  @ApiProperty({ description: 'Date of absence (YYYY-MM-DD)' })
  @IsString() @IsNotEmpty()
  date!: string;

  @ApiPropertyOptional({ description: 'Section ID — alerts all absentees in section' })
  @IsString() @IsOptional()
  sectionId?: string;

  @ApiPropertyOptional({ description: 'Student ID — alert for specific student' })
  @IsString() @IsOptional()
  studentId?: string;

  @ApiPropertyOptional({ enum: [NotificationChannel.SMS, NotificationChannel.WHATSAPP] })
  @IsEnum(NotificationChannel) @IsOptional()
  channel?: NotificationChannel;
}

export class FeeReminderDto {
  @ApiProperty({ description: 'Academic year session ID' })
  @IsString() @IsNotEmpty()
  academicYear!: string;

  @ApiPropertyOptional({ description: 'Number of days before due date to send reminder', default: 3 })
  @ApiPropertyOptional({ default: 3 })
  @IsNumber() @Min(1) @IsOptional()
  daysBeforeDue?: number;
}
