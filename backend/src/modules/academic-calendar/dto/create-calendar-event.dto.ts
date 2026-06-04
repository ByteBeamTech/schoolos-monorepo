import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEnum,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  CalendarEventType,
  EventScope,
  AudienceType,
} from '@prisma/client';

export class CalendarTargetDto {
  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;
}

export class CreateCalendarEventDto {
  @IsString()
  title: string;

  @IsString()
  sessionId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(CalendarEventType)
  type: CalendarEventType;

  @IsOptional()
  @IsEnum(EventScope)
  scope?: EventScope;

  @IsOptional()
  @IsEnum(AudienceType)
  audience?: AudienceType;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsBoolean()
  isWorkingDay?: boolean;

  @IsOptional()
  @IsBoolean()
  blocksAttendance?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;


  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarTargetDto)
  targets?: CalendarTargetDto[];


}
