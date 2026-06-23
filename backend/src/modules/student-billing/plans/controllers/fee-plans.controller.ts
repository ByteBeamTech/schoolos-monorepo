import { Controller, Get, Post, Param, Body, Query, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FeePlansService }   from '../services/fee-plans.service';
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
  constructor(private readonly service: FeePlansService) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Create fee plan with items' })
  create(@Body() dto: CreateFeePlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(  user.tenantId,  user.branchId,  dto,  user.id,); 
  }

  @Get()
  @ApiOperation({ summary: 'List all fee plans' })
  @ApiQuery({ name: 'academicYear', required: false })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('academicYear') academicYear?: string) {
    return this.service.findAll(user.tenantId, user.branchId, academicYear);
  }

  @Get('student/:studentId')
  @ApiOperation({ summary: 'Get fee plans for a student' })
  getStudentFeePlans(@Param('studentId') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getStudentFeePlans(user.tenantId, studentId);
  }

  @Get('student/:studentId/summary')
  @ApiOperation({ summary: 'Get fee summary for student' })
  @ApiQuery({ name: 'academicYear', required: true })
  getStudentFeeSummary(
    @Param('studentId') studentId: string,
    @Query('academicYear') academicYear: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getStudentFeeSummary(user.tenantId, studentId, academicYear);
  }

  @Get(':id')
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
