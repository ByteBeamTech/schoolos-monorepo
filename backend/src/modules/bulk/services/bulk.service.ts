// /apps/schoolos/backend/src/modules/bulk/services/bulk.service.ts
import { PrismaService } from '@infra/database/prisma.service';
import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InvoiceService } from '../../student-billing/invoice/services/invoice.service';
import { ClsService } from 'nestjs-cls'; // 🟢 FIX #1: Injected AsyncLocalStorage for implicit context propagation
import { BulkInvoiceDto } from '../dto/bulk.dto';
import * as _ from 'lodash';
import pLimit from 'p-limit';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';

import { 
  BulkStudentRow, 
  ValidatedStudentData, 
  AdvisoryLockResult, 
  IndexVerificationResult,
  BulkImportError,
  BulkImportErrorType,
  BulkImportStatus,
  BulkTelemetrySnapshot,
  BulkInvoiceError,
  BulkInvoiceErrorType,
  TimeoutError
} from '../dto/bulk-student.contracts';

@Injectable()
export class BulkService implements OnModuleInit {
  private readonly logger = new Logger(BulkService.name);

  private readonly BATCH_CHUNK_SIZE = 500;
  private readonly MAX_ROWS = 5000; 
  private readonly MAX_EXECUTION_MS = 180000;

