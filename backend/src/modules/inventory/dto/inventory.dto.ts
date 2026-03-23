import { IsString, IsOptional, IsNotEmpty, IsNumber, IsDateString, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssetDto {
  @ApiProperty()         @IsString()  @IsNotEmpty()  name!:          string;
  @ApiProperty()         @IsString()  @IsNotEmpty()  category!:      string;
  @ApiPropertyOptional() @IsString()  @IsOptional()  serialNumber?:  string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() purchaseDate?: string;
  @ApiPropertyOptional() @IsNumber()  @Min(0) @IsOptional() purchasePrice?: number;
  @ApiPropertyOptional() @IsString()  @IsOptional()  location?:      string;
  @ApiPropertyOptional() @IsString()  @IsOptional()  condition?:     string;
  @ApiPropertyOptional() @IsString()  @IsOptional()  assignedTo?:    string;
}

export class CreateStockItemDto {
  @ApiProperty()         @IsString()  @IsNotEmpty()  name!:        string;
  @ApiProperty()         @IsString()  @IsNotEmpty()  category!:    string;
  @ApiProperty()         @IsString()  @IsNotEmpty()  unit!:        string;
  @ApiPropertyOptional() @IsInt()     @Min(0) @IsOptional() quantity?:    number;
  @ApiPropertyOptional() @IsInt()     @Min(0) @IsOptional() minQuantity?: number;
  @ApiPropertyOptional() @IsNumber()  @Min(0) @IsOptional() unitCost?:   number;
  @ApiPropertyOptional() @IsString()  @IsOptional()  location?:    string;
}

export class AddMaintenanceLogDto {
  @ApiProperty()         @IsString()  @IsNotEmpty()  description!: string;
  @ApiPropertyOptional() @IsNumber()  @Min(0) @IsOptional() cost?: number;
  @ApiPropertyOptional() @IsString()  @IsOptional()  performedBy?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() nextDueDate?: string;
}
