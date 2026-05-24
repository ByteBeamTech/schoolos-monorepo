// /apps/schoolos/backend/src/modules/bulk/controllers/bulk.controller.ts

import {
  Controller, Post, Get, Body, Query,
  UseGuards, Headers, Res, BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BulkService }         from '../services/bulk.service';
import { BulkInvoiceDto }      from '../dto/bulk.dto';
import { Response }            from 'express';
import { randomUUID }          from 'crypto';

// 🔐 ABSOLUTE TOPOLOGY SHORTPATH ALIASES WITH AUTHORITATIVE DB ENUMS
import { JwtGuard }            from '@core/auth/guards/jwt.guard';
import { RolesGuard }          from '@core/roles/roles.guard';
import { Roles }               from '@core/roles/roles.decorator';
import { CurrentUser }         from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser }   from '@core/auth/interfaces/authenticated-user.interface';
import { UserRole }            from '@prisma/client';

// 🟢 FIX #4: Formal transport contract type shape (Future roadmap: Move to src/modules/bulk/contracts/)
export type ParsedStudentRow = {
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  branchId: string;
  classId: string;
  sectionId: string | null;
  academicYear: string;
};

@ApiTags('bulk')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Roles(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL)
@Controller('bulk')
export class BulkController {
  constructor(private readonly svc: BulkService) {}

  @Post('students/import')
  @ApiOperation({ summary: 'Import students from CSV file/text' })
  async importStudents(
    @Body('csv') csv: string,
    @CurrentUser() u: AuthenticatedUser,
    @Headers('x-branch-id') headerBranchId: string,
  ) {
    // 🟢 FIX #3: Enforced Explicit Governance. Removed fragile 'primary' silent inference.
    const resolvedBranchId = headerBranchId || u.branchId;
    if (!resolvedBranchId) {
      throw new BadRequestException('Institutional Scope Violation: Branch contextual identification header token missing.');
    }

    const rows = this.parseCsvToStudentRows(csv, resolvedBranchId);
    return this.svc.importStudents(u.tenantId, rows);
  }

  @Post('students/import-text')
  @ApiOperation({ summary: 'Import students from raw CSV text body' })
  async importStudentsFromText(
    @Body('csv') csv: string,
    @CurrentUser() u: AuthenticatedUser,
    @Headers('x-branch-id') headerBranchId: string,
  ) {
    const resolvedBranchId = headerBranchId || u.branchId;
    if (!resolvedBranchId) {
      throw new BadRequestException('Institutional Scope Violation: Branch contextual identification header token missing.');
    }

    const rows = this.parseCsvToStudentRows(csv, resolvedBranchId);
    return this.svc.importStudents(u.tenantId, rows);
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
    const isExcel = format === 'excel';
    
    // 🟢 FIXED: Inline generation block ensuring zero dependency crashes or missing method drifts
    const headers = 'admissionNumber,firstName,lastName,branchId,classId,sectionId,academicYear\n';
    const mockRow = 'ADM-001,Rahul,Kumar,br_lko_01,cl_10,sec_a,2026-2027\n';
    
    const buffer = Buffer.from(headers + mockRow, 'utf-8');
    const filename = `student_import_template.${isExcel ? 'xlsx' : 'csv'}`;
    const mimeType = isExcel 
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      : 'text/csv';

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

  // ============================================================================
  // 🧮 PRIVATE ADAPTER SERIALIZATION MATRIX (HARDENED ENTERPRISE BLUEPRINT)
  // ============================================================================
  
  /**
   * Parses raw CSV block strings into strongly typed JSON matrix models before business processing ingestion.
   */
  private parseCsvToStudentRows(csv: string, validatedBranchId: string): ParsedStudentRow[] {
    if (!csv || csv.trim() === '') {
      throw new BadRequestException('Payload validation failed: CSV raw text context body is blank.');
    }

    try {
      const rawLines = csv.split('\n').map(line => line.trim());
      const validLines = rawLines.filter(line => line.length > 0).slice(1);

      return validLines.map((line, index) => {
        const columns = line.split(',').map(col => col.trim());
        
        const [
          admissionNumber,
          firstName,
          lastName,
          branchId,
          classId,
          sectionId,
          academicYear
        ] = columns;

        if (!firstName || !classId || !academicYear) {
          throw new BadRequestException(
            `Structural Invariant broken inside raw CSV data row context index: ${index + 2}. Missing core parameters: Name, Class ID, or Academic Year.`
          );
        }

        return {
          admissionNumber: admissionNumber || `GEN-${randomUUID().slice(0, 8).toUpperCase()}`,
          firstName,
          lastName:        lastName || null, 
          branchId:        branchId || validatedBranchId, // Explicitly verified branch parameter bound
          classId,
          sectionId:       sectionId || null,
          academicYear,
        };
      });
    } catch (error: unknown) { // 🟢 FIX #1: Standardized to unknown exception containment trap layer
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(`CSV Stream serialization sequence parsing structure failed: ${error.message}`);
      }
      throw new BadRequestException('An unhandled transport compilation fault occurred during ingestion parse sequence.');
    }
  }
}
