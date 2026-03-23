import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkStudentRowDto {
  @ApiProperty() firstName!:        string;
  @ApiProperty() lastName!:         string;
  @ApiProperty() admissionNumber!:  string;
  @ApiProperty() academicYear!:     string;
  @ApiPropertyOptional() sectionId?: string;
  @ApiPropertyOptional() rollNumber?: string;
  @ApiPropertyOptional() phone?:     string;
  @ApiPropertyOptional() email?:     string;
}

export class BulkInvoiceDto {
  @ApiProperty() @IsString() @IsNotEmpty() feePlanId!:    string;
  @ApiProperty() @IsString() @IsNotEmpty() classId!:      string;
  @ApiProperty() @IsDateString()           dueDate!:      string;
  @ApiPropertyOptional() @IsString() @IsOptional() academicYear?: string;
}
