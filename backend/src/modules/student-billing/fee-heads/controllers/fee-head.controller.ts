import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FeeHeadService } from '../services/fee-head.service';
import { CreateFeeHeadDto, UpdateFeeHeadDto } from '../../dto/billing.dto';
import { JwtGuard }          from '../../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../../core/roles/roles.guard';
import { Roles }             from '../../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../core/auth/guards/jwt.strategy';

@ApiTags('fee-heads')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('billing/fee-heads')
export class FeeHeadController {
  constructor(private readonly service: FeeHeadService) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Create a fee head' })
  create(@Body() dto: CreateFeeHeadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(user.tenantId, user.branchId, dto, user.id);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List fee heads' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.tenantId, user.branchId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get a fee head by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findById(user.tenantId, user.branchId, id);
  }

  @Patch(':id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Update a fee head' })
  update(@Param('id') id: string, @Body() dto: UpdateFeeHeadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(user.tenantId, user.branchId, id, dto, user.id);
  }
}
