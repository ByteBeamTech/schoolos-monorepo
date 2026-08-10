import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FeePlansService }   from '../services/fee-plans.service';
import { FeePlanAssignmentService } from '../services/fee-plan-assignment.service';
import { StudentBillingAccessService } from '../../access/student-billing-access.service';
import { CreateFeePlanDto, CreateFeePlanAssignmentDto, CreateFeeItemDto, SupersedeFeeItemDto } from '../../dto/billing.dto';
import { JwtGuard }          from '../../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../../core/roles/roles.guard';
import { Roles }             from '../../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../core/auth/guards/jwt.strategy';

@ApiTags('fee-plans')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('billing/fee-plans')
export class FeePlansController {
  constructor(
    private readonly service: FeePlansService,
    private readonly assignments: FeePlanAssignmentService,
    private readonly access:  StudentBillingAccessService,
  ) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Create fee plan with items' })
  create(@Body() dto: CreateFeePlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(  user.tenantId,  user.branchId,  dto,  user.id,); 
  }

  @Get()
  // FEE-0: was unguarded (AUTH-041 violation). Staff-only. Branch scoping is
  // unchanged: the existing user.branchId (default branch / x-branch-id
  // selection, validated by BranchContextMiddleware) is the canonical
  // mechanism per ADR-FEE-002 and was already applied here.
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List all fee plans' })
  @ApiQuery({ name: 'academicYear', required: false })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('academicYear') academicYear?: string) {
    return this.service.findAll(user.tenantId, user.branchId, academicYear);
  }

  @Get('student/:studentId')
  // FEE-0: was unguarded -- ANY authenticated user could read ANY student's
  // fee plans by guessing IDs (no role, no ownership, no branch check).
  // Staff-only + ownership/branch containment via assertCanAccessStudent
  // (AUTH-003 mechanics for parents live there too, but PARENT stays
  // ungranted until FEE-4 per explicit decision).
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get fee plans for a student' })
  async getStudentFeePlans(@Param('studentId') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanAccessStudent(user, studentId);
    return this.service.getStudentFeePlans(user.tenantId, studentId);
  }

  @Get('student/:studentId/summary')
  // FEE-0: was unguarded -- the audit's canonical example ("any authenticated
  // user can query any student's summary"). Same treatment as above.
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get fee summary for student (resolved against the tenant\'s current session -- Phase 3)' })
  async getStudentFeeSummary(
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.access.assertCanAccessStudent(user, studentId);
    return this.service.getStudentFeeSummary(user.tenantId, studentId);
  }

  @Post('assignments')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Assign a fee plan to a class or section (Phase 3: Class/Section scoped -- there is no student-level assignment)' })
  createAssignment(@Body() dto: CreateFeePlanAssignmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assignments.create(user.tenantId, user.branchId, dto, user.id);
  }

  @Get('assignments')
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List fee plan assignments' })
  @ApiQuery({ name: 'sessionId', required: false })
  findAllAssignments(@CurrentUser() user: AuthenticatedUser, @Query('sessionId') sessionId?: string) {
    return this.assignments.findAll(user.tenantId, user.branchId, sessionId);
  }

  @Get(':id')
  // FEE-0: was unguarded. Staff-only; existing branchId scoping unchanged.
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get fee plan by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
  return this.service.findById(  user.tenantId,  user.branchId,  id,);
  }

  @Post(':id/fee-items')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Create a fee item on an existing plan (Phase 2: its own explicit step, not inlined into plan creation)' })
  createFeeItem(@Param('id') id: string, @Body() dto: CreateFeeItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createFeeItem(user.tenantId, user.branchId, id, dto, user.id);
  }

  @Patch('fee-items/:id/supersede')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Supersede a fee item (create-new-not-edit -- never mutates the existing item)' })
  supersedeFeeItem(@Param('id') id: string, @Body() dto: SupersedeFeeItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.supersedeFeeItem(user.tenantId, user.branchId, id, dto, user.id);
  }
}
