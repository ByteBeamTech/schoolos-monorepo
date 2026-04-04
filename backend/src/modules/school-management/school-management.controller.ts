import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SchoolManagementService } from './school-management.service';
import {
  UpdateSchoolProfileDto,
  CreateBranchDto, UpdateBranchDto,
  InviteUserDto, UpdateUserRoleDto,
  CreateClassDto, CreateSectionDto, UpdateSectionDto, CreateSubjectDto,
  CreateFeeTypeDto, CreateFeeStructureDto,
  CreateRouteDto, CreateVehicleDto,
  UpdateBrandingDto, UpdateSecuritySettingsDto,
} from './school-management.dto';
import { JwtGuard }          from '../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../core/roles/roles.guard';
import { Roles }             from '../../core/roles/roles.decorator';
import { CurrentUser }       from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/guards/jwt.strategy';

@ApiTags('school-management')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('school-management')
export class SchoolManagementController {
  constructor(private readonly service: SchoolManagementService) {}

  @Get('overview')  @ApiOperation({ summary: 'Overview stats' })
  getOverview(@CurrentUser() u: AuthenticatedUser) { return this.service.getOverview(u.tenantId); }

  // 1. Profile
  @Get('profile')   @ApiOperation({ summary: 'Get school profile' })
  getProfile(@CurrentUser() u: AuthenticatedUser) { return this.service.getProfile(u.tenantId); }

  @Patch('profile') @Roles('SCHOOL_ADMIN', 'PRINCIPAL') @ApiOperation({ summary: 'Update school profile' })
  updateProfile(@Body() dto: UpdateSchoolProfileDto, @CurrentUser() u: AuthenticatedUser) { return this.service.updateProfile(u.tenantId, dto, u.id); }

  // 2. Branches
  @Get('branches')  @ApiOperation({ summary: 'List branches' })
  getBranches(@CurrentUser() u: AuthenticatedUser) { return this.service.getBranches(u.tenantId); }

  @Post('branches') @Roles('SCHOOL_ADMIN') @ApiOperation({ summary: 'Create branch' })
  createBranch(@Body() dto: CreateBranchDto, @CurrentUser() u: AuthenticatedUser) { return this.service.createBranch(u.tenantId, dto, u.id); }

  @Patch('branches/:id') @Roles('SCHOOL_ADMIN') @ApiOperation({ summary: 'Update branch' })
  updateBranch(@Param('id') id: string, @Body() dto: UpdateBranchDto, @CurrentUser() u: AuthenticatedUser) { return this.service.updateBranch(u.tenantId, id, dto, u.id); }

  @Delete('branches/:id') @Roles('SCHOOL_ADMIN') @ApiOperation({ summary: 'Deactivate branch' })
  deleteBranch(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) { return this.service.deleteBranch(u.tenantId, id, u.id); }

  // 3. Users
  @Get('users') @Roles('SCHOOL_ADMIN', 'PRINCIPAL') @ApiOperation({ summary: 'List users' })
  @ApiQuery({ name: 'role', required: false }) @ApiQuery({ name: 'search', required: false })
  getUsers(@CurrentUser() u: AuthenticatedUser, @Query('role') role?: string, @Query('search') search?: string) {
    return this.service.getUsers(u.tenantId, { role, search });
  }

  @Post('users/invite') @Roles('SCHOOL_ADMIN') @ApiOperation({ summary: 'Invite user' })
  inviteUser(@Body() dto: InviteUserDto, @CurrentUser() u: AuthenticatedUser) { return this.service.inviteUser(u.tenantId, dto, u.id); }

