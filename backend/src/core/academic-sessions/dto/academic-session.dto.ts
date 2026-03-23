import {
  IsString, IsDateString, IsBoolean,
  IsNotEmpty, IsOptional, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAcademicSessionDto {
  @ApiProperty({ example: '2025-26' })
  @IsString()
  @MinLength(3)
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '2025-04-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-03-31' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isCurrent?: boolean;
}

export class UpdateAcademicSessionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isCurrent?: boolean;
}
