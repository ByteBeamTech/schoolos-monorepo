import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../../core/roles/roles.guard';
import { Roles } from '../../../core/roles/roles.decorator';
import { AccessControlService } from '../services/access-control.service';
import {
  CreatePermissionDto,
  GrantRolePermissionDto,
  BulkGrantPermissionsDto,
  GrantUserPermissionDto,
  CheckPermissionDto,
} from '../dto/access-control.dto';

@ApiTags('access-control')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('access-control')
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  // ========== PERMISSIONS ==========

  @Get('permissions')
  @ApiOperation({ summary: 'Get all permissions' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async getAllPermissions() {
    return this.accessControlService.getAllPermissions();
  }

  @Get('permissions/grouped')
  @ApiOperation({ summary: 'Get permissions grouped by module' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async getPermissionsByModule() {
    return this.accessControlService.getPermissionsByModule();
  }

  @Post('permissions')
  @ApiOperation({ summary: 'Create a new permission' })
  @Roles('SUPER_ADMIN')
  async createPermission(@Body() dto: CreatePermissionDto) {
    return this.accessControlService.createPermission(dto);
  }

  @Post('permissions/seed')
  @ApiOperation({ summary: 'Seed default permissions' })
  @Roles('SUPER_ADMIN')
  async seedPermissions() {
    return this.accessControlService.seedDefaultPermissions();
  }

  // ========== ROLE PERMISSIONS ==========

  @Get('roles/:role/permissions')
  @ApiOperation({ summary: 'Get permissions for a role' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async getRolePermissions(@Req() req: any, @Param('role') role: string) {
    return this.accessControlService.getRolePermissions(req.tenantId, role);
  }

  @Get('roles/all/permissions')
  @ApiOperation({ summary: 'Get all roles with their permissions' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async getAllRolesPermissions(@Req() req: any) {
    return this.accessControlService.getAllRolesPermissions(req.tenantId);
  }

  @Post('roles/permissions')
  @ApiOperation({ summary: 'Grant permission to a role' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async grantRolePermission(@Req() req: any, @Body() dto: GrantRolePermissionDto) {
    return this.accessControlService.grantRolePermission(req.tenantId, dto, req.user.id);
  }

  @Post('roles/permissions/bulk')
  @ApiOperation({ summary: 'Bulk grant permissions to a role' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async bulkGrantRolePermissions(@Req() req: any, @Body() dto: BulkGrantPermissionsDto) {
    return this.accessControlService.bulkGrantRolePermissions(req.tenantId, dto, req.user.id);
  }

  @Delete('roles/:role/permissions/:permissionId')
  @ApiOperation({ summary: 'Revoke permission from a role' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async revokeRolePermission(
    @Req() req: any,
    @Param('role') role: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.accessControlService.revokeRolePermission(req.tenantId, role, permissionId);
  }

  // ========== USER PERMISSIONS ==========

  @Get('users/:userId/permissions')
  @ApiOperation({ summary: 'Get permission overrides for a user' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async getUserPermissions(@Req() req: any, @Param('userId') userId: string) {
    return this.accessControlService.getUserPermissions(req.tenantId, userId);
  }

  @Post('users/permissions')
  @ApiOperation({ summary: 'Grant/revoke permission override for a user' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async grantUserPermission(@Req() req: any, @Body() dto: GrantUserPermissionDto) {
    return this.accessControlService.grantUserPermission(req.tenantId, dto, req.user.id);
  }

  @Delete('users/:userId/permissions/:permissionId')
  @ApiOperation({ summary: 'Remove permission override for a user' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async revokeUserPermission(
    @Req() req: any,
    @Param('userId') userId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.accessControlService.revokeUserPermission(req.tenantId, userId, permissionId);
  }

  // ========== CHECK PERMISSION ==========

  @Post('check')
  @ApiOperation({ summary: 'Check if current user has a permission' })
  async checkPermission(@Req() req: any, @Body() dto: CheckPermissionDto) {
    const hasPermission = await this.accessControlService.checkPermission(
      req.tenantId,
      req.user.id,
      req.user.role,
      dto.module,
      dto.action,
    );
    return { hasPermission, module: dto.module, action: dto.action };
  }

  @Post('roles/apply-default-matrix')
  @ApiOperation({ summary: 'Apply the built-in default permission matrix for all roles' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async applyDefaultMatrix(@Req() req: any) {
    return this.accessControlService.applyDefaultMatrix(req.tenantId, req.user.id);
  }
}
