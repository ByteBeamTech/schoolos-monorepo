import {
  IsString, IsInt, IsBoolean, IsOptional,
  IsNotEmpty, Min, Max, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Class ─────────────────────────────────────────────────────────────────────

export class CreateClassDto {
  @ApiProperty({ example: 'Grade 10' })
  @IsString() @MinLength(1) @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Academic session ID' })
  @IsString() @IsNotEmpty()
  sessionId!: string;

  @ApiPropertyOptional({ example: 10 })
  @IsInt() @Min(0) @IsOptional()
  displayOrder?: number;
}

export class UpdateClassDto {
  @ApiPropertyOptional() @IsString()  @IsOptional() name?:         string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() displayOrder?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?:     boolean;
}

// ── Section ───────────────────────────────────────────────────────────────────

export class CreateSectionDto {
  @ApiProperty({ example: 'A' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Class ID' })
  @IsString() @IsNotEmpty()
  classId!: string;

  @ApiPropertyOptional({ example: 40 })
  @IsInt() @Min(1) @Max(100) @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ description: 'User ID of class teacher' })
  @IsString() @IsOptional()
  classTeacherId?: string;
}

export class UpdateSectionDto {
  @ApiPropertyOptional() @IsString()  @IsOptional() name?:          string;
  @ApiPropertyOptional() @IsInt() @Min(1) @Max(100) @IsOptional() capacity?: number;
  @ApiPropertyOptional() @IsString()  @IsOptional() classTeacherId?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?:      boolean;
}

// ── Subject ───────────────────────────────────────────────────────────────────

export class CreateSubjectDto {
  @ApiProperty({ example: 'Mathematics' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'MATH101' })
  @IsString() @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  isElective?: boolean;
}

export class UpdateSubjectDto {
  @ApiPropertyOptional() @IsString()  @IsOptional() name?:        string;
  @ApiPropertyOptional() @IsString()  @IsOptional() code?:        string;
  @ApiPropertyOptional() @IsString()  @IsOptional() description?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isElective?:  boolean;
}

// ── Teacher Mapping ───────────────────────────────────────────────────────────

export class AssignTeacherDto {
  @ApiProperty({ description: 'Section ID' })
  @IsString() @IsNotEmpty()
  sectionId!: string;

  @ApiProperty({ description: 'Subject ID' })
  @IsString() @IsNotEmpty()
  subjectId!: string;

  @ApiProperty({ description: 'Teacher User ID' })
  @IsString() @IsNotEmpty()
  teacherId!: string;

  @ApiProperty({ description: 'Academic Session ID' })
  @IsString() @IsNotEmpty()
  sessionId!: string;
}

// ── Subject Mapping ───────────────────────────────────────────────────────────

export class CreateSubjectMappingDto {
  @ApiProperty({ description: 'Class ID' })
  @IsString() @IsNotEmpty()
  classId!: string;

  @ApiProperty({ description: 'Subject ID' })
  @IsString() @IsNotEmpty()
  subjectId!: string;

  @ApiPropertyOptional({ example: 5 })
  @IsInt() @Min(1) @Max(10) @IsOptional()
  weeklyPeriods?: number;
}

export class GenerateRollNumbersDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  classId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sectionId!: string;
}
