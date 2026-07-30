import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripAttendanceStatus, TripBoardingType } from '@prisma/client';

export class MarkAttendanceDto {
  @ApiProperty()
  @IsString()
  studentId!: string;

  @ApiProperty({ enum: TripAttendanceStatus, description: 'BOARDED or ABSENT (Student No-show)' })
  @IsIn(Object.values(TripAttendanceStatus))
  status!: TripAttendanceStatus;

  @ApiPropertyOptional({
    enum: TripBoardingType,
    description: 'Defaults from the trip\'s tripType: EVENING -> DROP, everything else -> PICKUP',
  })
  @IsOptional()
  @IsIn(Object.values(TripBoardingType))
  boardingType?: TripBoardingType;
}
