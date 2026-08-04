import {
  IsString, IsNumber, IsBoolean, IsOptional,
  IsNotEmpty, IsEnum, IsDateString, IsArray,
  ValidateNested, Min, IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountingNature, LateFeeCalculationMethod, LateFeePenaltyType } from '@prisma/client';

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
  // M12: payer identity -- exactly one of payerId/payerName required,
  // validated in the service layer (cross-field XOR isn't expressible
  // cleanly with a single class-validator decorator here).
  @ApiPropertyOptional() @IsString() @IsOptional() payerId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() payerName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() payerEmail?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() payerPhone?: string;
}

export class VerifyRazorpayPaymentDto {
  @ApiProperty() @IsString() @IsNotEmpty() razorpayOrderId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() razorpayPaymentId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() razorpaySignature!: string;
}

// Counter-collectible methods for MVP scope. Deliberately does NOT include
// RAZORPAY: that flow is a separate, gateway-verified path
// (initiateRazorpay/verifyRazorpay, distinguished by Payment.gateway, not
// paymentMethod) and is never accepted through recordOffline. Also
// deliberately excludes CHEQUE/DD/any batch-settled instrument -- Launch
// Readiness Review (M13 reclassification): those carry deferred-clearance
// risk this MVP has no instrument-lifecycle tracking for, and are
// explicitly out of scope, not merely unsupported by omission. If this
// enum is ever widened to include a non-instant method, M13 (PaymentTender
// and instrument lifecycle) becomes a launch blocker again, not a P2 --
// re-read that review before adding anything here.
//
// Unrelated to, and NOT the same enum as, the dead `PaymentMethod` in
// prisma/schema/enums.prisma (CASH/CHEQUE/BANK_TRANSFER/UPI/CREDIT_CARD/
// DEBIT_CARD/OTHER) -- that one is unused by any model or code path
// (confirmed by search), predates this MVP scope decision, and is left
// untouched here rather than repurposed, to avoid an unrelated schema
// migration for what the review scoped as a DTO-layer validation only.
export enum OfflinePaymentMethod {
  CASH                  = 'CASH',
  UPI                   = 'UPI',
  CARD                  = 'CARD',
  INSTANT_BANK_TRANSFER = 'INSTANT_BANK_TRANSFER',
}

export class RecordOfflinePaymentDto {
  @ApiProperty() @IsString() @IsNotEmpty() invoiceId!: string;
  @ApiProperty() @IsNumber() @IsPositive() amount!: number;
  @ApiProperty({ enum: OfflinePaymentMethod }) @IsEnum(OfflinePaymentMethod) paymentMethod!: OfflinePaymentMethod;
  @ApiPropertyOptional() @IsString() @IsOptional() referenceNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  // M12: payer identity -- exactly one of payerId/payerName required,
  // validated in the service layer. payerName is the required fallback
  // when there's no Guardian to point at: counter cash is sometimes
  // tendered by a relative, driver, or employer.
  @ApiPropertyOptional() @IsString() @IsOptional() payerId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() payerName?: string;
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

// Late Fee Module FDD v2 (docs/product/LATE_FEE_FDD.md) Section 6.2 /
// Implementation Roadmap v2 Sprint 3.
//
// FR-DISC-style create-new-not-edit (mirroring FDD Section 8.6's Fee Plan
// precedent, applied here for the same historical-integrity reason): a
// rule change creates a new row with a new effectiveFrom, it never
// mutates an existing rule's calculation fields. This DTO reflects that --
// there is deliberately no UpdateLateFeeRuleDto with calculation fields;
// DeactivateLateFeeRuleDto below is the only mutation this module allows.
export class CreateLateFeeRuleDto {
  @ApiPropertyOptional() @IsString() @IsOptional() branchId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() feePlanId?: string;
  @ApiProperty({ enum: LateFeeCalculationMethod }) @IsEnum(LateFeeCalculationMethod) calculationMethod!: LateFeeCalculationMethod;
  @ApiProperty({ enum: LateFeePenaltyType }) @IsEnum(LateFeePenaltyType) penaltyType!: LateFeePenaltyType;
  @ApiProperty() @IsNumber() @IsPositive() penaltyValue!: number;
  @ApiProperty() @IsNumber() @Min(0) gracePeriodDays!: number;
  @ApiPropertyOptional() @IsNumber() @IsPositive() @IsOptional() maxPenalty?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() compoundDaily?: boolean;
  @ApiPropertyOptional() @IsDateString() @IsOptional() effectiveFrom?: string;
}

// Deactivate/supersede only -- effectiveUntil and isActive. Deliberately
// has no calculation fields at all, not merely "optional and ignored":
// this shape itself is what makes it impossible for this endpoint to
// become a backdoor edit path (FDD Section 6.2's "never a true update").
export class DeactivateLateFeeRuleDto {
  @ApiPropertyOptional() @IsDateString() @IsOptional() effectiveUntil?: string;
}

// FDD Section 6.2: the live "what would this charge" preview, backed by
// the real calculateLateFee() function -- not a client-side
// reimplementation (Implementation Roadmap v2's explicit redesign,
// closing the drift-risk finding from the roadmap's own review). Accepts
// enough to preview a rule that doesn't exist yet, i.e. before it's ever
// saved -- the actual moment the FDD's preview requirement describes.
export class PreviewLateFeeDto {
  @ApiProperty({ enum: LateFeePenaltyType }) @IsEnum(LateFeePenaltyType) penaltyType!: LateFeePenaltyType;
  @ApiProperty() @IsNumber() @IsPositive() penaltyValue!: number;
  @ApiProperty() @IsNumber() @Min(0) gracePeriodDays!: number;
  @ApiPropertyOptional() @IsNumber() @IsPositive() @IsOptional() maxPenalty?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() compoundDaily?: boolean;
  @ApiProperty() @IsNumber() @IsPositive() dueAmount!: number;
  @ApiProperty() @IsNumber() @Min(0) daysOverdue!: number;
}
