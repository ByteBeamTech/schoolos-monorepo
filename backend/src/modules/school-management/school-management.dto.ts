import {
  IsString, IsEmail, IsOptional, IsBoolean,
  IsNotEmpty, IsEnum, IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── School Profile ────────────────────────────────────────────────────────────
export class UpdateSchoolProfileDto {
  @ApiPropertyOptional() @IsString()  @IsOptional() name?:               string;
  @ApiPropertyOptional() @IsString()  @IsOptional() shortName?:          string;
  @ApiPropertyOptional() @IsString()  @IsOptional() phone?:              string;
  @ApiPropertyOptional() @IsEmail()   @IsOptional() email?:              string;
  @ApiPropertyOptional() @IsString()  @IsOptional() website?:            string;
  @ApiPropertyOptional() @IsString()  @IsOptional() address?:            string;
  @ApiPropertyOptional() @IsString()  @IsOptional() city?:               string;
  @ApiPropertyOptional() @IsString()  @IsOptional() state?:              string;
  @ApiPropertyOptional() @IsString()  @IsOptional() pincode?:            string;
  @ApiPropertyOptional() @IsString()  @IsOptional() country?:            string;
  @ApiPropertyOptional() @IsString()  @IsOptional() board?:              string;
  @ApiPropertyOptional() @IsString()  @IsOptional() registrationNumber?: string;
  @ApiPropertyOptional() @IsString()  @IsOptional() gstin?:              string;
  @ApiPropertyOptional() @IsString()  @IsOptional() timezone?:           string;
  @ApiPropertyOptional() @IsString()  @IsOptional() currency?:           string;
}

// ── Branch Management ─────────────────────────────────────────────────────────
export class CreateBranchDto {
  @ApiProperty()         @IsString()  @IsNotEmpty() name!:      string;
  @ApiPropertyOptional() @IsString()  @IsOptional() code?:      string;
  @ApiPropertyOptional() @IsString()  @IsOptional() address?:   string;
  @ApiPropertyOptional() @IsString()  @IsOptional() city?:      string;
  @ApiPropertyOptional() @IsString()  @IsOptional() phone?:     string;
  @ApiPropertyOptional() @IsEmail()   @IsOptional() email?:     string;
  @ApiPropertyOptional() @IsString()  @IsOptional() principal?: string;
}
export class UpdateBranchDto {
  @ApiPropertyOptional() @IsString()  @IsOptional() name?:      string;
  @ApiPropertyOptional() @IsString()  @IsOptional() code?:      string;
  @ApiPropertyOptional() @IsString()  @IsOptional() address?:   string;
  @ApiPropertyOptional() @IsString()  @IsOptional() city?:      string;
  @ApiPropertyOptional() @IsString()  @IsOptional() phone?:     string;
  @ApiPropertyOptional() @IsEmail()   @IsOptional() email?:     string;
  @ApiPropertyOptional() @IsString()  @IsOptional() principal?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?:  boolean;
}

// ── User Management ───────────────────────────────────────────────────────────
export enum StaffRole {
  SCHOOL_ADMIN   = 'SCHOOL_ADMIN',
  PRINCIPAL      = 'PRINCIPAL',
  VICE_PRINCIPAL = 'VICE_PRINCIPAL',
  TEACHER        = 'TEACHER',
  ACCOUNTANT     = 'ACCOUNTANT',
  LIBRARIAN      = 'LIBRARIAN',
  RECEPTIONIST   = 'RECEPTIONIST',
  SUPPORT_STAFF  = 'SUPPORT_STAFF',
}
export class InviteUserDto {
  @ApiProperty()         @IsEmail()      @IsNotEmpty() email!:     string;
  @ApiProperty()         @IsString()     @IsNotEmpty() firstName!: string;
  @ApiProperty()         @IsString()     @IsNotEmpty() lastName!:  string;
  @ApiProperty({ enum: StaffRole })      @IsEnum(StaffRole) role!: StaffRole;
  @ApiPropertyOptional() @IsString()     @IsOptional() branchId?:  string;
}
export class UpdateUserRoleDto {
  @ApiProperty({ enum: StaffRole })      @IsEnum(StaffRole) role!: StaffRole;
  @ApiPropertyOptional() @IsBoolean()    @IsOptional() isActive?:  boolean;
}

// ── Academic Setup ────────────────────────────────────────────────────────────
export class CreateClassDto {
  @ApiProperty()         @IsString()  @IsNotEmpty() name!:      string;
  @ApiPropertyOptional()              @IsOptional() sortOrder?: number;
}
export class CreateSectionDto {
  @ApiProperty()         @IsString()  @IsNotEmpty() name!:           string;
  @ApiProperty()         @IsString()  @IsNotEmpty() classId!:        string;
  @ApiPropertyOptional() @IsString()  @IsOptional() classTeacherId?: string;
  @ApiPropertyOptional()              @IsOptional() capacity?:        number;
}
export class UpdateSectionDto {
  @ApiPropertyOptional() @IsString()  @IsOptional() name?:           string;
  @ApiPropertyOptional() @IsString()  @IsOptional() classTeacherId?: string;
  @ApiPropertyOptional()              @IsOptional() capacity?:        number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?:        boolean;
}
export class CreateSubjectDto {
  @ApiProperty()         @IsString()  @IsNotEmpty() name!:        string;
  @ApiPropertyOptional() @IsString()  @IsOptional() code?:        string;
  @ApiPropertyOptional() @IsString()  @IsOptional() description?: string;
}

// ── Fee Setup ─────────────────────────────────────────────────────────────────
export class CreateFeeTypeDto {
  @ApiProperty()         @IsString()  @IsNotEmpty() name!:        string;
  @ApiPropertyOptional() @IsString()  @IsOptional() description?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isMandatory?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isRecurring?: boolean;
}
export enum FeeFrequency {
  MONTHLY     = 'MONTHLY',
  QUARTERLY   = 'QUARTERLY',
  HALF_YEARLY = 'HALF_YEARLY',
  ANNUAL      = 'ANNUAL',
  ONE_TIME    = 'ONE_TIME',
}
export class CreateFeeStructureDto {
  @ApiProperty()         @IsString()     @IsNotEmpty() name!:      string;
  @ApiProperty()         @IsString()     @IsNotEmpty() classId!:   string;
  @ApiProperty({ enum: FeeFrequency })   @IsEnum(FeeFrequency) frequency!: FeeFrequency;
  @ApiProperty()                                       amount!:     number;
  @ApiPropertyOptional() @IsString()     @IsOptional() feeTypeId?: string;
}

// ── Transport Setup ───────────────────────────────────────────────────────────
export class CreateRouteDto {
  @ApiProperty()         @IsString()  @IsNotEmpty() name!:        string;
  @ApiPropertyOptional() @IsString()  @IsOptional() description?: string;
  @ApiPropertyOptional()              @IsOptional() feeAmount?:    number;
}
export class CreateVehicleDto {
  @ApiProperty()         @IsString()  @IsNotEmpty() registrationNumber!: string;
  @ApiPropertyOptional() @IsString()  @IsOptional() model?:              string;
  @ApiPropertyOptional()              @IsOptional() capacity?:            number;
  @ApiPropertyOptional() @IsString()  @IsOptional() driverName?:         string;
  @ApiPropertyOptional() @IsString()  @IsOptional() driverPhone?:        string;
}

// ── Branding ──────────────────────────────────────────────────────────────────
export class UpdateBrandingDto {
  @ApiPropertyOptional() @IsString() @IsOptional() primaryColor?:   string;
  @ApiPropertyOptional() @IsString() @IsOptional() secondaryColor?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() logoUrl?:        string;
  @ApiPropertyOptional() @IsString() @IsOptional() faviconUrl?:     string;
  @ApiPropertyOptional() @IsString() @IsOptional() portalTitle?:    string;
  @ApiPropertyOptional() @IsString() @IsOptional() tagline?:        string;
}

// ── Security ──────────────────────────────────────────────────────────────────
export class UpdateSecuritySettingsDto {
  @ApiPropertyOptional()              @IsOptional() sessionTimeoutMinutes?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() requireMfaForAdmins?:   boolean;
  @ApiPropertyOptional()              @IsOptional() maxLoginAttempts?:       number;
  @ApiPropertyOptional() @IsArray()   @IsOptional() allowedIpRanges?:        string[];
  @ApiPropertyOptional() @IsBoolean() @IsOptional() enforcePasswordPolicy?:  boolean;
  @ApiPropertyOptional()              @IsOptional() passwordExpiryDays?:     number;
}
