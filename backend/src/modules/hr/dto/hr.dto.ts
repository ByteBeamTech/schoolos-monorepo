import { IsString, IsOptional, IsNumber, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ========== JOINING REQUEST ==========

export class CreateJoiningRequestDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  candidateName!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsString()
  email!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 'Mathematics Teacher' })
  @IsString()
  position!: string;

  @ApiPropertyOptional({ example: 'Academics' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  proposedSalary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  documents?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveJoiningDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}

export class RejectJoiningDto {
  @ApiProperty({ example: 'Does not meet qualifications' })
  @IsString()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}

// ========== STAFF LEAVE ==========

export class ApplyLeaveDto {
  @ApiProperty({ enum: ['CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'UNPAID', 'COMPENSATORY'] })
  @IsString()
  leaveType!: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  fromDate!: string;

  @ApiProperty({ example: '2024-01-17' })
  @IsDateString()
  toDate!: string;

  @ApiProperty({ example: 'Family function' })
  @IsString()
  reason!: string;
}

export class ApproveLeaveDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}

export class RejectLeaveDto {
  @ApiProperty({ example: 'Insufficient leave balance' })
  @IsString()
  reason!: string;
}

// ========== WORKFLOW CONFIG ==========

export class WorkflowLevelDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  level!: number;

  @ApiProperty({ example: 'PRINCIPAL' })
  @IsString()
  role!: string;
}

export class ConfigureWorkflowDto {
  @ApiProperty({ example: 'joining' })
  @IsString()
  workflowType!: string;

  @ApiProperty({ type: [WorkflowLevelDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowLevelDto)
  levels!: WorkflowLevelDto[];
}

// ========== LEAVE BALANCE ==========

export class SetLeaveBalanceDto {
  @ApiProperty({ example: 'user_abc123' })
  @IsString()
  staffId!: string;

  @ApiProperty({ enum: ['CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'UNPAID', 'COMPENSATORY'] })
  @IsString()
  leaveType!: string;

  @ApiProperty({ example: 12 })
  @IsNumber()
  totalDays!: number;

  @ApiProperty({ example: 2024 })
  @IsNumber()
  year!: number;
}

// ========== QUERY DTOs ==========

export class JoiningRequestQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ONBOARDED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;
}

export class LeaveQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  staffId?: string;

  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
