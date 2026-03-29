// backend/src/modules/behavior/dto/behavior.dto.ts
import { IsString, IsEnum, IsOptional, IsBoolean, IsInt, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BehaviorType     { POSITIVE = 'POSITIVE', NEGATIVE = 'NEGATIVE', NEUTRAL = 'NEUTRAL' }
export enum BehaviorSeverity { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH', CRITICAL = 'CRITICAL' }
export enum BehaviorStatus   { OPEN = 'OPEN', RESOLVED = 'RESOLVED', ESCALATED = 'ESCALATED' }

export class CreateBehaviorRecordDto {
  @ApiProperty() @IsString()              studentId:        string;
  @ApiProperty() @IsEnum(BehaviorType)    type:             BehaviorType;
  @ApiProperty() @IsString()              category:         string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?:  string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(BehaviorSeverity) severity?: BehaviorSeverity;
  @ApiPropertyOptional() @IsOptional() @IsString() actionTaken?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt()    points?:      number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() parentNotified?:   boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() followUpRequired?: boolean;
  @ApiProperty() @IsDateString()          incidentDate:     string;
}

export class ResolveRecordDto {
  @ApiPropertyOptional() @IsOptional() @IsString() resolutionNote?: string;
}
