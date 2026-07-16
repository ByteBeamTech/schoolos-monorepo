import { IsString, IsNumber, IsOptional, IsPositive, MaxLength } from 'class-validator';

export class RecordOfflinePaymentDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  // Bank reference / cheque number / UTR — required for the finance team's
  // own reconciliation, not verified against anything automatically (that's
  // the point of "offline": a human has already verified it before calling
  // this endpoint).
  @IsString()
  @MaxLength(200)
  reference!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
