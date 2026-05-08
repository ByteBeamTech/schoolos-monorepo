import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEmail,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AdmSource {
  GOOGLE = 'GOOGLE',
  REFERRAL = 'REFERRAL',
  WALK_IN = 'WALK_IN',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  DIRECT = 'DIRECT',
  EVENT = 'EVENT',
  OTHER = 'OTHER',
}

export enum AdmStatus {
  INQUIRY = 'INQUIRY',
  APPLIED = 'APPLIED',
  SCREENING = 'SCREENING',
  WAITLISTED = 'WAITLISTED',
  ENROLLED = 'ENROLLED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum AdmGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

export class CreateAdmissionDto {
  addressLine1?: string;
  fatherEmail?: string;
  email?: string;
  // 🔹 Student Info
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: AdmGender })
  @IsEnum(AdmGender)
  @IsOptional()
  gender?: AdmGender;

  // 🔹 Contact
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  alternatePhone?: string;

  // 🔹 Father
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fatherFirstName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fatherLastName?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  // DUPLICATE REMOVED:   fatherEmail?: string;

  // 🔹 Mother
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  motherFirstName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  motherLastName?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  motherEmail?: string;

  // 🔹 Guardian
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  guardianFirstName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  guardianLastName?: string;

  // 🔹 Academic
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  academicYear!: string;

  // 🔹 Branch (MANDATORY)
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  // 🔹 Address
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  // DUPLICATE REMOVED:   addressLine1?: string;

   @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  pincode?: string;

  // 🔹 Source
  @ApiPropertyOptional({ enum: AdmSource })
  @IsEnum(AdmSource)
  @IsOptional()
  source?: AdmSource;

  // 🔹 Notes
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  counsellorId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  followUpDate?: string;
}

export class UpdateAdmissionStatusDto {
  addressLine1?: string;
  fatherEmail?: string;
  email?: string;
  @ApiProperty({ enum: AdmStatus })
  @IsEnum(AdmStatus)
  status!: AdmStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rejectionReason?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  followUpDate?: string;
}
