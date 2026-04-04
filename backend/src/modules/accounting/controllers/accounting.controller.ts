import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Res }  from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AccountingService } from '../services/accounting.service';
import { CreateExpenseDto, CreateVendorDto } from '../dto/accounting.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('accounting')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly svc: AccountingService) {}

  @Get('stats')    stats(@CurrentUser() u: AuthenticatedUser)   { return this.svc.stats(u.tenantId); }
  @Get('vendors')  vendors(@CurrentUser() u: AuthenticatedUser) { return this.svc.listVendors(u.tenantId); }

  @Get('expenses')
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate',   required: false })
  expenses(
    @CurrentUser() u: AuthenticatedUser,
    @Query('category') category?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate')   toDate?:   string,
  ) { return this.svc.listExpenses(u.tenantId, { category, fromDate, toDate }); }

  @Post('expenses')
  @Roles('SCHOOL_ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  createExpense(@Body() dto: CreateExpenseDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.createExpense(u.tenantId, dto, u.id);
  }

  @Patch('expenses/:id/approve')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  approve(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.approveExpense(u.tenantId, id, u.id);
  }

  @Post('vendors')
  @Roles('SCHOOL_ADMIN', 'ACCOUNTANT')
  createVendor(@Body() dto: CreateVendorDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.createVendor(u.tenantId, dto);
  }

  @Get('export/tally')
  @Roles('SCHOOL_ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  @ApiOperation({ summary: 'Export expenses as Tally XML' })
  @ApiQuery({ name: 'fromDate', required: true })
  @ApiQuery({ name: 'toDate',   required: true })
  async tallyExport(
    @CurrentUser() u: AuthenticatedUser,
    @Query('fromDate') fromDate: string,
    @Query('toDate')   toDate:   string,
    @Res() res: Response,
  ) {
    const xml = await this.svc.tallyExport(u.tenantId, fromDate, toDate);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="tally-export-${fromDate}-${toDate}.xml"`);
    res.send(xml);
  }
}
