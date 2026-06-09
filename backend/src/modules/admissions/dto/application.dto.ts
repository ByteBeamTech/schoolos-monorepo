import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AdmissionMode,
  ApplicationStatus,
  BloodGroup,
  Category,
  DocumentType,
  Gender,
  GuardianRelation,
  Religion,
} from '@prisma/client';

/**
 * Phase 2-4 DTOs (MVP) for the AdmissionApplication pipeline.
 * Source of truth for the application form fields.
 */

export class GuardianInputDto {
  @IsString() @Length(2, 80)
  firstName!: string;

  @IsString() @Length(1, 80)
  lastName!: string;

  @IsString() @Length(5, 20)
  phone!: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MaxLength(80)
  occupation?: string;

  @IsEnum(GuardianRelation)
  relation!: GuardianRelation;

  @IsOptional() @IsBoolean()
  isPrimary?: boolean;
}

export class CreateApplicationDto {
  // Student core
  @IsString() @Length(1, 80) firstName!: string;
  @IsOptional() @IsString() @MaxLength(80) middleName?: string;
  @IsString() @Length(1, 80) lastName!: string;
  @IsDateString() dob!: string;
  @IsEnum(Gender) gender!: Gender;

  @IsOptional() @IsEnum(BloodGroup) bloodGroup?: BloodGroup;
  @IsOptional() @IsEnum(Category) category?: Category;
  @IsOptional() @IsEnum(Religion) religion?: Religion;
  @IsOptional() @IsString() @MaxLength(40) nationality?: string;
  @IsOptional() @IsString() photoUrl?: string;

  // Contact (student)
  @IsOptional() @IsString() @Length(5, 20) phone?: string;
  @IsOptional() @IsEmail() email?: string;

  // Academic
  @IsString() applyingClassId!: string;
  @IsString() @MaxLength(20) academicYear!: string;
  @IsOptional() @IsString() sessionId?: string;
  @IsEnum(AdmissionMode) admissionMode!: AdmissionMode;
  @IsOptional() @IsString() @MaxLength(120) previousSchool?: string;
  @IsOptional() @IsString() @MaxLength(40) previousClass?: string;

  // Family snapshot (denormalized; canonical guardians are separate)
  @IsOptional() @IsString() @MaxLength(120) fatherName?: string;
  @IsOptional() @IsString() @MaxLength(20)  fatherPhone?: string;
  @IsOptional() @IsString() @MaxLength(80)  fatherOccupation?: string;
  @IsOptional() @IsString() @MaxLength(120) motherName?: string;
  @IsOptional() @IsString() @MaxLength(20)  motherPhone?: string;
  @IsOptional() @IsString() @MaxLength(80)  motherOccupation?: string;

  // Health & logistics
  @IsOptional() @IsString() @MaxLength(500) medicalConditions?: string;
  @IsOptional() @IsString() @MaxLength(500) allergies?: string;
  @IsOptional() @IsBoolean() transportRequired?: boolean;
  @IsOptional() @IsString() @MaxLength(120) pickupLocation?: string;

  // Marketing
  @IsOptional() @IsString() sourceId?: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() referredById?: string;

  // Canonical guardians (at least one required on submit)
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => GuardianInputDto)
  guardians?: GuardianInputDto[];

  // Optional initial notes
  @IsOptional() @IsString() @MaxLength(2000) initialNote?: string;
}

export class UpdateApplicationDto {
  @IsOptional() @IsString() @Length(1, 80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) middleName?: string;
  @IsOptional() @IsString() @Length(1, 80) lastName?: string;
  @IsOptional() @IsDateString() dob?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;

  @IsOptional() @IsEnum(BloodGroup) bloodGroup?: BloodGroup;
  @IsOptional() @IsEnum(Category) category?: Category;
  @IsOptional() @IsEnum(Religion) religion?: Religion;
  @IsOptional() @IsString() @MaxLength(40) nationality?: string;
  @IsOptional() @IsString() photoUrl?: string;

  @IsOptional() @IsString() @Length(5, 20) phone?: string;
  @IsOptional() @IsEmail() email?: string;

  @IsOptional() @IsString() applyingClassId?: string;
  @IsOptional() @IsString() @MaxLength(20) academicYear?: string;
  @IsOptional() @IsString() sessionId?: string;
  @IsOptional() @IsEnum(AdmissionMode) admissionMode?: AdmissionMode;
  @IsOptional() @IsString() @MaxLength(120) previousSchool?: string;
  @IsOptional() @IsString() @MaxLength(40) previousClass?: string;

  @IsOptional() @IsString() @MaxLength(120) fatherName?: string;
  @IsOptional() @IsString() @MaxLength(20)  fatherPhone?: string;
  @IsOptional() @IsString() @MaxLength(80)  fatherOccupation?: string;
  @IsOptional() @IsString() @MaxLength(120) motherName?: string;
  @IsOptional() @IsString() @MaxLength(20)  motherPhone?: string;
  @IsOptional() @IsString() @MaxLength(80)  motherOccupation?: string;

  @IsOptional() @IsString() @MaxLength(500) medicalConditions?: string;
  @IsOptional() @IsString() @MaxLength(500) allergies?: string;
  @IsOptional() @IsBoolean() transportRequired?: boolean;
  @IsOptional() @IsString() @MaxLength(120) pickupLocation?: string;

  @IsOptional() @IsString() sourceId?: string;
  @IsOptional() @IsString() campaignId?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => GuardianInputDto)
  guardians?: GuardianInputDto[];
}

export class ConvertLeadDto {
  /** Lead being converted */
  @IsString() leadId!: string;

  /** Application payload (same shape as direct create). */
  @ValidateNested() @Type(() => CreateApplicationDto)
  application!: CreateApplicationDto;
}

export class ListApplicationsQueryDto {
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() applyingClassId?: string;
  @IsOptional() @IsString() academicYear?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}

export class UploadDocumentDto {
  @IsEnum(DocumentType) type!: DocumentType;
  @IsString() fileUrl!: string;
  @IsOptional() @IsString() @MaxLength(200) fileName?: string;
  @IsOptional() @IsString() @MaxLength(80) mimeType?: string;
  @IsOptional() @IsInt() @Min(0) fileSize?: number;
}

export class ApproveApplicationDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() sectionId?: string;
}

export class RejectApplicationDto {
  @IsString() @Length(2, 500) reason!: string;
}

export class FinalizeApplicationDto {
  /** Optional override — defaults to allocated section */
  @IsOptional() @IsString() sectionId?: string;
  /** Optional override — defaults to next available roll number in section */
  @IsOptional() @IsString() @MaxLength(20) rollNumber?: string;
}
