import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

import { Type } from 'class-transformer';

import {
  AddonCategory,
  BillingType,
  Currency,
} from '@prisma/client';

export class CreatePricingAddonDto {
  @ApiProperty({
    example: 'SMS Pack 1000',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'SMS_PACK_1000',
  })
  @IsString()
  @Matches(/^[A-Z0-9_]+$/)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: AddonCategory,
  })
  @IsEnum(AddonCategory)
  category: AddonCategory;

  @ApiProperty({
    enum: BillingType,
  })
  @IsEnum(BillingType)
  billingType: BillingType;

  @ApiProperty({
    enum: Currency,
  })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({
    example: 499,
  })
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({
    default: true,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: {
      smsCount: 1000,
      provider: 'MSG91',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
