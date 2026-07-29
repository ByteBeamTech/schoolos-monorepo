import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RouteStatus } from '@prisma/client';

export class CreateRouteDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  // Only honoured for tenant-wide callers; see vehicle.dto.ts for the same note.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class UpdateRouteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class ListRoutesQueryDto {
  @ApiPropertyOptional({ enum: RouteStatus })
  @IsOptional()
  @IsIn(Object.values(RouteStatus))
  status?: RouteStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Matches against name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

// ----------------------------------------------------------------------------
// Phase 4 — Route Lifecycle
// ----------------------------------------------------------------------------

export class CloneRouteDto {
  @ApiProperty({ description: 'Name for the new (DRAFT) cloned route' })
  @IsString()
  name!: string;
}

// AF-007 wizard step: User Confirmation for the Route Suspend operation.
export class ConfirmSuspendRouteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description:
      'Preview.impactToken from GET .../suspend/preview — required so Execute ' +
      'only runs against the exact impact the caller reviewed (AF-007: ' +
      'Preview/Impact Analysis -> User Confirmation -> Execute).',
  })
  @IsString()
  impactToken!: string;
}
