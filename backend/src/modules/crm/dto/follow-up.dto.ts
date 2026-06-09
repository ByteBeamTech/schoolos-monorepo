import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const FOLLOW_UP_STATUS_VALUES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type FollowUpStatusValue = (typeof FOLLOW_UP_STATUS_VALUES)[number];

export class CreateFollowUpDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class UpdateFollowUpDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsDateString() dueDate?: string;

  @IsOptional()
  @IsEnum(FOLLOW_UP_STATUS_VALUES as unknown as string[])
  status?: FollowUpStatusValue;

  @IsOptional() @IsString() assignedToId?: string;
}

export class ListFollowUpsQueryDto {
  @IsOptional()
  @IsEnum(FOLLOW_UP_STATUS_VALUES as unknown as string[])
  status?: FollowUpStatusValue;

  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsString() leadId?: string;

  /** 'today' | 'overdue' | 'upcoming' */
  @IsOptional() @IsString() window?: 'today' | 'overdue' | 'upcoming';
}
