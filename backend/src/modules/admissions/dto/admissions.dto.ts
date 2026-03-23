import { IsString, IsOptional, IsNotEmpty, IsEmail, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AdmSource { GOOGLE='GOOGLE', REFERRAL='REFERRAL', WALK_IN='WALK_IN', SOCIAL_MEDIA='SOCIAL_MEDIA', DIRECT='DIRECT', EVENT='EVENT', OTHER='OTHER' }
export enum AdmStatus { INQUIRY='INQUIRY', APPLIED='APPLIED', SCREENING='SCREENING', WAITLISTED='WAITLISTED', ENROLLED='ENROLLED', REJECTED='REJECTED', WITHDRAWN='WITHDRAWN' }
export enum AdmGender { MALE='MALE', FEMALE='FEMALE', OTHER='OTHER', PREFER_NOT_TO_SAY='PREFER_NOT_TO_SAY' }

export class CreateAdmissionDto {
  @ApiProperty()         @IsString()    @IsNotEmpty()   firstName!:          string;
  @ApiProperty()         @IsString()    @IsNotEmpty()   lastName!:           string;
  @ApiPropertyOptional() @IsDateString() @IsOptional()  dateOfBirth?:        string;
  @ApiPropertyOptional({ enum: AdmGender }) @IsEnum(AdmGender) @IsOptional() gender?: AdmGender;
  @ApiProperty()         @IsString()    @IsNotEmpty()   phone!:              string;
  @ApiPropertyOptional() @IsString()    @IsOptional()   alternatePhone?:     string;
  @ApiPropertyOptional() @IsString()    @IsOptional()   parentFirstName?:    string;
  @ApiPropertyOptional() @IsString()    @IsOptional()   parentLastName?:     string;
  @ApiPropertyOptional() @IsString()    @IsOptional()   parentPhone?:        string;
  @ApiPropertyOptional() @IsEmail()     @IsOptional()   parentEmail?:        string;
  @ApiProperty()         @IsString()    @IsNotEmpty()   applyingForClass!:   string;
  @ApiProperty()         @IsString()    @IsNotEmpty()   academicYear!:       string;
  @ApiPropertyOptional() @IsString()    @IsOptional()   previousSchool?:     string;
  @ApiPropertyOptional() @IsString()    @IsOptional()   addressLine?:        string;
  @ApiPropertyOptional() @IsString()    @IsOptional()   city?:               string;
  @ApiPropertyOptional() @IsString()    @IsOptional()   state?:              string;
  @ApiPropertyOptional() @IsString()    @IsOptional()   pincode?:            string;
  @ApiPropertyOptional() @IsEmail()     @IsOptional()   email?:              string;
  @ApiPropertyOptional({ enum: AdmSource }) @IsEnum(AdmSource) @IsOptional() source?: AdmSource;
  @ApiPropertyOptional() @IsString()    @IsOptional()   notes?:              string;
  @ApiPropertyOptional() @IsString()    @IsOptional()   counsellorId?:       string;
  @ApiPropertyOptional() @IsDateString() @IsOptional()  followUpDate?:       string;
}

export class UpdateAdmissionStatusDto {
  @ApiProperty({ enum: AdmStatus }) @IsEnum(AdmStatus) status!: AdmStatus;
  @ApiPropertyOptional()            @IsString() @IsOptional() note?:             string;
  @ApiPropertyOptional()            @IsString() @IsOptional() rejectionReason?:  string;
  @ApiPropertyOptional()            @IsDateString() @IsOptional() followUpDate?: string;
}
