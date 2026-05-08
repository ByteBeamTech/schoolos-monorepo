import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { InvoiceService } from '../../student-billing/invoice/services/invoice.service';
import { BulkInvoiceDto } from '../dto/bulk.dto';
import * as _ from 'lodash';
import pLimit from 'p-limit';
import * as crypto from 'crypto';

type GenerateInvoiceOptions = any;

@Injectable()
export class BulkService implements OnModuleInit {
  private readonly logger = new Logger(BulkService.name);

  private readonly BATCH_CHUNK_SIZE = 500;
  private readonly MAX_ROWS = 20000;
  private readonly MAX_EXECUTION_MS = 180000;

  private hasUniqueIndex = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoiceService,
  ) {}

  async onModuleInit() {
    try {
      const res = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'Student'
          AND indexdef LIKE '%UNIQUE%'
          AND indexdef LIKE '%tenantId%'
          AND indexdef LIKE '%admissionNumber%'
      `);

      this.hasUniqueIndex = res.length > 0;

      if (!this.hasUniqueIndex) {
        this.logger.error(
          'CRITICAL: Missing UNIQUE INDEX on Student(tenantId, admissionNumber)',
        );
      }
    } catch (e) {
      this.logger.error(
        'Failed to verify unique index',
      );
    }
  }

  private normalizeIdentifier(v: string): string {
    return v
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
  }

  // =========================
  // 📥 STUDENT IMPORT
  // =========================

  async importStudents(
    tenantId: string,
    rows: any[],
  ) {
    const startTime = Date.now();

    const correlationId =
      `bulk-import-${tenantId}-${startTime}`;

    if (!this.hasUniqueIndex) {
      throw new Error(
        'System Index Error: Missing Unique Index',
      );
    }

    if (
      !Array.isArray(rows) ||
      rows.length > this.MAX_ROWS
    ) {
      throw new BadRequestException(
        'Invalid file size',
      );
    }

    const lockKey = `import:student:${tenantId}`;

    const hash = crypto
      .createHash('sha256')
      .update(lockKey)
      .digest();

    const lockHash =
      hash.readBigInt64BE(0);

    const lockAcquired =
      await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT pg_try_advisory_lock($1) as acquired`,
        lockHash,
      );

    if (!lockAcquired?.[0]?.acquired) {
      throw new BadRequestException(
        'Another import is already in progress for this school',
      );
    }

    try {
      const results = {
        created: 0,
        skipped: 0,
        errors: [] as any[],
        totalErrors: 0,
      };

      const validRows: {
        data: any;
        index: number;
      }[] = [];

      const seenInFile =
        new Set<string>();

      for (const [i, row] of rows.entries()) {
        if (
          !row ||
          typeof row.firstName !== 'string' ||
          !row.admissionNumber
        ) {
          results.totalErrors++;

          if (results.errors.length < 500) {
            results.errors.push({
              row: i + 1,
              type: 'VALIDATION',
              msg: 'Invalid format',
            });
          }

          results.skipped++;
          continue;
        }

        const admissionNumber =
          this.normalizeIdentifier(
            row.admissionNumber.toString(),
          );

        const firstName =
          row.firstName.trim();

        if (
          !firstName ||
          !admissionNumber ||
          !row.branchId
        ) {
          results.totalErrors++;

          if (results.errors.length < 500) {
            results.errors.push({
              row: i + 1,
              type: 'VALIDATION',
              msg: 'Missing fields',
            });
          }

          results.skipped++;
          continue;
        }

        if (
          seenInFile.has(
            admissionNumber,
          )
        ) {
          results.skipped++;
          continue;
        }

        seenInFile.add(
          admissionNumber,
        );

        validRows.push({
          data: {
            ...row,
            firstName,
            admissionNumber,
            lastName:
              row.lastName
                ?.toString()
                ?.trim() || '',
          },
          index: i + 1,
        });

        if (i % 500 === 0) {
          await new Promise((res) =>
            setImmediate(res),
          );
        }

        if (
          Date.now() - startTime >
          this.MAX_EXECUTION_MS
        ) {
          throw new BadRequestException(
            'Import timeout',
          );
        }
      }

      if (!validRows.length) {
        return results;
      }

      const allAdmNums =
        validRows.map(
          (r) =>
            r.data.admissionNumber,
        );

      const existingSet =
        new Set<string>();

      for (const chunk of _.chunk(
        allAdmNums,
        1000,
      )) {
        const existing =
          await this.prisma.student.findMany({
            where: {
              tenantId,
              admissionNumber: {
                in: chunk,
              },
            },
            select: {
              admissionNumber: true,
            },
          });

        existing.forEach((e) =>
          existingSet.add(
            e.admissionNumber,
          ),
        );
      }

      const toCreate =
        validRows.filter(
          (r) =>
            !existingSet.has(
              r.data.admissionNumber,
            ),
        );

      results.skipped +=
        validRows.length -
        toCreate.length;

      for (const chunk of _.chunk(
        toCreate,
        this.BATCH_CHUNK_SIZE,
      )) {
        await new Promise((res) =>
          setImmediate(res),
        );

        try {
          const { count } =
            await this.prisma.student.createMany({
              data: chunk.map((r) => ({
                tenantId,
                branchId:
                  r.data.branchId,
                firstName:
                  r.data.firstName,
                lastName:
                  r.data.lastName,
                admissionNumber:
                  r.data.admissionNumber,
                academicYear:
                  r.data.academicYear
                    ?.toString()
                    ?.trim(),
                sectionId:
                  r.data.sectionId ??
                  null,
                isActive: true,
              })),
              skipDuplicates: true,
            });

          results.created += count;
        } catch (err: any) {
          results.totalErrors++;

          if (
            results.errors.length <
            500
          ) {
            results.errors.push({
              row: chunk[0].index,
              type: 'DB',
              msg: err.message,
            });
          }
        }
      }

      return results;
    } finally {
      try {
        await this.prisma.$executeRawUnsafe(
          `SELECT pg_advisory_unlock($1)`,
          lockHash,
        );
      } catch (e: any) {
        this.logger.error({
          event:
            'LOCK_RELEASE_FAILED',
          correlationId,
          error: e.message,
        });
      }
    }
  }

  // =========================
  // 🧾 BULK INVOICE
  // =========================

  async generateInvoicesForClass(
    tenantId: string,
    dto: BulkInvoiceDto,
    actorId: string,
  ) {
    const students =
      await this.prisma.student.findMany({
        where: {
          tenantId,
          isActive: true,
          section: {
            classId: dto.classId,
          },
        },
        select: {
          id: true,
        },
      });

    if (!students.length) {
      throw new BadRequestException(
        'No active students found',
      );
    }

    const results = {
      generated: 0,
      skipped: 0,
      errors: [] as any[],
      totalErrors: 0,
    };

    const limit = pLimit(10);

    const resultsArr =
      await Promise.all(
        students.map((student) =>
          limit(async () => {
            for (
              let attempt = 0;
              attempt < 2;
              attempt++
            ) {
              const controller =
                new AbortController();

              try {
                return await this.prisma.$transaction(
                  async (tx) => {
                    const exists =
                      await tx.invoice.findFirst({
                        where: {
                          tenantId,
                          studentId:
                            student.id,
                        } as any,
                        select: {
                          id: true,
                        },
                      });

                    if (exists) {
                      return 'skipped';
                    }

                    const options: GenerateInvoiceOptions =
                      {
                        signal:
                          controller.signal,
                      };

                    await Promise.race([
                      this.invoices.generate(
                        tenantId,
                        {
                          studentId:
                            student.id,
                          feePlanId:
                            dto.feePlanId,
                          dueDate:
                            dto.dueDate,
                        },
                        actorId,
                      ),

                      new Promise(
                        (_, reject) =>
                          setTimeout(() => {
                            controller.abort();

                            reject({
                              type:
                                'TIMEOUT',
                              message:
                                'Execution timed out',
                            });
                          }, 12000),
                      ),
                    ]);

                    return 'generated';
                  },
                  {
                    timeout: 15000,
                  },
                );
              } catch (err: any) {
                const isDeadlock =
                  err.code ===
                    '40P01' ||
                  err.message?.includes(
                    'deadlock',
                  );

                const isTimeout =
                  err.type ===
                    'TIMEOUT' ||
                  err.message?.includes(
                    'timed out',
                  );

                if (
                  attempt === 0 &&
                  isDeadlock
                ) {
                  const jitter =
                    Math.floor(
                      Math.random() *
                        200,
                    );

                  await new Promise(
                    (res) =>
                      setTimeout(
                        res,
                        100 + jitter,
                      ),
                  );

                  continue;
                }

                results.totalErrors++;

                if (
                  results.errors.length <
                  500
                ) {
                  results.errors.push({
                    studentId:
                      student.id,
                    type: isTimeout
                      ? 'TIMEOUT'
                      : isDeadlock
                        ? 'DEADLOCK'
                        : 'BUSINESS_ERROR',
                    msg:
                      err.message ||
                      'Unknown error',
                  });
                }

                return 'error';
              }
            }
          }),
        ),
      );

    results.generated =
      resultsArr.filter(
        (r) => r === 'generated',
      ).length;

    results.skipped =
      resultsArr.filter(
        (r) => r === 'skipped',
      ).length;

    return results;
  }
}
