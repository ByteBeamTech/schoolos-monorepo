// /apps/schoolos/backend/src/modules/school-management/school-management.dto.ts

import { IsString, IsOptional, IsNotEmpty, IsEmail, IsEnum, IsBoolean, IsNumber, IsArray, ArrayMinSize, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, Currency } from '@prisma/client';

// ============================================================================
// 🏫 CORE SCHOOL & BRANCH CONTRACTS (RESTORED)
// ============================================================================

export class UpdateSchoolProfileDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() shortName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() website?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() address?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() city?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() state?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() pincode?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() country?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() board?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() registrationNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() gstin?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() timezone?: string;
  @ApiPropertyOptional({ enum: Currency }) @IsEnum(Currency) @IsOptional() currency?: Currency;
}

export class CreateBranchDto {
  @ApiProperty({ example: 'Lucknow Campus' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'LKO-01' })
  @IsString() @IsOptional()
  code?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() address?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() city?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() principal?: string;
}

export class UpdateBranchDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() code?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() address?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() city?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() principal?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
}

// ============================================================================
// 🧱 CLASS MANAGEMENT PAYLOADS (WITH SORT ORDER COMPATIBILITY)
// ============================================================================

export class CreateClassDto {
  @ApiProperty({ example: 'Grade 10' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'G10' })
  @IsString() @IsOptional()
  code?: string;

  // 🟢 FIXED: Injected target missing mapping parameter discovered in line 210 error trace
  @ApiPropertyOptional({ example: 1 })
  @IsNumber() @IsOptional()
  sortOrder?: number;
}

export class UpdateClassDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() code?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() sortOrder?: number;
}

// ============================================================================
// 🏢 SECTION MANAGEMENT PAYLOADS
// ============================================================================

export class CreateSectionDto {
  @ApiProperty({ example: 'Section A' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'cl_lko_10th' })
  @IsString() @IsNotEmpty()
  classId!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() classTeacherId?: string;

  @ApiPropertyOptional({ example: 40 })
  @IsNumber() @Min(1) @Max(200) @IsOptional()
  capacity?: number;
}

export class UpdateSectionDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() classTeacherId?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() capacity?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
}

// ============================================================================
// 📚 ADDITIONAL DOMAIN CRITERIA MODULES (RESTORED FANTASY MISSED EXPORTS)
// ============================================================================

export class CreateSubjectDto {
  @ApiProperty() @IsString() @IsNotEmpty() name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() code?: string;
}



export class CreateRouteDto {
  @ApiProperty() @IsString() @IsNotEmpty() name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() feeAmount?: number;
}

export class CreateVehicleDto {
  @ApiProperty() @IsString() @IsNotEmpty() registrationNumber!: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() capacity?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() driverName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() driverPhone?: string;
}

// ============================================================================
// 🎨 BRANDING & SECURITY GOVERNANCE
// ============================================================================

export class UpdateBrandingDto {
  @ApiPropertyOptional() @IsString() @IsOptional() primaryColor?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() secondaryColor?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() logoUrl?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() faviconUrl?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() portalTitle?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() tagline?: string;
}

export class UpdateSecuritySettingsDto {
  @ApiPropertyOptional() @IsNumber() @IsOptional() sessionTimeoutMinutes?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() requireMfaForAdmins?: boolean;
  @ApiPropertyOptional() @IsNumber() @IsOptional() maxLoginAttempts?: number;
  @ApiPropertyOptional() @IsOptional() allowedIpRanges?: string[];
  @ApiPropertyOptional() @IsBoolean() @IsOptional() enforcePasswordPolicy?: boolean;
  @ApiPropertyOptional() @IsNumber() @IsOptional() passwordExpiryDays?: number;
}

// ============================================================================
// 👥 USER INTERFACE CONTRACTS (CLEAN DRAGONS DELETED)
// ============================================================================

export class InviteUserDto {
  @ApiProperty({ example: 'engineering@bytebeam.io' })
  @IsEmail() @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'Divakar' })
  @IsString() @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Srivastava' })
  @IsString() @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ enum: UserRole, example: 'STAFF' })
  @IsEnum(UserRole) @IsNotEmpty()
  role!: UserRole; 

  @ApiPropertyOptional() @IsString() @IsOptional() branchId?: string;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role!: UserRole;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: [String],
  })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  defaultBranchId?: string;
}


export class GetUsersFilterDto {
  @ApiPropertyOptional({ enum: UserRole }) @IsEnum(UserRole) @IsOptional() role?: UserRole;
  @ApiPropertyOptional() @IsString() @IsOptional() search?: string;
}

export class GetClassesFilterDto {
  @ApiPropertyOptional() @IsString() @IsOptional() search?: string;
}
