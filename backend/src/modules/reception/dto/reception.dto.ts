import { IsString, IsOptional, IsDateString, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ========== COMPLAINTS ==========

export class CreateComplaintDto {
  @ApiProperty({ example: 'John Parent' })
  @IsString()
  complainantName!: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  complainantPhone?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsString()
  complainantEmail?: string;

  @ApiProperty({ enum: ['PARENT', 'STUDENT', 'STAFF', 'VISITOR', 'OTHER'] })
  @IsString()
  complainantType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relatedStudentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relatedStaffId?: string;

  @ApiProperty({ enum: ['ACADEMIC', 'DISCIPLINE', 'FACILITY', 'TRANSPORT', 'BILLING', 'STAFF_BEHAVIOR', 'SAFETY', 'FOOD', 'OTHER'] })
  @IsString()
  category!: string;

  @ApiProperty({ example: 'Bus delay issue' })
  @IsString()
  subject!: string;

  @ApiProperty({ example: 'The school bus has been consistently late...' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' })
  @IsOptional()
  @IsString()
  priority?: string;
}

export class UpdateComplaintDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'IN_PROGRESS', 'WAITING_RESPONSE', 'RESOLVED', 'CLOSED', 'REOPENED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  @IsOptional()
  @IsString()
  priority?: string;
}

export class ResolveComplaintDto {
  @ApiProperty({ example: 'Issue has been addressed with transport team...' })
  @IsString()
  resolution!: string;
}

export class AddCommentDto {
  @ApiProperty({ example: 'Contacted transport department for update' })
  @IsString()
  comment!: string;
}

export class ComplaintQueryDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'IN_PROGRESS', 'WAITING_RESPONSE', 'RESOLVED', 'CLOSED', 'REOPENED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ enum: ['ACADEMIC', 'DISCIPLINE', 'FACILITY', 'TRANSPORT', 'BILLING', 'STAFF_BEHAVIOR', 'SAFETY', 'FOOD', 'OTHER'] })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;
}

// ========== STAFF ATTENDANCE ==========

export class MarkStaffAttendanceDto {
  @ApiProperty({ example: 'user_abc123' })
  @IsString()
  staffId!: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY'] })
  @IsString()
  status!: string;

  @ApiPropertyOptional({ example: '2024-01-15T09:00:00Z' })
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @ApiPropertyOptional({ example: '2024-01-15T17:00:00Z' })
  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class BulkStaffAttendanceDto {
  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date!: string;

  @ApiProperty({ type: [MarkStaffAttendanceDto] })
  records!: MarkStaffAttendanceDto[];
}

export class StaffAttendanceQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  staffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

// ========== VISITORS ==========

export class CreateVisitorDto {
  @ApiProperty({ example: 'Mr. Sharma' })
  @IsString()
  visitorName!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  phone!: string;

  @ApiPropertyOptional({ example: 'visitor@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'Aadhar' })
  @IsOptional()
  @IsString()
  idType?: string;

  @ApiPropertyOptional({ example: '1234-5678-9012' })
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ example: 'ABC Corp' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiProperty({ enum: ['MEETING', 'DELIVERY', 'INTERVIEW', 'PARENT_MEETING', 'INSPECTION', 'VENDOR', 'MAINTENANCE', 'OTHER'] })
  @IsString()
  purpose!: string;

  @ApiProperty({ example: 'Mr. Principal' })
  @IsString()
  personToMeet!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  personToMeetId?: string;

  @ApiPropertyOptional({ example: 'Administration' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  expectedDuration?: number;

  @ApiPropertyOptional({ example: 'MH12AB1234' })
  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CheckOutVisitorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class VisitorQueryDto {
  @ApiPropertyOptional({ enum: ['CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  personToMeetId?: string;
}
