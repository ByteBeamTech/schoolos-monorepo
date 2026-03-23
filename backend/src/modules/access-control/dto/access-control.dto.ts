import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({ example: 'students' })
  @IsString()
  module!: string;

  @ApiProperty({ example: 'create' })
  @IsString()
  action!: string;

  @ApiPropertyOptional({ example: 'Create new students' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class GrantRolePermissionDto {
  @ApiProperty({ example: 'TEACHER' })
  @IsString()
  role!: string;

  @ApiProperty({ example: 'perm_abc123' })
  @IsString()
  permissionId!: string;
}

export class BulkGrantPermissionsDto {
  @ApiProperty({ example: 'TEACHER' })
  @IsString()
  role!: string;

  @ApiProperty({ example: ['perm_abc', 'perm_def'] })
  @IsArray()
  @IsString({ each: true })
  permissionIds!: string[];
}

export class GrantUserPermissionDto {
  @ApiProperty({ example: 'user_abc123' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: 'perm_abc123' })
  @IsString()
  permissionId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  granted?: boolean;
}

export class CheckPermissionDto {
  @ApiProperty({ example: 'students' })
  @IsString()
  module!: string;

  @ApiProperty({ example: 'create' })
  @IsString()
  action!: string;
}

export class PermissionResponseDto {
  id!: string;
  module!: string;
  action!: string;
  description?: string;
}

export class RolePermissionsResponseDto {
  role!: string;
  permissions!: PermissionResponseDto[];
}

export class ModulePermissionsDto {
  module!: string;
  actions!: {
    action: string;
    permissionId: string;
    granted: boolean;
  }[];
}
