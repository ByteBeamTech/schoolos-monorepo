import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, NotFoundException, Res }  from '@nestjs/common';
import { Response } from 'express';
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

  @Get('payslips/:id/pdf')
  async downloadPayslip(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const entry = await this.svc.getPayslip(u.tenantId, id);
    if (!entry) throw new NotFoundException('Payslip not found');
    const money = (value: unknown) => Number(value).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    });
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${entry.month}/${entry.year}</title>
      <style>body{font-family:Arial,sans-serif;color:#172033;padding:40px;max-width:760px;margin:auto}
      h1{margin-bottom:4px}p{color:#64748b}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e2e8f0}
      .total{font-size:20px;font-weight:700;border-top:2px solid #172033;margin-top:16px;padding-top:14px}</style></head>
      <body><h1>Employee Payslip</h1><p>Staff ID: ${entry.staffId} · Period: ${entry.month}/${entry.year}</p>
      <div class="row"><span>Basic salary</span><strong>${money(entry.basicPaid)}</strong></div>
      <div class="row"><span>HRA</span><strong>${money(entry.hraPaid)}</strong></div>
      <div class="row"><span>DA</span><strong>${money(entry.daPaid)}</strong></div>
      <div class="row"><span>TA</span><strong>${money(entry.taPaid)}</strong></div>
      <div class="row"><span>Other allowances</span><strong>${money(entry.otherAllowances)}</strong></div>
      <div class="row"><span>Gross salary</span><strong>${money(entry.grossSalary)}</strong></div>
      <div class="row"><span>Deductions</span><strong>${money(Number(entry.pfDeduction) + Number(entry.esiDeduction) + Number(entry.tdsDeduction) + Number(entry.otherDeductions))}</strong></div>
      <div class="row total"><span>Net salary</span><strong>${money(entry.netSalary)}</strong></div>
      <p>Status: ${entry.status}</p></body></html>`;
    res.set({ 'Content-Type': 'text/html', 'Content-Disposition': `attachment; filename="payslip-${id}.html"` });
    res.send(html);
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
