import { IsString, IsOptional, IsEmail, IsNotEmpty, IsDateString, IsBoolean } from 'class-validator';

export class CreateStaffDto {
  @IsNotEmpty() @IsString() userId: string;
  @IsNotEmpty() @IsString() employeeId: string;
  @IsNotEmpty() @IsString() designation: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() type?: string;
  @IsNotEmpty() @IsDateString() dateOfJoining: string;
}

export class UpdateStaffDto {
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
