import {
  IsString, IsOptional, IsBoolean,
  IsDateString, IsNotEmpty, IsInt, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStaffDto {
  @ApiProperty({ description: 'Existing User ID to link as staff' })
  @IsString() @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 'EMP-001' })
  @IsString() @IsNotEmpty()
  employeeId!: string;

  @ApiProperty({ example: 'Mathematics Teacher' })
  @IsString() @IsNotEmpty()
  designation!: string;

  @ApiPropertyOptional({ example: 'Academics' })
  @IsString() @IsOptional()
  department?: string;

  @ApiProperty({ example: '2020-06-01' })
  @IsDateString()
  dateOfJoining!: string;

  @ApiPropertyOptional({ example: '1990-01-15' })
  @IsDateString() @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'B.Ed, M.Sc Mathematics' })
  @IsString() @IsOptional()
  qualification?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsInt() @Min(0) @IsOptional()
  experience?: number;
}

export class UpdateStaffDto {
  @ApiPropertyOptional() @IsString()      @IsOptional() designation?:  string;
  @ApiPropertyOptional() @IsString()      @IsOptional() department?:   string;
  @ApiPropertyOptional() @IsString()      @IsOptional() qualification?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() experience?:   number;
  @ApiPropertyOptional() @IsBoolean()     @IsOptional() isActive?:     boolean;
}
