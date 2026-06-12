import {
  IsArray,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TeacherGridAssignmentDto {
  @IsString()
  subjectId: string;

  @IsString()
  teacherId: string;
}

export class SaveTeacherGridDto {
  @IsString()
  academicYearId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherGridAssignmentDto)
  assignments: TeacherGridAssignmentDto[];
}
