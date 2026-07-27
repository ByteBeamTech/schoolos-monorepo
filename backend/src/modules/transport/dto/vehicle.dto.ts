import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleFuelType, VehicleStatus } from '@prisma/client';

export class CreateVehicleDto {
  @ApiProperty()
  @IsString()
  registrationNumber!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiPropertyOptional({ enum: VehicleFuelType })
  @IsOptional()
  @IsEnum(VehicleFuelType)
  fuelType?: VehicleFuelType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chassisNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  engineNumber?: string;

  @ApiPropertyOptional({ enum: VehicleStatus })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  // Only honoured for tenant-wide callers (SCHOOL_ADMIN/SCHOOL_OWNER/SUPER_ADMIN)
  // without an x-branch-id context; branch-bound roles always write to their own branch.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ enum: VehicleFuelType })
  @IsOptional()
  @IsEnum(VehicleFuelType)
  fuelType?: VehicleFuelType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chassisNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  engineNumber?: string;

  @ApiPropertyOptional({ enum: VehicleStatus })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;
}

export class ListVehiclesQueryDto {
  @ApiPropertyOptional({ enum: VehicleStatus })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Matches against registrationNumber' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
