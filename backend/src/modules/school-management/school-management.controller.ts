// /apps/schoolos/backend/src/modules/school-management/school-management.controller.ts

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SchoolManagementService } from './school-management.service';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';

// 🟢 FIXED: Consolidated 160-line exact DTO mapping. No more duplicate identifiers collision!

import {
  UpdateSchoolProfileDto,
  CreateBranchDto,
  UpdateBranchDto,
  InviteUserDto,
  UpdateUserRoleDto,
  CreateClassDto,
  CreateSectionDto,
  UpdateSectionDto,
  CreateSubjectDto,
  CreateFeeTypeDto,
  CreateFeeStructureDto,
  CreateRouteDto,
  CreateVehicleDto,
  UpdateBrandingDto,
  UpdateSecuritySettingsDto,
  GetUsersFilterDto,
  GetClassesFilterDto
} from './school-management.dto';

@Controller('school-management')
@UseGuards(JwtGuard)
export class SchoolManagementController {
  constructor(private readonly service: SchoolManagementService) {}

  @Get('profile')
  getProfile(@CurrentUser() u: any) {
    return this.service.getProfile(u.tenantId);
  }

  @Put('profile')
  updateProfile(@Body() dto: UpdateSchoolProfileDto, @CurrentUser() u: any) {
    return this.service.updateProfile(u.tenantId, dto, u.id);
  }

  @Get('branches')
  getBranches(@CurrentUser() u: any) {
    return this.service.getBranches(u.tenantId);
  }

  @Post('branches')
  createBranch(@Body() dto: CreateBranchDto, @CurrentUser() u: any) {
    return this.service.createBranch(u.tenantId, dto, u.id);
  }

  @Put('branches/:id')
  updateBranch(@Param('id') id: string, @Body() dto: UpdateBranchDto, @CurrentUser() u: any) {
    return this.service.updateBranch(u.tenantId, id, dto, u.id);
  }

  @Delete('branches/:id')
  deleteBranch(@Param('id') id: string, @CurrentUser() u: any) {
    return this.service.deleteBranch(u.tenantId, id, u.id);
  }

  @Get('users')
  getUsers(@CurrentUser() u: any, @Query() filters: any) {
    return this.service.getUsers(u.tenantId, filters);
  }

  @Post('users/invite')
  inviteUser(@Body() dto: InviteUserDto, @CurrentUser() u: any) {
    return this.service.inviteUser(u.tenantId, dto, u.id);
  }

  @Put('users/:id/role')
  updateUserRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto, @CurrentUser() u: any) {
    return this.service.updateUserRole(u.tenantId, id, dto, u.id);
  }

  @Delete('users/:id')
  removeUser(@Param('id') id: string, @CurrentUser() u: any) {
    return this.service.removeUser(u.tenantId, id, u.id);
  }

  @Get('academics')
  getAcademicStructure(@CurrentUser() u: any) {
    return this.service.getAcademicStructure(u.tenantId);
  }

  @Post('classes')
  createClass(@Body() dto: CreateClassDto, @CurrentUser() u: any) {
    return this.service.createClass(u.tenantId, u.branchId!, dto, u.id);
  }

  @Post('sections')
  createSection(@Body() dto: CreateSectionDto, @CurrentUser() u: any) {
    return this.service.createSection(u.tenantId, u.branchId!, dto, u.id);
  }

  @Put('sections/:id')
  updateSection(@Param('id') id: string, @Body() dto: UpdateSectionDto, @CurrentUser() u: any) {
    return this.service.updateSection(u.tenantId, id, dto, u.id);
  }

  @Post('subjects')
  createSubject(@Body() dto: CreateSubjectDto, @CurrentUser() u: any) {
    return this.service.createSubject(u.tenantId, dto, u.id);
  }

  @Get('fee-setup')
  getFeeSetup(@CurrentUser() u: any) {
    return this.service.getFeeSetup(u.tenantId);
  }

  @Post('fee-types')
  createFeeType(@Body() dto: CreateFeeTypeDto, @CurrentUser() u: any) {
    return this.service.createFeeType(u.tenantId, dto, u.id);
  }

  @Post('fee-structures')
  createFeeStructure(@Body() dto: CreateFeeStructureDto, @CurrentUser() u: any) {
    return this.service.createFeeStructure(u.tenantId, dto, u.id);
  }

  @Delete('fee-structures/:id')
  deleteFeeStructure(@Param('id') id: string, @CurrentUser() u: any) {
    return this.service.deleteFeeStructure(u.tenantId, id, u.id);
  }

  @Get('transport')
  getTransportSetup(@CurrentUser() u: any) {
    return this.service.getTransportSetup(u.tenantId);
  }

  @Post('transport/routes')
  createRoute(@Body() dto: CreateRouteDto, @CurrentUser() u: any) {
    return this.service.createRoute(u.tenantId, dto, u.id);
  }

  @Post('transport/vehicles')
  createVehicle(@Body() dto: CreateVehicleDto, @CurrentUser() u: any) {
    return this.service.createVehicle(u.tenantId, dto, u.id);
  }

  @Get('branding')
  getBranding(@CurrentUser() u: any) {
    return this.service.getBranding(u.tenantId);
  }

  @Put('branding')
  updateBranding(@Body() dto: UpdateBrandingDto, @CurrentUser() u: any) {
    return this.service.updateBranding(u.tenantId, dto, u.id);
  }

  @Get('security')
  getSecuritySettings(@CurrentUser() u: any) {
    return this.service.getSecuritySettings(u.tenantId);
  }

  @Put('security')
  updateSecuritySettings(@Body() dto: UpdateSecuritySettingsDto, @CurrentUser() u: any) {
    return this.service.updateSecuritySettings(u.tenantId, dto, u.id);
  }

  @Get('overview')
  getOverview(@CurrentUser() u: any) {
    return this.service.getOverview(u.tenantId);
  }
}
