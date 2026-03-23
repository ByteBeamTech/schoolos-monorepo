import {
  IsString, IsInt, IsOptional, IsNotEmpty, IsBoolean,
  Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTimetableSlotDto {
  @ApiProperty() @IsString() @IsNotEmpty() sectionId!:    string;
  @ApiProperty() @IsString() @IsNotEmpty() subjectId!:    string;
  @ApiProperty() @IsString() @IsNotEmpty() teacherId!:    string;
  @ApiProperty({ description: '1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat' })
  @IsInt() @Min(1) @Max(6) dayOfWeek!:   number;
  @ApiProperty() @IsInt() @Min(1) @Max(10) periodNumber!: number;
  @ApiProperty({ example: '08:00' }) @IsString() @IsNotEmpty() startTime!: string;
  @ApiProperty({ example: '08:45' }) @IsString() @IsNotEmpty() endTime!:   string;
  @ApiPropertyOptional() @IsString() @IsOptional() roomId?: string;
}

export class UpdateTimetableSlotDto {
  @ApiPropertyOptional() @IsString()  @IsOptional() subjectId?:   string;
  @ApiPropertyOptional() @IsString()  @IsOptional() teacherId?:   string;
  @ApiPropertyOptional() @IsString()  @IsOptional() startTime?:   string;
  @ApiPropertyOptional() @IsString()  @IsOptional() endTime?:     string;
  @ApiPropertyOptional() @IsString()  @IsOptional() roomId?:      string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?:    boolean;
}

export class BulkCreateTimetableDto {
  @ApiProperty() @IsString() @IsNotEmpty() sectionId!: string;
  @ApiProperty({ type: [CreateTimetableSlotDto] }) slots!: CreateTimetableSlotDto[];
}
