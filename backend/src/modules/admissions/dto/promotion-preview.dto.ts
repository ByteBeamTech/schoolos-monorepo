import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PromotionPreviewDto {
  @ApiProperty()
  @IsString()
  sourceSessionId!: string;

  @ApiProperty()
  @IsString()
  targetSessionId!: string;
}
