import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma.service';
import { BulkInvoiceDto } from '../dto/bulk.dto';

export interface BulkStudentRow {
  firstName: string; lastName: string; admissionNumber: string;
  academicYear: string; sectionId?: string; rollNumber?: string;
}

@Injectable()
export class BulkService {
  private readonly logger = new Logger(BulkService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── CSV Student Import ────────────────────────────────────────────────────
  async importStudents(tenantId: string, rows: BulkStudentRow[]) {
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      if (!row.firstName || !row.lastName || !row.admissionNumber || !row.academicYear) {
        results.errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
        results.skipped++;
        continue;
      }

      const existing = await this.prisma.student.findFirst({
        where: { tenantId, admissionNumber: row.admissionNumber },
      });

      if (existing) {
        results.skipped++;
        continue;
      }

      try {
        await this.prisma.student.create({
          data: {
            tenantId,
            firstName:       row.firstName.trim(),
            lastName:        row.lastName.trim(),
            admissionNumber: row.admissionNumber.trim(),
            academicYear:    row.academicYear.trim(),
            sectionId:       row.sectionId   ?? null,
            rollNumber:      row.rollNumber  ?? null,
            isActive:        true,
          },
        });
        results.created++;
      } catch (err: any) {
        results.errors.push(`${row.admissionNumber}: ${err.message}`);
        results.skipped++;
      }
    }

    this.logger.log(`Bulk import: ${results.created} created, ${results.skipped} skipped`);
    return results;
  }

  // ── Bulk Invoice Generation ───────────────────────────────────────────────
  async generateInvoicesForClass(tenantId: string, dto: BulkInvoiceDto, _actorId: string) {
    const feePlan = await this.prisma.feePlan.findFirst({
      where:   { id: dto.feePlanId, tenantId },
      include: { feeItems: true },
    });
    if (!feePlan) throw new BadRequestException('Fee plan not found');

    const students = await this.prisma.student.findMany({
      where: { tenantId, isActive: true, section: { classId: dto.classId } },
    });

    const totalAmount = feePlan.feeItems.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const year        = new Date().getFullYear();
    let generated = 0;

    for (const student of students) {
      const existing = await this.prisma.invoice.findFirst({
        where: { tenantId, studentId: student.id } as any,
      });
      if (existing) continue;

      const count = await this.prisma.invoice.count({ where: { tenantId } });
      const invoiceNumber = `INV-${year}-${String(count + 1).padStart(5, '0')}`;

      await this.prisma.invoice.create({
        data: {
          tenantId,
          studentId:     student.id,
          feePlanId:     dto.feePlanId,
          academicYear:  dto.academicYear ?? feePlan.academicYear,
          invoiceNumber,
          status:        'SENT' as any,
          currency:      feePlan.currency as any,
          totalAmount,
          paidAmount:    0,
          dueAmount:     totalAmount,
          dueDate:       new Date(dto.dueDate),
          invoiceItems: {
            create: feePlan.feeItems.map((item: any) => ({
              name:   item.name,
              amount: Number(item.amount),
            })),
          },
        } as any,
      });
      generated++;
    }

    this.logger.log(`Bulk invoices: ${generated} generated for class ${dto.classId}`);
    return { generated, skipped: students.length - generated, total: students.length };
  }

  // ── Parse CSV ─────────────────────────────────────────────────────────────
  parseStudentCsv(csvText: string): BulkStudentRow[] {
    const lines  = csvText.trim().split('\n');
    if (lines.length < 2) throw new BadRequestException('CSV must have header + at least one row');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
    const rows: BulkStudentRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells: Record<string, string> = {};
      lines[i].split(',').forEach((val, j) => { cells[headers[j]] = val?.trim() ?? ''; });

      rows.push({
        firstName:       cells['firstname']       || cells['first_name']      || '',
        lastName:        cells['lastname']        || cells['last_name']       || '',
        admissionNumber: cells['admissionnumber'] || cells['admission_number']|| cells['admno'] || '',
        academicYear:    cells['academicyear']    || cells['academic_year']   || cells['year']  || '',
        sectionId:       cells['sectionid']       || cells['section_id']      || undefined,
        rollNumber:      cells['rollnumber']      || cells['roll_number']     || cells['roll']  || undefined,
      });
    }

    return rows;
  }
}
