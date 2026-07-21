import { Controller, Get, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DiscountService }   from '../services/discount.service';
import { StudentBillingAccessService } from '../../access/student-billing-access.service';
import { CreateDiscountDto, ApproveDiscountDto, RejectDiscountDto } from '../../dto/billing.dto';
import { JwtGuard }          from '../../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../../core/roles/roles.guard';
import { Roles }             from '../../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../core/auth/guards/jwt.strategy';

@ApiTags('discounts')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('billing/discounts')
export class DiscountController {
  constructor(
    private readonly service: DiscountService,
    private readonly access:  StudentBillingAccessService,
  ) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Create discount request' })
  create(@Body() dto: CreateDiscountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(user.tenantId, dto, user.id);
  }

  @Get()
  // FEE-0: was unguarded (AUTH-041 violation). Staff-only: discount records
  // include approval workflow detail (requester/approver identity, notes)
  // that ADR-FEE-001 §7 classifies staff-only, so PARENT gets no raw-row
  // access here regardless of FEE-4 -- parents will see approved discount
  // AMOUNTS via the Student Financial Account projection (AUTH-021).
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List discounts' })
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'approvalStatus', required: false })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('studentId') studentId?: string, @Query('approvalStatus') approvalStatus?: string) {
    return this.service.findAll(
      user.tenantId,
      { studentId, approvalStatus },
      this.access.resolveAuthorizedBranchIds(user),
    );
  }

  @Get('pending-approvals')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'List pending discount approvals' })
  getPending(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getPendingApprovals(user.tenantId);
  }

  @Get(':id')
  // FEE-0: was unguarded. Staff-only + branch-scoped (see findAll note).
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get discount by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findById(user.tenantId, id, this.access.resolveAuthorizedBranchIds(user));
  }

  @Post(':id/approve')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve discount' })
  approve(@Param('id') id: string, @Body() dto: ApproveDiscountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.approve(user.tenantId, id, dto, user.id);
  }

  @Post(':id/reject')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject discount' })
  reject(@Param('id') id: string, @Body() dto: RejectDiscountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.reject(user.tenantId, id, dto, user.id);
  }
}
