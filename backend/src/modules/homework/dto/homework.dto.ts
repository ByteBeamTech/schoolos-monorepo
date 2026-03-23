import { IsString, IsOptional, IsNotEmpty, IsDateString, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHomeworkDto {
  @ApiProperty()         @IsString()    @IsNotEmpty()  sessionId!:   string;
  @ApiProperty()         @IsString()    @IsNotEmpty()  classId!:     string;
  @ApiPropertyOptional() @IsString()    @IsOptional()  sectionId?:   string;
  @ApiProperty()         @IsString()    @IsNotEmpty()  subjectId!:   string;
  @ApiProperty()         @IsString()    @IsNotEmpty()  title!:       string;
  @ApiProperty()         @IsDateString()               dueDate!:     string;
  @ApiPropertyOptional() @IsString()    @IsOptional()  description?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() maxMarks?:  number;
}
