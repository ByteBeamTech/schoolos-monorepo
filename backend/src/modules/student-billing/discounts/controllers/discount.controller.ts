import { Controller, Get, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DiscountService }   from '../services/discount.service';
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
  constructor(private readonly service: DiscountService) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Create discount request' })
  create(@Body() dto: CreateDiscountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List discounts' })
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'approvalStatus', required: false })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('studentId') studentId?: string, @Query('approvalStatus') approvalStatus?: string) {
    return this.service.findAll(user.tenantId, { studentId, approvalStatus });
  }

  @Get('pending-approvals')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'List pending discount approvals' })
  getPending(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getPendingApprovals(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get discount by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findById(user.tenantId, id);
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
