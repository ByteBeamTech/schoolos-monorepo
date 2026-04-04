import {
  Body, Controller, Get, HttpCode,
  HttpStatus, Param, Patch, Post,
  Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InvoiceService }    from '../services/invoice.service';
import { GenerateInvoiceDto, BulkGenerateInvoicesDto } from '../../dto/billing.dto';
import { JwtGuard }          from '../../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../../core/roles/roles.guard';
import { Roles }             from '../../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../core/auth/guards/jwt.strategy';

@ApiTags('invoices')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('billing/invoices')
export class InvoiceController {
  constructor(private readonly service: InvoiceService) {}

  @Post('generate')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Generate invoice for a student' })
  generate(@Body() dto: GenerateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.generate(user.tenantId, dto, user.id);
  }

  @Post('bulk-generate')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Bulk generate invoices for all students on fee plan' })
  bulkGenerate(@Body() dto: BulkGenerateInvoicesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.bulkGenerate(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'studentId',    required: false })
  @ApiQuery({ name: 'status',       required: false })
  @ApiQuery({ name: 'academicYear', required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('studentId')    studentId?:    string,
    @Query('status')       status?:       string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.service.findAll(user.tenantId, { studentId, status, academicYear });
  }

  @Get('overdue')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List overdue invoices' })
  findOverdue(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findOverdue(user.tenantId);
  }

  @Get('stats')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Billing stats' })
  @ApiQuery({ name: 'academicYear', required: false })
  getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.service.getStats(user.tenantId, academicYear);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findById(user.tenantId, id);
  }

  @Patch(':id/send')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send invoice (DRAFT → SENT)' })
  send(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.send(user.tenantId, id, user.id);
  }
}
