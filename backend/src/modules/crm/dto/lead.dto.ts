import {
  IsArray,
  IsBooleanString,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Canonical MVP LeadStatus values (subset of the Prisma enum).
 * Legacy enum members exist in the DB enum but are not exposed via the API.
 */
export const LEAD_STATUS_VALUES = [
  'NEW',
  'CONTACTED',
  'FOLLOW_UP',
  'VISIT_SCHEDULED',
  'INTERESTED',
  'APPLICATION_STARTED',
  'APPLICATION_SUBMITTED',
  'APPROVED',
  'ENROLLED',
  'LOST',
] as const;
export type LeadStatusValue = (typeof LEAD_STATUS_VALUES)[number];

export const LEAD_TEMPERATURE_VALUES = ['COLD', 'WARM', 'HOT'] as const;
export type LeadTemperatureValue = (typeof LEAD_TEMPERATURE_VALUES)[number];

export class CreateLeadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  parentName!: string;

  @IsString()
  @Length(5, 20)
  parentPhone!: string;

  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  studentName?: string;

  @IsString()
  @MaxLength(40)
  gradeInterestedIn!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2099)
  expectedEnrollYear!: number;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  referredById?: string;

  @IsOptional()
  @IsEnum(LEAD_TEMPERATURE_VALUES as unknown as string[])
  temperature?: LeadTemperatureValue;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  initialNote?: string;
}

export class UpdateLeadDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) parentName?: string;
  @IsOptional() @IsString() @Length(5, 20) parentPhone?: string;
  @IsOptional() @IsEmail() parentEmail?: string;
  @IsOptional() @IsString() @MaxLength(120) studentName?: string;
  @IsOptional() @IsString() @MaxLength(40) gradeInterestedIn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2099)
  expectedEnrollYear?: number;

  @IsOptional() @IsString() sourceId?: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() referredById?: string;

  @IsOptional()
  @IsEnum(LEAD_TEMPERATURE_VALUES as unknown as string[])
  temperature?: LeadTemperatureValue;
}

export class AssignLeadDto {
  @IsString()
  assignedToId!: string;
}

export class ChangeLeadStatusDto {
  @IsEnum(LEAD_STATUS_VALUES as unknown as string[])
  status!: LeadStatusValue;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ListLeadsQueryDto {
  @IsOptional()
  @IsEnum(LEAD_STATUS_VALUES as unknown as string[])
  status?: LeadStatusValue;

  @IsOptional()
  @IsEnum(LEAD_TEMPERATURE_VALUES as unknown as string[])
  temperature?: LeadTemperatureValue;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsBooleanString()
  mineOnly?: string;
}
