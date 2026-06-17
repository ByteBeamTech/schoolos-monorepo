// /apps/schoolos/backend/src/modules/school-management/school-management.controller.ts

import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { UserRole }                   from '@prisma/client';
import { SchoolManagementService }    from './school-management.service';
import { JwtGuard }                   from '@core/auth/guards/jwt.guard';
import { RolesGuard }                 from '@core/roles/roles.guard';
import { Roles }                      from '@core/roles/roles.decorator';
import { CurrentUser }                from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser }          from '@core/auth/interfaces/authenticated-user.interface';
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
  CreateRouteDto,
  CreateVehicleDto,
  UpdateBrandingDto,
  UpdateSecuritySettingsDto,
  GetUsersFilterDto,
} from './school-management.dto';

// ── Role sets ────────────────────────────────────────────────────────────────
// Defined as readonly UserRole[] so TypeScript enforces valid enum values.
// The spread into @Roles() still works because Roles() accepts ...string[]
// and UserRole values are string-backed at runtime.

/** Principals and above — broadest read access */
const ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SCHOOL_ADMIN,
  UserRole.PRINCIPAL,
  UserRole.SCHOOL_OWNER,
];

/** Owner or designated admin — write access to school-wide config */
const OWNER_ADMIN: readonly UserRole[] = [
  UserRole.SCHOOL_ADMIN,
  UserRole.SCHOOL_OWNER,
];

// ── Branch scope helper ───────────────────────────────────────────────────────
/**
 * Extracts branchId from the authenticated token, throwing 400 if absent.
 * Centralised here temporarily; move to @core/auth/utils/require-branch.util.ts
 * once a second module needs it.
 */
function requireBranch(u: AuthenticatedUser): string {
  if (!u.branchId) {
    throw new BadRequestException(
      'Branch context is missing from your token. ' +
      'Please log in with a branch-scoped session.',
    );
  }
  return u.branchId;
}

// ── Controller ────────────────────────────────────────────────────────────────
@Controller('school-management')
@UseGuards(JwtGuard, RolesGuard)
export class SchoolManagementController {
  constructor(private readonly service: SchoolManagementService) {}

  // ── 1. Profile ──────────────────────────────────────────────────────────────

  @Get('overview')
  @Roles(...ADMIN_ROLES)
  getOverview(@CurrentUser() u: AuthenticatedUser) {
	 const branchId = requireBranch(u);
    return this.service.getOverview(u.tenantId, branchId);
  }

  @Get('profile')
  @Roles(...ADMIN_ROLES)
  getProfile(@CurrentUser() u: AuthenticatedUser) {
    return this.service.getProfile(u.tenantId);
  }

  @Put('profile')
  @Roles(...OWNER_ADMIN)
  updateProfile(
    @Body() dto: UpdateSchoolProfileDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.updateProfile(u.tenantId, dto, u.id);
  }

  // ── 2. Branches ─────────────────────────────────────────────────────────────

  @Get('branches')
  @Roles(...ADMIN_ROLES)
  getBranches(@CurrentUser() u: AuthenticatedUser) {
    return this.service.getBranches(u.tenantId);
  }

  @Post('branches')
  @Roles(...OWNER_ADMIN)
  createBranch(
    @Body() dto: CreateBranchDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.createBranch(u.tenantId, dto, u.id);
  }

  @Put('branches/:id')
  @Roles(...OWNER_ADMIN)
  updateBranch(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.updateBranch(u.tenantId, id, dto, u.id);
  }

  @Delete('branches/:id')
  @Roles(...OWNER_ADMIN)
  deleteBranch(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.deleteBranch(u.tenantId, id, u.id);
  }

  // ── 3. Users ────────────────────────────────────────────────────────────────

  @Get('users')
  @Roles(
    UserRole.SCHOOL_ADMIN,
    UserRole.PRINCIPAL,
    UserRole.SCHOOL_OWNER,
    UserRole.HR_MANAGER,
  )
  getUsers(
    @CurrentUser() u: AuthenticatedUser,
    @Query() filters: GetUsersFilterDto,
  ) {
    return this.service.getUsers(u.tenantId, filters);
  }

