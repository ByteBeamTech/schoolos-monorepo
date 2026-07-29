import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StudentTransportAssignmentStatus } from '@prisma/client';

export class AssignStudentDto {
  @ApiProperty()
  @IsString()
  studentId!: string;

  @ApiProperty()
  @IsString()
  routeId!: string;

  @ApiProperty()
  @IsString()
  pickupRouteStopId!: string;

  @ApiProperty()
  @IsString()
  dropRouteStopId!: string;

  @ApiPropertyOptional({ description: 'ISO date; defaults to now if omitted' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

export class ListStudentAssignmentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  routeId?: string;

  @ApiPropertyOptional({ enum: StudentTransportAssignmentStatus })
  @IsOptional()
  @IsIn(Object.values(StudentTransportAssignmentStatus))
  status?: StudentTransportAssignmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class EndAssignmentDto {
  @ApiPropertyOptional({ description: 'ISO date; defaults to now if omitted' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

// ----------------------------------------------------------------------------
// AF-007 wizard: Student Transfer (one of AF-007's explicitly-listed
// applicable operations).
// ----------------------------------------------------------------------------

export class TransferPreviewQueryDto {
  @ApiProperty()
  @IsString()
  newRouteId!: string;

  @ApiProperty()
  @IsString()
  newPickupRouteStopId!: string;

  @ApiProperty()
  @IsString()
  newDropRouteStopId!: string;
}

export class ConfirmTransferStudentDto {
  @ApiProperty()
  @IsString()
  newRouteId!: string;

  @ApiProperty()
  @IsString()
  newPickupRouteStopId!: string;

  @ApiProperty()
  @IsString()
  newDropRouteStopId!: string;

  @ApiPropertyOptional({ description: 'ISO date; defaults to now if omitted' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description:
      'Preview.impactToken from GET .../transfer/preview — Execute only runs ' +
      'against the exact impact the caller reviewed (AF-007).',
  })
  @IsString()
  impactToken!: string;
}
