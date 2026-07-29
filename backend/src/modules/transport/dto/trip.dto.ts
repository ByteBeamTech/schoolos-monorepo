import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripStatus, TripType } from '@prisma/client';

export class CreateTripDto {
  @ApiProperty()
  @IsString()
  routeId!: string;

  @ApiProperty({ enum: TripType })
  @IsIn(Object.values(TripType))
  tripType!: TripType;

  @ApiProperty({ description: 'ISO date (YYYY-MM-DD)' })
  @IsDateString()
  tripDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conductorId?: string;
}

/** Assigns/replaces Vehicle, Driver, and/or Conductor on an existing Trip (ADR-003: supports replacements). */
export class AssignTripResourcesDto {
  @ApiPropertyOptional({ description: 'null clears the current assignment' })
  @IsOptional()
  @IsString()
  vehicleId?: string | null;

  @ApiPropertyOptional({ description: 'null clears the current assignment' })
  @IsOptional()
  @IsString()
  driverId?: string | null;

  @ApiPropertyOptional({ description: 'null clears the current assignment' })
  @IsOptional()
  @IsString()
  conductorId?: string | null;
}

export class CancelTripDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListTripsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  routeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({ enum: TripStatus })
  @IsOptional()
  @IsIn(Object.values(TripStatus))
  status?: TripStatus;

  @ApiPropertyOptional({ description: 'ISO date — filters to this single date' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'ISO date — inclusive lower bound' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date — inclusive upper bound' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

/** AF-004 Daily Trip Generation — manual trigger (used when a branch's Trip Generation Policy is MANUAL). */
export class GenerateTripsDto {
  @ApiPropertyOptional({ description: 'ISO date to generate for; defaults to today' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
