// backend/src/modules/student-billing/invoice/controllers/invoice.controller.ts
// FULL REPLACEMENT
// NEW ROUTES: cancel, defaulters, pagination on findAll

import {
  Body, Controller, Get, HttpCode,
  HttpStatus, Param, Patch, Post,
  Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InvoiceService }    from '../services/invoice.service';
import { StudentBillingAccessService } from '../../access/student-billing-access.service';
import { GenerateInvoiceDto, BulkGenerateInvoicesDto } from '../../dto/billing.dto';
import { JwtGuard }          from '../../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../../core/roles/roles.guard';
import { Roles }             from '../../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../core/auth/guards/jwt.strategy';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty }       from '@nestjs/swagger';

class CancelInvoiceDto {
  @ApiProperty() @IsString() @IsNotEmpty() reason!: string;
}

@ApiTags('invoices')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('billing/invoices')
export class InvoiceController {
  constructor(
    private readonly service: InvoiceService,
    private readonly access:  StudentBillingAccessService,
  ) {}

  @Post('generate')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN','SCHOOL_OWNER', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Generate invoice for a student' })
  generate(@Body() dto: GenerateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.generate(user.tenantId, dto, user.id);
  }

  @Post('bulk-generate')
  @Roles('SUPER_ADMIN','SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Bulk generate invoices for all students on fee plan' })
  bulkGenerate(@Body() dto: BulkGenerateInvoicesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.bulkGenerate(user.tenantId, dto, user.id);
  }

  @Get()
  // FEE-0: was unguarded (RolesGuard allows through when no @Roles present —
  // AUTH-041 violation). Staff-only; PARENT access to invoice history is
  // deferred to the Student Financial Account projection (FEE-4 / AUTH-021)
  // by explicit decision.
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List invoices (paginated)' })
  @ApiQuery({ name: 'studentId',    required: false })
  @ApiQuery({ name: 'status',       required: false })
  @ApiQuery({ name: 'academicYear', required: false })
  @ApiQuery({ name: 'page',         required: false })
  @ApiQuery({ name: 'limit',        required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('studentId')    studentId?:    string,
    @Query('status')       status?:       string,
    @Query('academicYear') academicYear?: string,
    @Query('page')         page?:         string,
    @Query('limit')        limit?:        string,
  ) {
    return this.service.findAll(
      user.tenantId,
      { studentId, status, academicYear },
      page  ? parseInt(page)  : 1,
      limit ? parseInt(limit) : 20,
      this.access.resolveAuthorizedBranchIds(user),
    );
  }

  @Get('overdue')
  @Roles('SUPER_ADMIN','SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List overdue invoices' })
  findOverdue(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findOverdue(user.tenantId, this.access.resolveAuthorizedBranchIds(user));
  }

  @Get('defaulters')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN','SCHOOL_OWNER', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Defaulters list aggregated by student' })
  @ApiQuery({ name: 'branchId',       required: false })
  @ApiQuery({ name: 'classId',        required: false })
  @ApiQuery({ name: 'minDaysOverdue', required: false })
  getDefaulters(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId')       branchId?:       string,
    @Query('classId')        classId?:        string,
    @Query('minDaysOverdue') minDaysOverdue?: string,
  ) {
    return this.service.getDefaulters(user.tenantId, {
      branchId,
      classId,
      minDaysOverdue: minDaysOverdue ? parseInt(minDaysOverdue) : undefined,
    }, this.access.resolveAuthorizedBranchIds(user));
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Billing stats' })
  @ApiQuery({ name: 'academicYear', required: false })
  getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.service.getStats(user.tenantId, academicYear, this.access.resolveAuthorizedBranchIds(user));
  }

  @Get(':id')
  // FEE-0: was unguarded. Staff-only + branch-scoped; PARENT deferred to
  // FEE-4 (see findAll note). Out-of-branch IDs read as 404.
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get invoice by ID (full detail)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findById(user.tenantId, id, this.access.resolveAuthorizedBranchIds(user));
  }

  @Patch(':id/send')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN','SCHOOL_OWNER',  'PRINCIPAL', 'ACCOUNTANT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send invoice (DRAFT → SENT)' })
  send(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.send(user.tenantId, id, user.id);
  }

  @Patch(':id/cancel')
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel invoice (reason required, cannot cancel paid)' })
  cancel(
    @Param('id')   id:   string,
    @Body()        dto:  CancelInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancel(user.tenantId, id, dto.reason, user.id);
  }
}
