import {
  IsString, IsDateString, IsBoolean, IsOptional,
  IsNotEmpty, IsEnum, IsArray, ValidateNested, IsNumber, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExamType {
  UNIT_TEST  = 'UNIT_TEST',
  MID_TERM   = 'MID_TERM',
  FINAL      = 'FINAL',
  PRACTICAL  = 'PRACTICAL',
  INTERNAL   = 'INTERNAL',
}

export class CreateExamDto {
  @ApiProperty() @IsString() @IsNotEmpty() sessionId!:  string;
  @ApiProperty() @IsString() @IsNotEmpty() name!:       string;
  @ApiProperty({ enum: ExamType }) @IsEnum(ExamType)   type!:      ExamType;
  @ApiProperty() @IsDateString()           startDate!:  string;
  @ApiProperty() @IsDateString()           endDate!:    string;
}

export class UpdateExamDto {
  @ApiPropertyOptional() @IsString()      @IsOptional() name?:        string;
  @ApiPropertyOptional() @IsDateString()  @IsOptional() startDate?:   string;
  @ApiPropertyOptional() @IsDateString()  @IsOptional() endDate?:     string;
  @ApiPropertyOptional() @IsBoolean()     @IsOptional() isPublished?: boolean;
}

export class CreateExamScheduleDto {
  @ApiProperty() @IsString()     @IsNotEmpty() classId!:   string;
  @ApiProperty() @IsString()     @IsNotEmpty() subjectId!: string;
  @ApiProperty() @IsDateString()               date!:      string;
  @ApiProperty() @IsString()     @IsNotEmpty() startTime!: string;
  @ApiProperty() @IsString()     @IsNotEmpty() endTime!:   string;
  @ApiProperty() @IsNumber()     @Min(0)       maxMarks!:  number;
  @ApiProperty() @IsNumber()     @Min(0)       passMarks!: number;
  @ApiPropertyOptional() @IsString() @IsOptional() hallId?: string;
}

export class MarkEntryDto {
  @ApiProperty() @IsString()  @IsNotEmpty() studentId!:      string;
  @ApiProperty() @IsString()  @IsNotEmpty() scheduleId!:     string;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional()  marksObtained?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional()          isAbsent?:      boolean;
  @ApiPropertyOptional() @IsString()  @IsOptional()          remarks?:        string;
}

export class BulkMarkEntryDto {
  @ApiProperty() @IsString()  @IsNotEmpty() examId!: string;
  @ApiProperty({ type: [MarkEntryDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => MarkEntryDto)
  marks!: MarkEntryDto[];
}
