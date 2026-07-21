import { Controller, Get, Post, Param, Body, Query, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FeePlansService }   from '../services/fee-plans.service';
import { StudentBillingAccessService } from '../../access/student-billing-access.service';
import { CreateFeePlanDto, AssignFeePlanDto } from '../../dto/billing.dto';
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
  @ApiOperation({ summary: 'Get fee summary for student' })
  @ApiQuery({ name: 'academicYear', required: true })
  async getStudentFeeSummary(
    @Param('studentId') studentId: string,
    @Query('academicYear') academicYear: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.access.assertCanAccessStudent(user, studentId);
    return this.service.getStudentFeeSummary(user.tenantId, studentId, academicYear);
  }

  @Get(':id')
  // FEE-0: was unguarded. Staff-only; existing branchId scoping unchanged.
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get fee plan by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
  return this.service.findById(  user.tenantId,  user.branchId,  id,);
  }

  @Post('assign')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Assign fee plan to student' })
  assign(@Body() dto: AssignFeePlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.assign(user.tenantId, dto, user.id);
  }
}
