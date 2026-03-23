import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BulkService }       from '../services/bulk.service';
import { BulkInvoiceDto }    from '../dto/bulk.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('bulk')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Roles('SCHOOL_ADMIN', 'PRINCIPAL')
@Controller('bulk')
export class BulkController {
  constructor(private readonly svc: BulkService) {}

  @Post('students/import')
  @ApiOperation({ summary: 'Import students from CSV text' })
  importStudents(@Body('csv') csv: string, @CurrentUser() u: AuthenticatedUser) {
    const rows = this.svc.parseStudentCsv(csv);
    return this.svc.importStudents(u.tenantId, rows);
  }

  @Post('invoices/generate-for-class')
  @ApiOperation({ summary: 'Generate invoices for entire class' })
  generateInvoices(@Body() dto: BulkInvoiceDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.generateInvoicesForClass(u.tenantId, dto, u.id);
  }
}
