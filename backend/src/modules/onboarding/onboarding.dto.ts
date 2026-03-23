import { IsString, IsEmail, IsOptional, IsNumber, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OnboardTenantDto {
  @ApiProperty({ example: 'Greenwood International School' })
  @IsString()
  schoolName!: string;

  @ApiProperty({ example: 'greenwood-school', description: 'Unique slug — URL-safe, lowercase, hyphens only' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase letters, numbers, and hyphens only' })
  slug!: string;

  @ApiProperty({ example: 'admin@greenwood.edu.in' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: 'Ravi', description: 'Admin first name' })
  @IsString()
  adminFirstName!: string;

  @ApiProperty({ example: 'Kumar', description: 'Admin last name' })
  @IsString()
  adminLastName!: string;

  @ApiProperty({ example: 'Secure@1234', description: 'Min 8 chars, must have uppercase, number, special char' })
  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  contactPhone!: string;

  @ApiPropertyOptional({ example: 'plan_abc123', description: 'Pricing plan ID — defaults to Starter trial' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ enum: ['IN', 'US', 'EU', 'UK', 'GLOBAL'], default: 'IN' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ enum: ['INR', 'USD', 'GBP', 'EUR'], default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 500, description: 'Max students allowed' })
  @IsOptional()
  @IsNumber()
  maxStudents?: number;

  @ApiPropertyOptional({ example: 30, description: 'Trial period in days (0 = skip trial)' })
  @IsOptional()
  @IsNumber()
  trialDays?: number;

  @ApiPropertyOptional({ example: '2024-25', description: 'First academic session name' })
  @IsOptional()
  @IsString()
  sessionName?: string;
}
