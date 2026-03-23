import { IsString, IsOptional, IsNotEmpty, IsBoolean, IsDateString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAnnouncementDto {
  @ApiProperty()         @IsString()  @IsNotEmpty()  title!:       string;
  @ApiProperty()         @IsString()  @IsNotEmpty()  body!:        string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional()  isPinned?:    boolean;
  @ApiPropertyOptional() @IsDateString() @IsOptional() publishedAt?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() expiresAt?:   string;
  @ApiPropertyOptional() @IsArray()   @IsOptional()  targetRoles?: string[];
}

export class CreateCircularDto {
  @ApiProperty()         @IsString()  @IsNotEmpty()  title!:       string;
  @ApiProperty()         @IsString()  @IsNotEmpty()  body!:        string;
  @ApiPropertyOptional() @IsArray()   @IsOptional()  targetRoles?: string[];
  @ApiPropertyOptional() @IsDateString() @IsOptional() publishedAt?: string;
  @ApiPropertyOptional()              @IsOptional()  attachments?: any[];
}
