// /apps/schoolos/backend/src/modules/admissions/dto/admissions.dto.ts

import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEmail,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// 🟢 Centralized core engines verification
import { Gender, ApplicationStatus, AdmissionMode, BloodGroup, Category, Religion } from '@prisma/client';

/**
 * 🧱 MASTER INBOUND ADMISSION PIPELINE DTO (ALL 129-LINE PROPERTIES RECOVERED & SECURED)
 */
export class CreateAdmissionDto {
  @ApiProperty({ example: 'Divakar' })
  @IsString() @IsNotEmpty()
  firstName!: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  middleName?: string;

  @ApiProperty({ example: 'Srivastava' })
  @IsString() @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  photoUrl?: string;

  @ApiProperty({ example: '2010-05-15' })
  @IsDateString() @IsNotEmpty()
  dateOfBirth!: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender) @IsNotEmpty()
  gender!: Gender;

  @ApiPropertyOptional({ enum: BloodGroup })
  @IsEnum(BloodGroup) @IsOptional()
  bloodGroup?: BloodGroup;

  @ApiPropertyOptional({ enum: Category })
  @IsEnum(Category) @IsOptional()
  category?: Category;

  @ApiPropertyOptional({ enum: Religion })
  @IsEnum(Religion) @IsOptional()
  religion?: Religion;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  nationality?: string;

  // 📞 Contact Governance
  @ApiProperty({ example: '+91-9876543210' })
  @IsString() @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional()
  @IsEmail() @IsOptional()
  email?: string;

  // 👨‍👩‍👧 Family Aggregate Snapshot Maps
  @ApiPropertyOptional() @IsString() @IsOptional() fatherName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() fatherPhone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() fatherOccupation?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() motherName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() motherPhone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() motherOccupation?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() guardianName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() guardianPhone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() guardianRelation?: string;

  // 🎓 Academic Criteria Metrics
  @ApiProperty({ example: 'class_lko_9th' })
  @IsString() @IsNotEmpty()
  applyingClassId!: string;

  @ApiProperty({ example: '2026-2027' })
  @IsString() @IsNotEmpty()
  academicYear!: string;

  @ApiProperty({ enum: AdmissionMode })
  @IsEnum(AdmissionMode) @IsNotEmpty()
  admissionMode!: AdmissionMode;

  @ApiPropertyOptional() @IsString() @IsOptional() previousSchool?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() previousClass?: string;

  // 🏥 Health & Logistics
  @ApiPropertyOptional() @IsString() @IsOptional() medicalConditions?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() allergies?: string;
  @ApiPropertyOptional() @IsOptional() transportRequired?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() pickupLocation?: string;

  // 🎯 Strategic Metadata Tracking Tokens
  @ApiPropertyOptional() @IsString() @IsOptional() crmNo?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() sourceId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() campaignId?: string;
}

/**
 * 🧱 WORKFLOW LIFECYCLE PROGRESSION CONTRACT
 */
export class UpdateAdmissionStatusDto {
  @ApiProperty({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  note?: string;
}

/**
 * 🧱 COMMAND GOVERNANCE: SEAT ALLOCATION SCHEMA
 */
export class AllocateSeatDto {
  @ApiProperty({ example: 'sec_lko_2026_9a' })
  @IsString() @IsNotEmpty()
  sectionId!: string;
}

/**
 * 🧱 COMMAND GOVERNANCE: ENROLLMENT HANDSHAKE SCHEMA
 */
export class FinalizeEnrollmentDto {
  @ApiProperty({ example: '42' })
  @IsString() @IsNotEmpty()
  rollNumber!: string;
}