  @Post('users/invite')
  @Roles(...OWNER_ADMIN)
  inviteUser(
    @Body() dto: InviteUserDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.inviteUser(u.tenantId, dto, u.id);
  }

  @Put('users/:id/role')
  @Roles(...OWNER_ADMIN)
  updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.updateUserRole(u.tenantId, id, dto, u.id);
  }

  @Delete('users/:id')
  @Roles(...OWNER_ADMIN)
  removeUser(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.removeUser(u.tenantId, id, u.id);
  }

  // ── 4. Academics ────────────────────────────────────────────────────────────


  @Get('academics')
@Roles(...ADMIN_ROLES)
getAcademicStructure(@CurrentUser() u: AuthenticatedUser) {
  const branchId = requireBranch(u);
  return this.service.getAcademicStructure(
    u.tenantId,
    branchId,
  );
}

  @Post('classes')
  @Roles(...ADMIN_ROLES)
  createClass(
    @Body() dto: CreateClassDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    const branchId = requireBranch(u);
    return this.service.createClass(u.tenantId, branchId, dto, u.id);
  }

  @Post('sections')
  @Roles(...ADMIN_ROLES)
  createSection(
    @Body() dto: CreateSectionDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    const branchId = requireBranch(u);
    return this.service.createSection(u.tenantId, branchId, dto, u.id);
  }



  @Put('sections/:id')
  @Roles(...ADMIN_ROLES)
  updateSection(
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
    @CurrentUser() u: AuthenticatedUser,
  ){
    const branchId = requireBranch(u);
    return this.service.updateSection(u.tenantId, branchId, id, dto, u.id);
  }

  @Post('subjects')
  @Roles(...ADMIN_ROLES)
  createSubject(
    @Body() dto: CreateSubjectDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.createSubject(u.tenantId, dto, u.id);
  }

  // ── 5. Fee Setup ────────────────────────────────────────────────────────────

  @Get('fee-setup')
  @Roles(
    UserRole.SCHOOL_ADMIN,
    UserRole.PRINCIPAL,
    UserRole.ACCOUNTANT,
    UserRole.SCHOOL_OWNER,
  )
  getFeeSetup(@CurrentUser() u: AuthenticatedUser) {
    return this.service.getFeeSetup(u.tenantId);
  }


  // ── 6. Transport ────────────────────────────────────────────────────────────

  @Get('transport')
  @Roles(
    UserRole.SCHOOL_ADMIN,
    UserRole.TRANSPORT_MANAGER,
    UserRole.PRINCIPAL,
    UserRole.SCHOOL_OWNER,
  )
  getTransportSetup(@CurrentUser() u: AuthenticatedUser) {
    return this.service.getTransportSetup(u.tenantId);
  }

  @Post('transport/routes')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.TRANSPORT_MANAGER, UserRole.SCHOOL_OWNER)
  createRoute(
    @Body() dto: CreateRouteDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.createRoute(u.tenantId, dto, u.id);
  }

  @Post('transport/vehicles')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.TRANSPORT_MANAGER, UserRole.SCHOOL_OWNER)
  createVehicle(
    @Body() dto: CreateVehicleDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.createVehicle(u.tenantId, dto, u.id);
  }

  // ── 7. Branding ─────────────────────────────────────────────────────────────

  @Get('branding')
  @Roles(...ADMIN_ROLES)
  getBranding(@CurrentUser() u: AuthenticatedUser) {
    return this.service.getBranding(u.tenantId);
  }

  @Put('branding')
  @Roles(...OWNER_ADMIN)
  updateBranding(
    @Body() dto: UpdateBrandingDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.updateBranding(u.tenantId, dto, u.id);
  }

  // ── 8. Security ─────────────────────────────────────────────────────────────

  @Get('security')
  @Roles(...OWNER_ADMIN)
  getSecuritySettings(@CurrentUser() u: AuthenticatedUser) {
    return this.service.getSecuritySettings(u.tenantId);
  }

  @Put('security')
  @Roles(...OWNER_ADMIN)
  updateSecuritySettings(
    @Body() dto: UpdateSecuritySettingsDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.updateSecuritySettings(u.tenantId, dto, u.id);
  }
}
