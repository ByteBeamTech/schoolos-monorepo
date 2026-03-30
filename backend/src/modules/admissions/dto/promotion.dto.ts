import { IsString, IsOptional, IsNumber, IsDateString, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ========== STUDENT PROMOTION ==========

export class PromotionRuleDto {
  @ApiProperty({ example: 'session_abc123' })
  @IsString()
  sessionId!: string;

  @ApiProperty({ example: 'class_from' })
  @IsString()
  fromClassId!: string;

  @ApiProperty({ example: 'class_to' })
  @IsString()
  toClassId!: string;

  @ApiPropertyOptional({ example: 33, default: 33 })
  @IsOptional()
  @IsNumber()
  passingMarks?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requireAllPass?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  autoPromote?: boolean;
}

export class PromoteStudentDto {
  @ApiProperty({ example: 'student_abc123' })
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 'session_to' })
  @IsString()
  toSessionId!: string;

  @ApiPropertyOptional({ example: 'section_new' })
  @IsOptional()
  @IsString()
  toSectionId?: string;

  @ApiPropertyOptional({ enum: ['PROMOTED', 'DETAINED', 'MIGRATED'] })
  @IsOptional()
  @IsString()
  promotionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class BulkPromoteDto {
  @ApiProperty({ example: 'session_from' })
  @IsString()
  fromSessionId!: string;

  @ApiProperty({ example: 'session_to' })
  @IsString()
  toSessionId!: string;

  @ApiProperty({ example: 'section_from' })
  @IsString()
  fromSectionId!: string;

  @ApiPropertyOptional({ example: 'section_to' })
  @IsOptional()
  @IsString()
  toSectionId?: string;

  @ApiPropertyOptional({ description: 'Filter: minimum average marks' })
  @IsOptional()
  @IsNumber()
  minMarks?: number;

  @ApiPropertyOptional({ description: 'Filter: specific student IDs (if empty, all students)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[];
}

// ========== STUDENT MIGRATION ==========

export class MigrateStudentDto {
  @ApiProperty({ example: 'student_abc123' })
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 'Delhi Public School' })
  @IsString()
  targetSchoolName!: string;

  @ApiPropertyOptional({ example: 'dps-delhi' })
  @IsOptional()
  @IsString()
  targetSchoolCode?: string;

  @ApiProperty({ example: '2024-03-31' })
  @IsDateString()
  migrationDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApproveMigrationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transferCertUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

// ========== ID CARD ==========

export class GenerateIDCardDto {
  @ApiProperty({ enum: ['STUDENT', 'STAFF'] })
  @IsString()
  entityType!: string;

  @ApiProperty({ example: 'entity_abc123' })
  @IsString()
  entityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ example: '2025-03-31' })
  @IsDateString()
  expiryDate!: string;
}

export class BulkGenerateIDCardsDto {
  @ApiProperty({ enum: ['STUDENT', 'STAFF'] })
  @IsString()
  entityType!: string;

  @ApiProperty({ description: 'Entity IDs to generate cards for' })
  @IsArray()
  @IsString({ each: true })
  entityIds!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ example: '2025-03-31' })
  @IsDateString()
  expiryDate!: string;
}

export class IDCardTemplateDto {
  @ApiProperty({ example: 'Standard Student ID' })
  @IsString()
  name!: string;

  @ApiProperty({ enum: ['STUDENT', 'STAFF'] })
  @IsString()
  type!: string;

  @ApiProperty({ description: 'Layout configuration for front side' })
  frontDesign: any;

  @ApiPropertyOptional({ description: 'Layout configuration for back side' })
  @IsOptional()
  backDesign?: any;

  @ApiPropertyOptional({ example: 86 })
  @IsOptional()
  @IsNumber()
  width?: number;

  @ApiPropertyOptional({ example: 54 })
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

// ========== ALUMNI ==========

export class CreateAlumniDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName!: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 2020 })
  @IsNumber()
  graduationYear!: number;

  @ApiProperty({ example: '12th' })
  @IsString()
  lastClass!: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  lastSection?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  currentOccupation?: string;

  @ApiPropertyOptional({ example: 'Google' })
  @IsOptional()
  @IsString()
  currentCompany?: string;

  @ApiPropertyOptional({ example: 'Bangalore' })
  @IsOptional()
  @IsString()
  currentCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedInUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  achievements?: any;
}

export class AlumniQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  graduationYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastClass?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

// ========== ADMISSION APPROVAL ==========

export class ApproveAdmissionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() notes?:             string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedSectionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() admissionNumber?:   string;
  @ApiPropertyOptional() @IsOptional() @IsString() rollNumber?:        string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateOfBirth?:       string;
  @ApiPropertyOptional() @IsOptional() @IsString() gender?:            string;
  @ApiPropertyOptional() @IsOptional() @IsString() bloodGroup?:        string;
  @ApiPropertyOptional() @IsOptional() @IsString() guardianFirstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() guardianLastName?:  string;
  @ApiPropertyOptional() @IsOptional() @IsString() guardianPhone?:     string;
  @ApiPropertyOptional() @IsOptional() @IsString() guardianEmail?:     string;
  @ApiPropertyOptional() @IsOptional() @IsString() guardianRelation?:  string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine?:       string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?:              string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?:             string;
  @ApiPropertyOptional() @IsOptional() @IsString() pincode?:           string;
}

export class RejectAdmissionDto {
  @ApiProperty({ example: 'Does not meet age criteria' })
  @IsString()
  reason!: string;
}
