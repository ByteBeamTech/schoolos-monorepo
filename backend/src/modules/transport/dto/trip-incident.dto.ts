import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripIncidentSeverity, TripIncidentType } from '@prisma/client';

export class ReportIncidentDto {
  @ApiProperty({ enum: TripIncidentType })
  @IsIn(Object.values(TripIncidentType))
  type!: TripIncidentType;

  @ApiPropertyOptional({ enum: TripIncidentSeverity, default: TripIncidentSeverity.LOW })
  @IsOptional()
  @IsIn(Object.values(TripIncidentSeverity))
  severity?: TripIncidentSeverity;

  @ApiProperty()
  @IsString()
  description!: string;
}

export class ResolveIncidentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}

/** Ch.5 Daily Operations: Driver Replacement / Vehicle Breakdown mid-trip resource swap. */
export class ReplaceTripResourceDto {
  @ApiPropertyOptional({ description: 'New vehicleId (Vehicle Breakdown replacement)' })
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'New driverId (Driver Replacement)' })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiProperty()
  @IsString()
  reason!: string;
}
