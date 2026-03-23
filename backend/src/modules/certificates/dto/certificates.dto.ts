import { IsString, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CertType {
  TRANSFER    = 'TRANSFER',
  BONAFIDE    = 'BONAFIDE',
  CHARACTER   = 'CHARACTER',
  ACHIEVEMENT = 'ACHIEVEMENT',
  MIGRATION   = 'MIGRATION',
  CONDUCT     = 'CONDUCT',
}

export class IssueCertificateDto {
  @ApiProperty()                    @IsString()     @IsNotEmpty() studentId!: string;
  @ApiProperty({ enum: CertType })  @IsEnum(CertType)             type!:      CertType;
  @ApiPropertyOptional()            @IsString()     @IsOptional() reason?:    string;
  @ApiPropertyOptional()            @IsString()     @IsOptional() notes?:     string;
}
