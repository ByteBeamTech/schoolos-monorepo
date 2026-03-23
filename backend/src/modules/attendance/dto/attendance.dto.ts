import {
  IsString, IsDateString, IsOptional, IsNotEmpty,
  IsEnum, IsInt, IsArray, ValidateNested, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Enums ─────────────────────────────────────────────────────────────────────

export enum AttendanceStatus {
  PRESENT  = 'PRESENT',
  ABSENT   = 'ABSENT',
  LATE     = 'LATE',
  HALF_DAY = 'HALF_DAY',
  HOLIDAY  = 'HOLIDAY',
  ON_LEAVE = 'ON_LEAVE',
}

export enum LeaveStatus {
  PENDING  = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// ── Single attendance mark ─────────────────────────────────────────────────────

export class MarkAttendanceDto {
  @ApiProperty({ description: 'Student ID' })
  @IsString() @IsNotEmpty()
  studentId!: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  remarks?: string;
}

// ── Bulk daily attendance ──────────────────────────────────────────────────────

export class BulkMarkAttendanceDto {
  @ApiProperty({ description: 'Section ID' })
  @IsString() @IsNotEmpty()
  sectionId!: string;

  @ApiProperty({ description: 'Academic Session ID' })
  @IsString() @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({ example: '2025-06-15' })
  @IsDateString()
  date!: string;

  @ApiProperty({ type: [MarkAttendanceDto] })
  @IsArray() @ValidateNested({ each: true })
  @Type(() => MarkAttendanceDto)
  attendance!: MarkAttendanceDto[];
}

// ── Period-wise attendance ─────────────────────────────────────────────────────

export class MarkPeriodAttendanceDto {
  @ApiProperty({ description: 'Section ID' })
  @IsString() @IsNotEmpty()
  sectionId!: string;

  @ApiProperty({ description: 'Academic Session ID' })
  @IsString() @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({ example: '2025-06-15' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 1, description: 'Period number (1-8)' })
  @IsInt() @Min(1)
  period!: number;

  @ApiProperty({ type: [MarkAttendanceDto] })
  @IsArray() @ValidateNested({ each: true })
  @Type(() => MarkAttendanceDto)
  attendance!: MarkAttendanceDto[];
}

// ── Update single record ───────────────────────────────────────────────────────

export class UpdateAttendanceDto {
  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  remarks?: string;
}

// ── Leave request ──────────────────────────────────────────────────────────────

export class CreateLeaveRequestDto {
  @ApiProperty({ description: 'Student ID' })
  @IsString() @IsNotEmpty()
  studentId!: string;

  @ApiProperty({ example: '2025-06-20' })
  @IsDateString()
  fromDate!: string;

  @ApiProperty({ example: '2025-06-22' })
  @IsDateString()
  toDate!: string;

  @ApiProperty({ example: 'Family function' })
  @IsString() @IsNotEmpty()
  reason!: string;
}

export class ApproveLeaveDto {
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  remarks?: string;
}

// ── Query filters ──────────────────────────────────────────────────────────────

export class AttendanceQueryDto {
  @ApiPropertyOptional() @IsString()      @IsOptional() sectionId?:  string;
  @ApiPropertyOptional() @IsString()      @IsOptional() studentId?:  string;
  @ApiPropertyOptional() @IsDateString()  @IsOptional() date?:       string;
  @ApiPropertyOptional() @IsDateString()  @IsOptional() fromDate?:   string;
  @ApiPropertyOptional() @IsDateString()  @IsOptional() toDate?:     string;
  @ApiPropertyOptional() @IsString()      @IsOptional() sessionId?:  string;
}
