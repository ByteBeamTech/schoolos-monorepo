import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '@prisma/client';

export class CreateStopPricingDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  feeAmount!: number;

  @ApiPropertyOptional({ enum: Currency, default: Currency.INR })
  @IsOptional()
  @IsIn(Object.values(Currency))
  currency?: Currency;

  @ApiPropertyOptional({ description: 'ISO date; defaults to now if omitted' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

export class EndStopPricingDto {
  @ApiPropertyOptional({ description: 'ISO date; defaults to now if omitted' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
