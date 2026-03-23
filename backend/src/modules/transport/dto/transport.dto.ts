import { IsString, IsOptional, IsNotEmpty, IsNumber, Min, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRouteDto {
  @ApiProperty()                  @IsString()  @IsNotEmpty() name!:          string;
  @ApiPropertyOptional()          @IsString()  @IsOptional() description?:   string;
  @ApiPropertyOptional()          @IsString()  @IsOptional() vehicleNumber?: string;
  @ApiPropertyOptional()          @IsString()  @IsOptional() driverName?:    string;
  @ApiPropertyOptional()          @IsString()  @IsOptional() driverPhone?:   string;
  @ApiProperty({ default: 0 })    @IsNumber()  @Min(0)       feeAmount!:     number;
  @ApiPropertyOptional()          @IsArray()   @IsOptional() stops?:         string[];
}

export class AssignStudentDto {
  @ApiProperty()         @IsString() @IsNotEmpty() studentId!:    string;
  @ApiProperty()         @IsString() @IsNotEmpty() routeId!:      string;
  @ApiPropertyOptional() @IsString() @IsOptional() boardingStop?: string;
}
