import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  AddonStatus,
} from '@prisma/client';

import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTenantAddonDto {
  @ApiProperty()
  @IsString()
  subscriptionId: string;

  @ApiProperty()
  @IsString()
  addonId: string;

  @ApiProperty({
    default: 1,
  })
  @IsInt()
  @Min(1)
  quantity = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: Date;

  @ApiPropertyOptional({
    enum: AddonStatus,
  })
  @IsOptional()
  @IsEnum(AddonStatus)
  status?: AddonStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
