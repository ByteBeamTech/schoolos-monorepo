import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty()         @IsString()              title!:       string;
  @ApiProperty()         @IsString()              description!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?:   string;
  @ApiPropertyOptional() @IsOptional() @IsString() priority?:   string;
}

export class UpdateTicketDto {
  @ApiPropertyOptional() @IsOptional() @IsString()  status?:     string;
  @ApiPropertyOptional() @IsOptional() @IsString()  priority?:   string;
  @ApiPropertyOptional() @IsOptional() @IsString()  assignedTo?: string;
}

export class AddMessageDto {
  @ApiProperty()         @IsString()                message!:    string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isInternal?: boolean;
}
