import {
  IsString, IsEmail, IsOptional, IsBoolean,
  IsDateString, IsNotEmpty, IsEnum,
  MaxLength, IsNumberString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum Gender {
  MALE   = 'MALE',
  FEMALE = 'FEMALE',
  OTHER  = 'OTHER',
}

export enum GuardianRelation {
  FATHER         = 'FATHER',
  MOTHER         = 'MOTHER',
  GRANDFATHER    = 'GRANDFATHER',
  GRANDMOTHER    = 'GRANDMOTHER',
  UNCLE          = 'UNCLE',
  AUNT           = 'AUNT',
  SIBLING        = 'SIBLING',
  LEGAL_GUARDIAN = 'LEGAL_GUARDIAN',
  OTHER          = 'OTHER',
}

export class CreateStudentDto {
  @ApiProperty({ description: 'Branch ID the student belongs to' })
  @IsString() @IsNotEmpty()
  branchId!: string;

  @ApiProperty({ example: 'ADM-2025-001' })
  @IsString() @IsNotEmpty()
  admissionNumber!: string;

  @ApiProperty({ example: 'Arjun' })
  @IsString() @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString() @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ description: 'Academic Session ID' })
  @IsString() @IsNotEmpty()
  academicYear!: string;

  @ApiPropertyOptional({ example: '2010-05-15' })
  @IsDateString() @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsEnum(Gender) @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({ example: 'O+' })
  @IsString() @IsOptional()
  bloodGroup?: string;

  @ApiPropertyOptional({ description: 'Section ID' })
  @IsString() @IsOptional()
  sectionId?: string;

  @ApiPropertyOptional({ example: '42' })
  @IsString() @IsOptional()
  rollNumber?: string;

  @ApiPropertyOptional({ example: '123456789012' })
  @IsNumberString() @MaxLength(12) @IsOptional()
  aadhaarNumber?: string;
}

export class UpdateStudentDto {
  @ApiPropertyOptional() @IsString()      @IsOptional() firstName?:   string;
  @ApiPropertyOptional() @IsString()      @IsOptional() lastName?:    string;
  @ApiPropertyOptional() @IsDateString()  @IsOptional() dateOfBirth?: string;
  @ApiPropertyOptional({ enum: Gender })  @IsEnum(Gender) @IsOptional() gender?: Gender;
  @ApiPropertyOptional() @IsString()      @IsOptional() bloodGroup?:  string;
  @ApiPropertyOptional() @IsString()      @IsOptional() sectionId?:   string;
  @ApiPropertyOptional() @IsString()      @IsOptional() rollNumber?:  string;
  @ApiPropertyOptional() @IsBoolean()     @IsOptional() isActive?:    boolean;
}

export class CreateGuardianDto {
  @ApiProperty({ example: 'Rajesh' })
  @IsString() @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString() @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: '+91-9876543210' })
  @IsString() @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ example: 'rajesh@example.com' })
  @IsEmail() @IsOptional()
  email?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() occupation?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() altPhone?:   string;
}

export class LinkGuardianDto {
  @ApiProperty({ description: 'Guardian ID' })
  @IsString() @IsNotEmpty()
  guardianId!: string;

  @ApiProperty({ enum: GuardianRelation })
  @IsEnum(GuardianRelation)
  relation!: GuardianRelation;

  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  isPrimary?: boolean;
}
