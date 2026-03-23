import { IsString, IsNumber, IsOptional, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGradeBoundaryDto {
  @ApiProperty()         @IsString()  @IsNotEmpty()  sessionId!: string;
  @ApiProperty()         @IsString()  @IsNotEmpty()  grade!:     string;
  @ApiProperty()         @IsNumber()  @Min(0) @Max(100) minMark!: number;
  @ApiProperty()         @IsNumber()  @Min(0) @Max(100) maxMark!: number;
  @ApiPropertyOptional() @IsString()  @IsOptional()  remark?:    string;
  @ApiPropertyOptional() @IsInt()     @Min(0) @IsOptional() sortOrder?: number;
}
