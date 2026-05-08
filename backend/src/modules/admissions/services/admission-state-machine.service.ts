import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { Prisma, AdmissionStepStatus } from '@prisma/client';

// Alias: the service was written using 'AdmissionStatus'; schema uses AdmissionStepStatus
export type AdmissionStatus = AdmissionStepStatus;
export { AdmissionStepStatus };

/**
 * 🔥 TITANIUM JSON SERIALIZER (Enterprise Standard)
 * Handles BigInt and logs failures to the centralized logger.
 */
const safeJson = (data: any, logger: Logger) => {
  try {
    return JSON.parse(
      JSON.stringify(data, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );
  } catch (err: any) {
    // ✅ FIX 1: Standardized Logging instead of console.error
    logger.error({ event: 'SAFE_JSON_SERIALIZATION_FAILED', error: err?.message });
    return undefined;
  }
};

enum EventType {
  ADMISSION_TRANSITION = 'ADMISSION_TRANSITION'
}

export interface TransitionContext {
  actorId: string;
  note?: string;
  payload?: Record<string, unknown>;
  slaHours?: number;
  featureFlags?: { skipOutbox?: boolean; skipAnalytics?: boolean };
}

@Injectable()
export class AdmissionStateMachineService {
  private readonly logger = new Logger(AdmissionStateMachineService.name);
  private readonly STRATEGY = 'admission-v6.1-final-truth';
  private readonly ENTITY = 'admission';
  private readonly EVENT_TYPE = EventType.ADMISSION_TRANSITION;

  private readonly ALLOWED_TRANSITIONS: Record<any, any> = Object.freeze({
    INQUIRY: ['UNDER_REVIEW', 'REJECTED', 'WITHDRAWN'],

    UNDER_REVIEW: [
      'DOCUMENT_UPLOAD',
      'WAITLISTED',
      'REJECTED',
      'WITHDRAWN',
    ],

    DOCUMENT_UPLOAD: [
      'VERIFICATION',
      'WAITLISTED',
      'REJECTED',
      'WITHDRAWN',
    ],

    VERIFICATION: [
      'FEE_DEPOSIT',
      'WAITLISTED',
      'REJECTED',
      'WITHDRAWN',
    ],

    FEE_DEPOSIT: [
      'CONVERTED',
      'WAITLISTED',
      'REJECTED',
      'WITHDRAWN',
    ],

    CONVERTED: [],

    WAITLISTED: [
      'UNDER_REVIEW',
      'REJECTED',
    ],

    REJECTED: [],

    WITHDRAWN: [],
  });

  constructor(private readonly prisma: PrismaService) {}

  async transition(admissionId: string, tenantId: string, toStatus: AdmissionStatus, ctx: TransitionContext) {
    const startTime = Date.now();
    const executionId = `exec:${admissionId}:${startTime}`;
    const correlationId = executionId;

    const admission = await this.prisma.admission.findUnique({ where: { id: admissionId } });

    if (!admission || admission.tenantId !== tenantId) {
      throw new NotFoundException(`Admission record not found`);
    }

    const fromStatus: AdmissionStatus = admission.status as AdmissionStatus;

    // ✅ Idempotency Level 1
    if (fromStatus === toStatus) return { ...admission, status: fromStatus };

    if (!Object.values(require('@prisma/client').AdmissionStepStatus).includes(toStatus)) {
      throw new BadRequestException(`Invalid target status: ${toStatus}`);
    }

    if (!this.ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus)) {
      throw new BadRequestException(`Invalid transition flow from ${fromStatus} to ${toStatus}`);
    }

    // ✅ Payload Hardening with Logger Context
    const rawPayload = safeJson(ctx?.payload ?? {}, this.logger);
    const safePayload = rawPayload ? Object.freeze(rawPayload) : undefined;
    const MAX_PAYLOAD_SIZE = 10_000;
    let payloadSize = 0;

    if (safePayload) {
      try {
        const payloadStr = JSON.stringify(safePayload);
        payloadSize = Buffer.byteLength(payloadStr);
      } catch {}
    }

    if (payloadSize > MAX_PAYLOAD_SIZE) {
      this.logger.warn({ event: 'PAYLOAD_TOO_LARGE', entity: this.ENTITY, admissionId: admissionId, executionId, size: payloadSize });
    }

    // ✅ Distributed Safe Idempotency Key
    const updatedAtIso = admission.updatedAt?.toISOString?.() ?? new Date().toISOString();
    const jobKey = `${this.ENTITY}:${admissionId}:${toStatus}:${updatedAtIso}`;

    const statusTimestampMap: Record<string, string> = {
      DOCUMENT_UPLOAD: 'documentUploadedAt',
      VERIFICATION: 'verifiedAt',
      FEE_DEPOSIT: 'feeDepositedAt',
      COMPLETED: 'convertedAt',
    };

    const stepTimestampMap: Record<string, string> = {
      PENDING: 'inquiredAt',
      DOCUMENT_UPLOAD: 'documentUploadedAt',
      VERIFICATION: 'verifiedAt',
      FEE_DEPOSIT: 'feeDepositedAt',
    };

    // ✅ FIX 2: Pure Type-Safe Field Access (Removed any)
    const record = admission as Record<string, unknown>;
    const timestampField = stepTimestampMap[fromStatus];
    const stepStartedAt = timestampField ? record[timestampField] : null;
    const stepStartTs = stepStartedAt ? new Date(stepStartedAt as string | number | Date).getTime() : null;
    
    const durationMs = stepStartTs && !isNaN(stepStartTs) ? Math.max(0, Date.now() - stepStartTs) : 0;

    const SLA_THRESHOLD_HOURS = ctx?.slaHours ?? 48;
    if (durationMs > (SLA_THRESHOLD_HOURS * 3600 * 1000)) {
      this.logger.warn({
        event: 'SLA_BREACH',
        entity: this.ENTITY,
        admissionId: admissionId,
        fromStatus,
        toStatus,
        executionId,
        correlationId,
        durationHours: Math.round(durationMs / 3600000)
      });
    }

    const sanitizedNote = String(ctx?.note || '').replace(/[<>]/g, '').slice(0, 500);

    // ✅ Elite Transaction Retry Loop
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          let updated;
          try {
            updated = await tx.admission.update({
              where: { id: admissionId, status: fromStatus },
              data: {
                status: toStatus,
                updatedAt: new Date(),
                ...(statusTimestampMap[toStatus] && { [statusTimestampMap[toStatus]]: new Date() }),
              } as any,
            });
          } catch (e: any) {
            if (e.code === 'P2025') {
              this.logger.warn({ event: 'ATOMIC_GUARD_SKIPPED', entity: this.ENTITY, admissionId: admissionId, executionId, reason: 'CONCURRENT_UPDATE' });
              return { ...admission, status: fromStatus };
            }
            throw e;
          }

          // Step log stored as admissionActivity with structured meta
          await tx.admissionActivity.create({
            data: {
              admissionId: admissionId,
              tenantId,
              actorId: ctx?.actorId,
              action: `STEP_TRANSITION`,
              note: `${fromStatus} → ${toStatus}`,
              meta: {
                step: toStatus,
                fromStep: fromStatus,
                durationMs: Number(durationMs.toFixed(0)),
                payload: safePayload ?? null,
              },
            },
          });

          await tx.admissionActivity.create({
            data: { admissionId: admissionId, tenantId, actorId: ctx?.actorId, action: `STATUS_CHANGED_${toStatus}`, note: sanitizedNote },
          });

          if (!ctx?.featureFlags?.skipOutbox) {
            await (tx as any).eventOutbox.upsert({
              where: { uniqueKey: jobKey },
              update: {},
              create: {
                uniqueKey: jobKey,
                type: this.EVENT_TYPE,
                payload: {
                  core: { admissionId: admissionId, tenantId, fromStatus, toStatus, actorId: ctx?.actorId },
                  metadata: safePayload ?? null,
                  system: { executionId, correlationId, strategy: this.STRATEGY, version: 1, emittedAt: new Date().toISOString() }
                },
                status: 'PENDING',
                retryCount: 0
              },
            });
          }
          return updated;
        }, { timeout: 10000, maxWait: 5000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
      } catch (err: any) {
        if (attempt === 1) {
          this.logger.error({ event: 'TRANSITION_FAILED_PERMANENT', entity: this.ENTITY, admissionId: admissionId, executionId, error: err.message });
          throw err;
        }
        this.logger.warn({ event: 'TRANSACTION_RETRYING', attempt: attempt + 1, admissionId: admissionId, error: err.message });
      }
    }
  }

  async getFunnelAnalytics(tenantId: string, branchId?: string) {
    const steps: any[] = ['PENDING', 'UNDER_REVIEW', 'UNDER_REVIEW', 'UNDER_REVIEW', 'COMPLETED'];
    const [counts, durations] = await Promise.all([
      this.prisma.admission.groupBy({ by: ['status'], where: { tenantId, ...(branchId && { branchId }) }, _count: { id: true } }),
      Promise.resolve([]), // step duration analytics removed (admissionStepLog not in schema)
    ]);

    const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count.id]));
    const durMap: Record<string, number | null> = {}; // step durations not tracked in this schema version

    return steps.map((step, idx) => {
      const count = countMap[step] ?? 0;
      const prev = idx > 0 ? countMap[steps[idx - 1]] ?? 0 : count;
      return { step, count, dropOffRate: prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0, avgHoursInStep: durMap[step] ? Number((Number(durMap[step]) / 3600000).toFixed(1)) : null };
    });
  }
}
