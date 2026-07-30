import {
  IsString, IsNumber, IsBoolean, IsOptional,
  IsNotEmpty, IsEnum, IsDateString, IsArray,
  ValidateNested, Min, IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountingNature } from '@prisma/client';

export class CreateFeeItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() name!: string;
  @ApiProperty() @IsNumber() @IsPositive() amount!: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isOptional?: boolean;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dueDate?: string;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() gstRate?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() gstCode?: string;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() sortOrder?: number;
}

export class CreateFeePlanDto {
  @ApiProperty() @IsString() @IsNotEmpty() name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() sessionId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() academicYear!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() grade?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() currency?: string;
  @ApiPropertyOptional({ type: [CreateFeeItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateFeeItemDto) @IsOptional()
  feeItems?: CreateFeeItemDto[];
}

export class AssignFeePlanDto {
  @ApiProperty() @IsString() @IsNotEmpty() studentId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() feePlanId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() academicYear!: string;
}

export class GenerateInvoiceDto {
  @ApiProperty() @IsString() @IsNotEmpty() studentId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() feePlanId!: string;
  @ApiProperty() @IsDateString() dueDate!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export class BulkGenerateInvoicesDto {
  @ApiProperty() @IsString() @IsNotEmpty() feePlanId!: string;
  @ApiProperty() @IsDateString() dueDate!: string;
}

export enum PaymentGateway {
  RAZORPAY = 'RAZORPAY',
  STRIPE   = 'STRIPE',
  CASH     = 'CASH',
}

export class InitiatePaymentDto {
  @ApiProperty() @IsString() @IsNotEmpty() invoiceId!: string;
  @ApiProperty({ enum: PaymentGateway }) @IsEnum(PaymentGateway) gateway!: PaymentGateway;
  @ApiProperty() @IsNumber() @IsPositive() amount!: number;
  @ApiPropertyOptional() @IsString() @IsOptional() payerName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() payerEmail?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() payerPhone?: string;
}

export class VerifyRazorpayPaymentDto {
  @ApiProperty() @IsString() @IsNotEmpty() razorpayOrderId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() razorpayPaymentId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() razorpaySignature!: string;
}

export class RecordOfflinePaymentDto {
  @ApiProperty() @IsString() @IsNotEmpty() invoiceId!: string;
  @ApiProperty() @IsNumber() @IsPositive() amount!: number;
  @ApiProperty() @IsString() @IsNotEmpty() paymentMethod!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() referenceNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export enum DiscountCategory {
  SIBLING            = 'SIBLING',
  MERIT              = 'MERIT',
  STAFF_CHILD        = 'STAFF_CHILD',
  FINANCIAL_HARDSHIP = 'FINANCIAL_HARDSHIP',
  SCHOLARSHIP        = 'SCHOLARSHIP',
  CUSTOM             = 'CUSTOM',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED      = 'FIXED',
}

export class CreateDiscountDto {
  @ApiProperty() @IsString() @IsNotEmpty() studentId!: string;
  @ApiProperty({ enum: DiscountCategory }) @IsEnum(DiscountCategory) category!: DiscountCategory;
  @ApiProperty({ enum: DiscountType }) @IsEnum(DiscountType) type!: DiscountType;
  @ApiProperty() @IsNumber() @IsPositive() value!: number;
  @ApiProperty() @IsDateString() validFrom!: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() validUntil?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() reason?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export class ApproveDiscountDto {
  @ApiProperty() @IsString() @IsNotEmpty() approvalNote!: string;
}

export class RejectDiscountDto {
  @ApiProperty() @IsString() @IsNotEmpty() rejectionNote!: string;
}

export class InitiateRefundDto {
  @ApiProperty() @IsString() @IsNotEmpty() paymentId!: string;
  @ApiProperty() @IsNumber() @IsPositive() amount!: number;
  @ApiProperty() @IsString() @IsNotEmpty() reason!: string;
}

// M9: FeeHead catalog. accountingNature is REQUIRED on create -- there is
// no sensible default between REVENUE and LIABILITY, unlike isActive/
// displayOrder which have obvious ones. Its mutability is enforced in the
// service layer (invariant 19: immutable once referenced by an issued
// invoice), not here -- this DTO only validates shape, not business rules.
export class CreateFeeHeadDto {
  @ApiProperty() @IsString() @IsNotEmpty() name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() code!: string;
  @ApiProperty({ enum: AccountingNature }) @IsEnum(AccountingNature) accountingNature!: AccountingNature;
  @ApiPropertyOptional() @IsString() @IsOptional() parentId?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() displayOrder?: number;
}

export class UpdateFeeHeadDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional({ enum: AccountingNature }) @IsEnum(AccountingNature) @IsOptional() accountingNature?: AccountingNature;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
  @ApiPropertyOptional() @IsNumber() @IsOptional() displayOrder?: number;
}
