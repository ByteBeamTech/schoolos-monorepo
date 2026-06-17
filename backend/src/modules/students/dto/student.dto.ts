// /apps/schoolos/backend/src/modules/students/dto/student.dto.ts

import {
  IsString, IsEmail, IsOptional, IsBoolean,
  IsDateString, IsNotEmpty, IsEnum,
  MaxLength, IsNumberString, IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// 🟢 CRITICAL ARCHITECTURAL FIX: Direct contract binding to eliminate dual-source drift forever
import { AdmissionType, Gender, GuardianRelation, Religion,  Category,  StudentStatus, } from '@prisma/client';

export class CreateStudentDto {
  @ApiProperty({ description: 'Branch ID the student belongs to' })
  @IsString() @IsNotEmpty()
  branchId!: string;

  @ApiProperty({ description: 'Class ID the student maps to' })
  @IsString() @IsNotEmpty()
  classId!: string; 

  @ApiPropertyOptional({ example: 'ADM-2025-001' })
  @IsString() @IsOptional()
  admissionNumber?: string;

  @ApiProperty({ example: 'Divakar' })
  @IsString() @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString() @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ description: 'Academic Session ID or Tracking Reference String' })
  @IsString() @IsNotEmpty()
  academicYear!: string; 

  @ApiPropertyOptional({ example: '2010-05-15' })
  @IsDateString() @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: Gender, description: 'Directly governed by Prisma client definition' })
  @IsEnum(Gender) @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({ enum: Religion })
@IsEnum(Religion)
@IsOptional()
religion?: Religion;

@ApiPropertyOptional({ enum: Category })
@IsEnum(Category)
@IsOptional()
category?: Category;


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
  aadharNumber?: string; 
}

export class UpdateStudentDto {
  @ApiPropertyOptional() @IsString()      @IsOptional() classId?:     string; 
  @ApiPropertyOptional() @IsString()      @IsOptional() firstName?:   string;
  @ApiPropertyOptional() @IsString()      @IsOptional() lastName?:    string;
  @ApiPropertyOptional() @IsDateString()  @IsOptional() dateOfBirth?: string;
  @ApiPropertyOptional({ enum: Gender })  @IsEnum(Gender) @IsOptional() gender?: Gender;
  @ApiPropertyOptional() @IsString()      @IsOptional() bloodGroup?:  string;
  @ApiPropertyOptional() @IsString()      @IsOptional() sectionId?:   string;
  @ApiPropertyOptional() @IsString()      @IsOptional() rollNumber?:  string;
  @ApiPropertyOptional() @IsBoolean()     @IsOptional() isActive?:    boolean;

  @ApiPropertyOptional({ enum: Religion })
@IsEnum(Religion)
@IsOptional()
religion?: Religion;

@ApiPropertyOptional({ enum: Category })
@IsEnum(Category)
@IsOptional()
category?: Category;

@ApiPropertyOptional({ enum: StudentStatus })
@IsEnum(StudentStatus)
@IsOptional()
status?: StudentStatus;

@ApiPropertyOptional()
@IsString()
@IsOptional()
email?: string;

@ApiPropertyOptional()
@IsString()
@IsOptional()
phone?: string;

@ApiPropertyOptional()
@IsString()
@IsOptional()
address?: string;

@ApiPropertyOptional()
@IsString()
@IsOptional()
apaarId?: string;

@ApiPropertyOptional()
@IsString()
@IsOptional()
boardRegistrationNumber?: string;

@ApiPropertyOptional()
@IsNumber()
@IsOptional()
heightCm?: number;

@ApiPropertyOptional()
@IsNumber()
@IsOptional()
weightKg?: number;

@ApiPropertyOptional()
@IsDateString()
@IsOptional()
lastHealthCheck?: string;

@ApiPropertyOptional()
@IsString()
@IsOptional()
photoUrl?: string;

@ApiPropertyOptional()
@IsDateString()
@IsOptional()
admissionDate?: string;

@ApiPropertyOptional({ enum: AdmissionType })
@IsEnum(AdmissionType)
@IsOptional()
admissionType?: AdmissionType;

@ApiPropertyOptional()
@IsString()
@IsOptional()
houseId?: string;

@ApiPropertyOptional()
@IsString()
@IsOptional()
previousSchool?: string;

@ApiPropertyOptional()
@IsString()
@IsOptional()
previousClass?: string;

@ApiPropertyOptional()
@IsString()
@IsOptional()
previousSchoolTcNumber?: string;

@ApiPropertyOptional()
@IsBoolean()
@IsOptional()
isRte?: boolean;

@ApiPropertyOptional()
@IsString()
@IsOptional()
rteRegNumber?: string;

@ApiPropertyOptional()
@IsString()
@IsOptional()
rteApplicationId?: string;

}

export class CreateGuardianDto {
  @ApiProperty({ example: 'Vibhakar' })
  @IsString() @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Srivastava' })
  @IsString() @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: '+91-9876543210' })
  @IsString() @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ example: 'vibhakar8@gmail.com' })
  @IsEmail() @IsOptional()
  email?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() occupation?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() altPhone?:   string;
}

export class LinkGuardianDto {
  @ApiProperty({ description: 'Guardian ID' })
  @IsString() @IsNotEmpty()
  guardianId!: string;

  @ApiProperty({ enum: GuardianRelation, description: 'Directly governed by Prisma client definition' })
  @IsEnum(GuardianRelation) // 🟢 Single-Source Validation Active!
  relation!: GuardianRelation;

  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  isPrimary?: boolean;
}
