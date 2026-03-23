import { IsString, IsNumber, IsOptional, IsNotEmpty, IsInt, Min, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePayrollStructureDto {
  @ApiProperty()         @IsString()  @IsNotEmpty()  staffId!:          string;
  @ApiProperty()         @IsNumber()  @Min(0)        basicSalary!:      number;
  @ApiPropertyOptional() @IsNumber()  @Min(0) @IsOptional() hra?:       number;
  @ApiPropertyOptional() @IsNumber()  @Min(0) @IsOptional() da?:        number;
  @ApiPropertyOptional() @IsNumber()  @Min(0) @IsOptional() ta?:        number;
  @ApiPropertyOptional() @IsNumber()  @Min(0) @IsOptional() otherAllowances?: number;
  @ApiPropertyOptional() @IsNumber()  @Min(0) @IsOptional() pfEmployee?: number;
  @ApiPropertyOptional() @IsNumber()  @Min(0) @IsOptional() pfEmployer?: number;
  @ApiPropertyOptional() @IsNumber()  @Min(0) @IsOptional() esi?:       number;
  @ApiPropertyOptional() @IsNumber()  @Min(0) @IsOptional() tds?:       number;
  @ApiProperty()         @IsDateString()               effectiveFrom!:  string;
}

export class GeneratePayslipDto {
  @ApiProperty() @IsString()  @IsNotEmpty() staffId!: string;
  @ApiProperty() @IsInt() @Min(1)           month!:   number;
  @ApiProperty() @IsInt()                   year!:    number;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() presentDays?: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() otherDeductions?: number;
}
