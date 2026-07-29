import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddRouteStopDto {
  @ApiProperty()
  @IsString()
  stopId!: string;

  @ApiProperty({ description: 'Position of this stop along the route (0-based)' })
  @IsInt()
  @Min(0)
  sequence!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceFromStartKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  etaMinutesFromStart?: number;

  @ApiPropertyOptional({ description: 'Boarding order at this stop, when it differs from route sequence' })
  @IsOptional()
  @IsInt()
  @Min(0)
  boardingOrder?: number;
}

export class UpdateRouteStopDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceFromStartKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  etaMinutesFromStart?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  boardingOrder?: number;
}

export class ReorderRouteStopsDto {
  @ApiProperty({
    type: [String],
    description: 'routeStopIds in the new intended order; sequence is reassigned 0..n-1 accordingly',
  })
  @IsString({ each: true })
  routeStopIds!: string[];
}
