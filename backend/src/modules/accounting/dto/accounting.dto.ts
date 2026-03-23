import { IsString, IsOptional, IsNotEmpty, IsNumber, IsDateString, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExpenseCat {
  UTILITIES   = 'UTILITIES',
  STATIONERY  = 'STATIONERY',
  MAINTENANCE = 'MAINTENANCE',
  SALARIES    = 'SALARIES',
  TRANSPORT   = 'TRANSPORT',
  EVENTS      = 'EVENTS',
  EQUIPMENT   = 'EQUIPMENT',
  PETTY_CASH  = 'PETTY_CASH',
  OTHER       = 'OTHER',
}

export class CreateExpenseDto {
  @ApiProperty({ enum: ExpenseCat })  @IsEnum(ExpenseCat)            category!:    ExpenseCat;
  @ApiProperty()                      @IsNumber() @Min(0)            amount!:      number;
  @ApiProperty()                      @IsString() @IsNotEmpty()      description!: string;
  @ApiProperty()                      @IsDateString()                expenseDate!: string;
  @ApiPropertyOptional()              @IsString() @IsOptional()      vendorId?:    string;
  @ApiPropertyOptional()              @IsString() @IsOptional()      receiptUrl?:  string;
}

export class CreateVendorDto {
  @ApiProperty()         @IsString() @IsNotEmpty()  name!:        string;
  @ApiPropertyOptional() @IsString() @IsOptional()  contactName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional()  phone?:       string;
  @ApiPropertyOptional() @IsString() @IsOptional()  email?:       string;
  @ApiPropertyOptional() @IsString() @IsOptional()  gstNumber?:   string;
}
