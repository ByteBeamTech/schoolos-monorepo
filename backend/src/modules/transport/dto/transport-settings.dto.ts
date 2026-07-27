import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CapacityEnforcementMode,
  TransportAttendanceMode,
  TripGenerationMode,
} from '@prisma/client';

// AF-002: every field here is a partial-update knob over one branch's
// TransportSettings row. Nothing here is a business-rule constant baked
// into service code — the DB row (with its Prisma-schema defaults) is the
// single source of truth; this DTO only validates what a caller may change.
export class UpdateTransportSettingsDto {
  // Capacity Policy
  @ApiPropertyOptional({ enum: CapacityEnforcementMode })
  @IsOptional()
  @IsEnum(CapacityEnforcementMode)
  capacityEnforcementMode?: CapacityEnforcementMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  capacityBufferSeats?: number;

  // Assignment Policy
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowMultipleActiveAssignments?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireApprovalForMidSessionTransfer?: boolean;

  // Trip Generation Policy
  @ApiPropertyOptional({ enum: TripGenerationMode })
  @IsOptional()
  @IsEnum(TripGenerationMode)
  tripGenerationMode?: TripGenerationMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  tripGenerationLeadDays?: number;

  // Attendance Mode
  @ApiPropertyOptional({ enum: TransportAttendanceMode })
  @IsOptional()
  @IsEnum(TransportAttendanceMode)
  attendanceMode?: TransportAttendanceMode;

  // Reminder Policy
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  complianceExpiryReminderDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  licenseExpiryReminderDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  feeReminderDaysBeforeDue?: number;

  // Route Suspend Policy
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  routeSuspendRequiresApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  routeSuspendNotifyGuardians?: boolean;

  // Fee Revision Policy
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  feeRevisionRequiresApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  feeRevisionMinNoticeDays?: number;

  // Calendar Policy
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  followAcademicCalendarHolidays?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  runTripsOnHalfDays?: boolean;

  // Escape hatch — not a substitute for the discrete fields above (see
  // AF-002 note on transport-domain.prisma). Kept for forward extensibility.
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
