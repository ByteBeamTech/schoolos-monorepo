import {
  Controller, Post, Get, Body, Query,
  UseGuards, Headers, Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BulkService }         from '../services/bulk.service';
import { BulkInvoiceDto }      from '../dto/bulk.dto';
import { JwtGuard }            from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }          from '../../../core/roles/roles.guard';
import { Roles }               from '../../../core/roles/roles.decorator';
import { CurrentUser }         from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser }   from '../../../core/auth/guards/jwt.strategy';
import { Response }            from 'express';

@ApiTags('bulk')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Roles('SCHOOL_ADMIN', 'PRINCIPAL')
@Controller('bulk')
export class BulkController {
  constructor(private readonly svc: BulkService) {}

  @Post('students/import')
  @ApiOperation({ summary: 'Import students from CSV file/text' })
  async importStudents(
    @Body('csv') csv: string,
    @CurrentUser() u: AuthenticatedUser,
    @Headers('x-branch-id') branchId: string,
  ) {
    const targetBranch = branchId || 'primary';
    const rows = this.svc.parseStudentCsv(csv, targetBranch);
    return this.svc.importStudents(u.tenantId, rows, targetBranch);
  }

  @Post('students/import-text')
  @ApiOperation({ summary: 'Import students from raw CSV text body' })
  async importStudentsFromText(
    @Body('csv') csv: string,
    @CurrentUser() u: AuthenticatedUser,
    @Headers('x-branch-id') branchId: string,
  ) {
    const targetBranch = branchId || 'primary';
    const rows = this.svc.parseStudentCsv(csv, targetBranch);
    return this.svc.importStudents(u.tenantId, rows, targetBranch);
  }

  @Post('invoices/generate-for-class')
  @ApiOperation({ summary: 'Generate invoices for entire class' })
  generateInvoices(@Body() dto: BulkInvoiceDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.generateInvoicesForClass(u.tenantId, dto, u.id);
  }

  @Get('templates/students')
  @ApiOperation({ summary: 'Download student import CSV template' })
  downloadStudentTemplate(
    @Query('format') format: 'csv' | 'excel' = 'csv',
    @Res() res: Response,
  ) {
    const { buffer, filename, mimeType } = this.svc.generateStudentTemplate(format);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('capabilities')
  @ApiOperation({ summary: 'Get bulk capabilities for tenant' })
  capabilities(@CurrentUser() u: AuthenticatedUser) {
    return {
      supportedEntities:   ['students', 'staff', 'fees'],
      maxBatchSize:        500,
      canImportStudents:   true,
      canGenerateInvoices: true,
      canAccessBulkPage:   true,
      features: { import: true, export: true, generate: true },
    };
  }

}
