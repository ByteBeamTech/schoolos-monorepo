import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  Currency,
  PricingModel,
  Region,
  PlanCategory,
  SubscriptionTier,
} from '@prisma/client';


export class CreatePricingPlanDto {
  @ApiProperty({
    example: 'Professional',
    description: 'Display name of the pricing plan',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'PROFESSIONAL',
    description: 'Unique immutable code',
  })
  @IsString()
  @Matches(/^[A-Z0-9_]+$/)
  code: string;

  @ApiPropertyOptional({
    example: 'Best for growing schools',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: PlanCategory,
  })
  @IsEnum(PlanCategory)
  category: PlanCategory;

@ApiProperty({
  enum: SubscriptionTier,
})
@IsEnum(SubscriptionTier)
tier: SubscriptionTier;


  @ApiProperty({
    enum: PricingModel,
  })
  @IsEnum(PricingModel)
  model: PricingModel;

  @ApiProperty({
    enum: Currency,
  })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({
    enum: Region,
  })
  @IsEnum(Region)
  region: Region;

  @ApiPropertyOptional({
    example: 9999,
  })
  @ValidateIf(o => o.model === PricingModel.FLAT_FEE)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseFee?: number;

  @ApiPropertyOptional({
    example: 18.5,
  })
  @ValidateIf(o => o.model === PricingModel.PER_STUDENT)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  perStudentRate?: number;

  @ApiProperty({
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  billingCycleMonths: number;

  @ApiPropertyOptional({
    example: 30,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  studentLimit?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  branchLimit?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  staffLimit?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  storageLimitGb?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  overageEnabled?: boolean;

  @ApiPropertyOptional()
  @ValidateIf(o => o.overageEnabled)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  overageRate?: number;

  @ApiPropertyOptional({
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  prorateEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  recommended?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiProperty({
    example: {
      attendance: true,
      fees: true,
      exams: true,
      transport: false,
      library: true,
      hostel: false,
    },
  })
  @IsObject()
  features: Record<string, boolean>;

  @ApiPropertyOptional({
    example: {
      color: '#2563eb',
      badge: 'Most Popular',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