  private hasUniqueIndex = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoiceService,
    private readonly cls: ClsService, // 🟢 Implicit Context Storage instance initialized
  ) {}

  async onModuleInit() {
    try {
      const res = await this.prisma.$queryRawUnsafe<IndexVerificationResult[]>(`
        SELECT indexname FROM pg_indexes WHERE tablename = 'Student' AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%tenantId%' AND indexdef LIKE '%admissionNumber%'
      `);
      this.hasUniqueIndex = res.length > 0;
    } catch (e) {
      const err = e as Error;
      this.logger.error(`Bootstrap Schema Verification Failed: ${err.message}`);
    }
  }

  private normalizeIdentifier(v: string): string {
    if (!v) return '';
    return v.toString().normalize('NFKC').trim().toUpperCase(); 
  }

  // =========================================================================
  // 📥 INSTITUTIONAL POLICY IMPORT ENGINE (CONTEXT DRIVEN VIA ALS)
  // =========================================================================

  async importStudents(
    tenantId: string,
    rows: BulkStudentRow[],
  ) {
    const startTime = Date.now();
    
    // 🟢 FIX #1 & #10: Context abstraction. Pulling requested scoped correlationId implicitly if initialized by kernel middleware
    const correlationId = this.cls.get('correlationId') || `trace-bulk-import-${tenantId}-${startTime}`;
    this.cls.set('correlationId', correlationId); // Anchor context for child threads executions

    if (!this.hasUniqueIndex) {
      throw new Error('System Index Deficit: Relational unique constraint locks unverified.');
    }

    if (!Array.isArray(rows) || rows.length > this.MAX_ROWS) {
      throw new BadRequestException(`Payload density breach. Ingestion ceiling is strictly enforced at ${this.MAX_ROWS} records.`);
    }

    const lockKey = `import:student:${tenantId}`;
    const hash = crypto.createHash('sha256').update(lockKey).digest();
    const lockHash = hash.readBigInt64BE(0);

    const lockAcquired = await this.prisma.$queryRawUnsafe<AdvisoryLockResult[]>(
      `SELECT pg_try_advisory_lock($1) as acquired`,
      lockHash,
    );

    if (!lockAcquired?.[0]?.acquired) {
      throw new BadRequestException('Workspace Collision: Ingestion lock rejected allocation vectors.');
    }

    try {
      const results = {
        created: 0,
        skipped: 0,
        errors: [] as BulkImportError[],
        totalErrors: 0,
        errorOverflowCount: 0,
        yieldsCount: 0,
      };

      const structuralSections = await this.prisma.section.findMany({
        where: { tenantId },
        select: { id: true, classId: true }
      });

      const sectionToClassMap = new Map<string, string>(
        structuralSections.map(s => [s.id, s.classId])
      );

      const validRows: {
        data: ValidatedStudentData;
        index: number;
      }[] = [];

      const seenInFile = new Set<string>();

      for (const [i, row] of rows.entries()) {
        if (!row || !row.firstName || typeof row.firstName !== 'string' || !row.admissionNumber || !row.classId) {
          results.totalErrors++;
          if (results.errors.length < 500) {
            results.errors.push({
              row: i + 1,
              code: BulkImportErrorType.VALIDATION_ERROR,
              message: 'Format Mismatch: Missing core identification or structural properties strings context.',
              correlationId,
            });
          } else {
            results.errorOverflowCount++;
          }
          results.skipped++;
          continue;
        }

        const admissionNumber = this.normalizeIdentifier(row.admissionNumber.toString());
        const firstName = row.firstName.toString().normalize('NFKC').trim(); 
        const classId = row.classId.toString().trim();
        const sectionId = row.sectionId?.toString().trim() || null;

        if (!firstName || !admissionNumber || !row.branchId) {
          results.totalErrors++;
          if (results.errors.length < 500) {
            results.errors.push({
              row: i + 1,
              code: BulkImportErrorType.VALIDATION_ERROR,
              message: 'Context Deficit: Empty string name parameters or tracking campus location properties missing.',
              correlationId,
            });
          } else {
            results.errorOverflowCount++;
          }
          results.skipped++;
          continue;
        }

        if (sectionId) {
          const registeredClassParentId = sectionToClassMap.get(sectionId);
          if (!registeredClassParentId) {
            results.totalErrors++;
            if (results.errors.length < 500) {
              results.errors.push({
                row: i + 1,
                code: BulkImportErrorType.HIERARCHY_VIOLATION,
                message: `Topological Deficit: Target Section identifier [${sectionId}] matches zero configurations.`,
                correlationId,
              });
            } else {
              results.errorOverflowCount++;
            }
            results.skipped++;
            continue;
          }
          if (registeredClassParentId !== classId) {
            results.totalErrors++;
            if (results.errors.length < 500) {
              results.errors.push({
                row: i + 1,
                code: BulkImportErrorType.HIERARCHY_VIOLATION,
                message: `Hierarchy Mismatch: Section [${sectionId}] belongs to Class [${registeredClassParentId}], input row requested Class [${classId}].`,
                correlationId,
              });
            } else {
              results.errorOverflowCount++;
            }
            results.skipped++;
            continue;
          }
        }

        if (seenInFile.has(admissionNumber)) {
          results.skipped++;
          continue;
        }
        seenInFile.add(admissionNumber);

        validRows.push({
          data: {
            firstName,
            lastName: row.lastName?.toString()?.normalize('NFKC').trim() || null, 
            admissionNumber,
            branchId: row.branchId.toString().trim(),
            classId,
            academicYear: row.academicYear.toString().trim(),
            sectionId,
          },
          index: i + 1,
        });

        if (i > 0 && i % 500 === 0) {
          results.yieldsCount++;
          await new Promise((res) => setImmediate(res));
        }

        if (Date.now() - startTime > this.MAX_EXECUTION_MS) {
          throw new BadRequestException('Transaction Expired: Processing limit window elapsed.');
        }
      }

      if (validRows.length > 0) {
        const allAdmNums = validRows.map((r) => r.data.admissionNumber);
        const existingSet = new Set<string>();

        for (const chunk of _.chunk(allAdmNums, 1000)) {
          const existing = await this.prisma.student.findMany({
            where: { tenantId, admissionNumber: { in: chunk } },
            select: { admissionNumber: true },
          });
          existing.forEach((e) => existingSet.add(e.admissionNumber));
        }

        const toCreate = validRows.filter((r) => !existingSet.has(r.data.admissionNumber));
        results.skipped += validRows.length - toCreate.length;

        for (const chunk of _.chunk(toCreate, this.BATCH_CHUNK_SIZE)) {
          await new Promise((res) => setImmediate(res));

          try {
            const { count } = await this.prisma.student.createMany({
              data: chunk.map((r) => ({
                tenantId,
                branchId:        r.data.branchId,
                classId:         r.data.classId, 
                firstName:       r.data.firstName,
                lastName:        r.data.lastName,
                admissionNumber: r.data.admissionNumber,
                academicYear:    r.data.academicYear,
                sectionId:       r.data.sectionId,
                isActive:        true,
              })),
              skipDuplicates: true,
            });
            results.created += count;
          } catch (err) {
            results.totalErrors++;
            const errorMsg = err instanceof Prisma.PrismaClientKnownRequestError
              ? `Prisma Client Write Invariant Violation: [${err.code}]`
              : err instanceof Error ? err.message : 'Unknown atomic mutations engine collision.';

            if (results.errors.length < 500) {
              results.errors.push({
                row: chunk[0].index,
                code: BulkImportErrorType.DATABASE_WRITE_VIOLATION,
                message: errorMsg,
                correlationId,
              });
            } else {
              results.errorOverflowCount++;
            }
          }
        }
      }

      // 🏎️ 🟢 STRUCTURED TELEMETRY CALCULATION PIPELINE (COMPLETED)
      const executionTimeMs = Date.now() - startTime;
      const totalProcessed = rows.length;
      
      // 🟢 FIX #7: Throughput metrics derived explicitly
      const executionTimeSeconds = executionTimeMs / 1000;
      const throughputPerSecond = executionTimeSeconds > 0 ? Math.round(totalProcessed / executionTimeSeconds) : totalProcessed;

      // 🟢 FIX #3: Derive definitive execution status metadata primitive
      let status: BulkImportStatus = 'SUCCESS';
      if (results.totalErrors > 0) {
        status = results.created > 0 ? 'PARTIAL_SUCCESS' : 'FAILED';
      }

      const errorDistributionMap: Partial<Record<BulkImportErrorType, number>> = {};
      results.errors.forEach(e => {
        errorDistributionMap[e.code] = (errorDistributionMap[e.code] || 0) + 1;
      });

      const telemetryMetricsReport: BulkTelemetrySnapshot = {
        correlationId,
        tenantId,
        operation: 'STUDENT_BULK_IMPORT',
        status,
        executionTimeMs,
        throughputPerSecond,
        performanceMetrics: {
          totalRecords:      totalProcessed,
          successfulCommits: results.created,
          failuresCount:     results.totalErrors,
          eventLoopYields:   results.yieldsCount,
          overflowCount:     results.errorOverflowCount
        },
        errorDistribution: errorDistributionMap
      };

      // 🟢 FIX #2: Machine-readable routing logs pattern applied to optimize ELK/OpenTelemetry scraping
      this.logger.log({
        event: 'BULK_IMPORT_COMPLETED', // Clear routing primitive token
        correlationId,
        tenantId,
        metrics: telemetryMetricsReport
      });

      return results;
    } finally {
      try {
        await this.prisma.$executeRawUnsafe(`SELECT pg_advisory_unlock($1)`, lockHash);
      } catch (e) {
        const lockErr = e as Error;
        this.logger.error({ event: 'LOCK_RELEASE_FAILED', correlationId, error: lockErr.message });
      }
    }
  }

  // ==========================================
  // 🧾 BULK INVOICE GENERATOR ORCHESTRATION
  // ==========================================

  async generateInvoicesForClass(
    tenantId: string,
    dto: BulkInvoiceDto,
    actorId: string,
  ) {
    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        isActive: true,
        section: { classId: dto.classId },
      },
      select: { id: true },
    });

    if (!students.length) {
      throw new BadRequestException('No active institutional student profiles match specified class parameter query.');
    }

    const results = { generated: 0, skipped: 0, errors: [] as BulkInvoiceError[], totalErrors: 0 };
    const limit = pLimit(10);
    const correlationId = this.cls.get('correlationId') || `trace-bulk-invoice-${tenantId}-${Date.now()}`;

    const resultsArr = await Promise.all(
      students.map((student) =>
        limit(async () => {
          for (let attempt = 0; attempt < 2; attempt++) {
            const controller = new AbortController();

            try {
              return await this.prisma.$transaction(
                async (tx) => {
                  const exists = await tx.invoice.findFirst({
                    where: { tenantId, studentId: student.id },
                    select: { id: true },
                  });

                  if (exists) return 'skipped';

                  await Promise.race([
                    this.invoices.generate(
                      tenantId,
                      {
                        studentId: student.id,
                        feePlanId: dto.feePlanId,
                        dueDate:   dto.dueDate,
                      },
                      actorId,
                    ),
                    new Promise((_, reject) =>
                      setTimeout(() => {
                        controller.abort();
                        reject(new TimeoutError(`Database operation sequence timeout ceiling hit for profile ID: ${student.id}`));
                      }, 12000),
                    ),
                  ]);

                  return 'generated';
                },
                { timeout: 15000 },
              );
            } catch (err) {
              const isDeadlock = err instanceof Error && err.message?.includes('deadlock');
              const isTimeout  = err instanceof TimeoutError || (err instanceof Error && err.message?.includes('timed out'));

              results.totalErrors++;
              if (results.errors.length < 500) {
                results.errors.push({
                  studentId: student.id,
                  code: isTimeout ? BulkInvoiceErrorType.TIMEOUT : isDeadlock ? BulkInvoiceErrorType.DEADLOCK : BulkInvoiceErrorType.BUSINESS_ERROR, 
                  message: err instanceof Error ? err.message : 'Fatal bookkeeping validation collision.',
                  correlationId, 
                });
              }
              return 'error';
            }
          }
        }),
      ),
    );

    results.generated = resultsArr.filter((r) => r === 'generated').length;
    results.skipped   = resultsArr.filter((r) => r === 'skipped').length;

    // Emit final invoicing telemetry routing log
    this.logger.log({
      event: 'BULK_INVOICE_GENERATION_COMPLETED',
      correlationId,
      tenantId,
      generatedCount: results.generated,
      failedCount: results.totalErrors
    });

    return results;
  }
}
