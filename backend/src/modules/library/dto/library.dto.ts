import { IsString, IsInt, IsOptional, IsNotEmpty, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookDto {
  @ApiProperty()               @IsString()  @IsNotEmpty() title!:       string;
  @ApiPropertyOptional()       @IsString()  @IsOptional() isbn?:        string;
  @ApiPropertyOptional()       @IsString()  @IsOptional() author?:      string;
  @ApiPropertyOptional()       @IsString()  @IsOptional() publisher?:   string;
  @ApiPropertyOptional()       @IsString()  @IsOptional() subject?:     string;
  @ApiPropertyOptional()       @IsString()  @IsOptional() location?:    string;
  @ApiProperty({ default: 1 }) @IsInt() @Min(1)          totalCopies!: number;
}

export class IssueBookDto {
  @ApiProperty() @IsString() @IsNotEmpty() bookId!:    string;
  @ApiProperty() @IsString() @IsNotEmpty() studentId!: string;
  @ApiProperty() @IsDateString()           dueDate!:   string;
}

export class ReturnBookDto {
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() fine?: number;
}
