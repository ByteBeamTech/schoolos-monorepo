import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripType } from '@prisma/client';

const TIME_HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateTripScheduleDto {
  @ApiProperty()
  @IsString()
  routeId!: string;

  @ApiProperty({ enum: TripType })
  @IsIn(Object.values(TripType))
  tripType!: TripType;

  @ApiProperty({ example: '07:30', description: 'HH:mm, local to the branch' })
  @Matches(TIME_HHMM, { message: 'departureTime must be in HH:mm 24-hour format' })
  departureTime!: string;

  @ApiProperty({ type: [Number], example: [1, 2, 3, 4, 5], description: '0=Sunday..6=Saturday' })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek!: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class UpdateTripScheduleDto {
  @ApiPropertyOptional({ example: '07:30' })
  @IsOptional()
  @Matches(TIME_HHMM, { message: 'departureTime must be in HH:mm 24-hour format' })
  departureTime?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
