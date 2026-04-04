import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PayrollService }    from '../services/payroll.service';
import { CreatePayrollStructureDto, GeneratePayslipDto } from '../dto/payroll.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('payroll')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly svc: PayrollService) {}

  @Get('structures')
  listStructures(@CurrentUser() u: AuthenticatedUser) { return this.svc.listStructures(u.tenantId); }

  @Post('structures')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  createStructure(@Body() dto: CreatePayrollStructureDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.createStructure(u.tenantId, dto, u.id);
  }

  @Get('payslips')
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year',  required: false })
  listPayslips(
    @CurrentUser() u: AuthenticatedUser,
    @Query('month') month?: string,
    @Query('year')  year?:  string,
  ) { return this.svc.listPayslips(u.tenantId, month ? +month : undefined, year ? +year : undefined); }

  @Post('payslips/generate')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  generate(@Body() dto: GeneratePayslipDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.generatePayslip(u.tenantId, dto, u.id);
  }

  @Patch('payslips/:id/approve')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  approve(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.approvePayslip(u.tenantId, id);
  }

  @Patch('payslips/:id/mark-paid')
  @Roles('SCHOOL_ADMIN', 'ACCOUNTANT')
  markPaid(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.markPaid(u.tenantId, id);
  }

  @Get('stats')
  @ApiQuery({ name: 'month', required: true })
  @ApiQuery({ name: 'year',  required: true })
  stats(
    @CurrentUser() u: AuthenticatedUser,
    @Query('month') month: string,
    @Query('year')  year:  string,
  ) { return this.svc.stats(u.tenantId, +month, +year); }
}