  @Patch('users/:id/role') @Roles('SCHOOL_ADMIN') @ApiOperation({ summary: 'Update user role' })
  updateUserRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto, @CurrentUser() u: AuthenticatedUser) { return this.service.updateUserRole(u.tenantId, id, dto, u.id); }

  @Delete('users/:id') @Roles('SCHOOL_ADMIN') @ApiOperation({ summary: 'Remove user' })
  removeUser(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) { return this.service.removeUser(u.tenantId, id, u.id); }

  // 4. Academics
  @Get('academics') @ApiOperation({ summary: 'Get academic structure' })
  getAcademicStructure(@CurrentUser() u: AuthenticatedUser) { return this.service.getAcademicStructure(u.tenantId); }

  @Post('academics/classes') @Roles('SCHOOL_ADMIN', 'PRINCIPAL') @ApiOperation({ summary: 'Create class' })
  createClass(@Body() dto: CreateClassDto, @CurrentUser() u: AuthenticatedUser) { return this.service.createClass(u.tenantId, dto, u.id); }

  @Post('academics/sections') @Roles('SCHOOL_ADMIN', 'PRINCIPAL') @ApiOperation({ summary: 'Create section' })
  createSection(@Body() dto: CreateSectionDto, @CurrentUser() u: AuthenticatedUser) { return this.service.createSection(u.tenantId, dto, u.id); }

  @Patch('academics/sections/:id') @Roles('SCHOOL_ADMIN', 'PRINCIPAL') @ApiOperation({ summary: 'Update section' })
  updateSection(@Param('id') id: string, @Body() dto: UpdateSectionDto, @CurrentUser() u: AuthenticatedUser) { return this.service.updateSection(u.tenantId, id, dto, u.id); }

  @Post('academics/subjects') @Roles('SCHOOL_ADMIN', 'PRINCIPAL') @ApiOperation({ summary: 'Create subject' })
  createSubject(@Body() dto: CreateSubjectDto, @CurrentUser() u: AuthenticatedUser) { return this.service.createSubject(u.tenantId, dto, u.id); }

  // 5. Fees
  @Get('fees') @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT') @ApiOperation({ summary: 'Get fee setup' })
  getFeeSetup(@CurrentUser() u: AuthenticatedUser) { return this.service.getFeeSetup(u.tenantId); }

  @Post('fees/types') @Roles('SCHOOL_ADMIN', 'ACCOUNTANT') @ApiOperation({ summary: 'Create fee type' })
  createFeeType(@Body() dto: CreateFeeTypeDto, @CurrentUser() u: AuthenticatedUser) { return this.service.createFeeType(u.tenantId, dto, u.id); }

  @Post('fees/structures') @Roles('SCHOOL_ADMIN', 'ACCOUNTANT') @ApiOperation({ summary: 'Create fee structure' })
  createFeeStructure(@Body() dto: CreateFeeStructureDto, @CurrentUser() u: AuthenticatedUser) { return this.service.createFeeStructure(u.tenantId, dto, u.id); }

  @Delete('fees/structures/:id') @Roles('SCHOOL_ADMIN', 'ACCOUNTANT') @ApiOperation({ summary: 'Delete fee structure' })
  deleteFeeStructure(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) { return this.service.deleteFeeStructure(u.tenantId, id, u.id); }

  // 6. Transport
  @Get('transport') @ApiOperation({ summary: 'Get transport setup' })
  getTransportSetup(@CurrentUser() u: AuthenticatedUser) { return this.service.getTransportSetup(u.tenantId); }

  @Post('transport/routes') @Roles('SCHOOL_ADMIN') @ApiOperation({ summary: 'Create route' })
  createRoute(@Body() dto: CreateRouteDto, @CurrentUser() u: AuthenticatedUser) { return this.service.createRoute(u.tenantId, dto, u.id); }

  @Post('transport/vehicles') @Roles('SCHOOL_ADMIN') @ApiOperation({ summary: 'Register vehicle' })
  createVehicle(@Body() dto: CreateVehicleDto, @CurrentUser() u: AuthenticatedUser) { return this.service.createVehicle(u.tenantId, dto, u.id); }

  // 7. Branding
  @Get('branding')   @ApiOperation({ summary: 'Get branding' })
  getBranding(@CurrentUser() u: AuthenticatedUser) { return this.service.getBranding(u.tenantId); }

  @Patch('branding') @Roles('SCHOOL_ADMIN') @ApiOperation({ summary: 'Update branding' })
  updateBranding(@Body() dto: UpdateBrandingDto, @CurrentUser() u: AuthenticatedUser) { return this.service.updateBranding(u.tenantId, dto, u.id); }

  // 8. Security
  @Get('security')   @Roles('SCHOOL_ADMIN') @ApiOperation({ summary: 'Get security settings' })
  getSecuritySettings(@CurrentUser() u: AuthenticatedUser) { return this.service.getSecuritySettings(u.tenantId); }

  @Patch('security') @Roles('SCHOOL_ADMIN') @ApiOperation({ summary: 'Update security settings' })
  updateSecuritySettings(@Body() dto: UpdateSecuritySettingsDto, @CurrentUser() u: AuthenticatedUser) { return this.service.updateSecuritySettings(u.tenantId, dto, u.id); }
}
