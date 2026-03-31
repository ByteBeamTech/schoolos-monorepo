/**
 * admission-state-machine.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Enforces valid step transitions for the Admissions flow:
 *
 *   INQUIRY → DOCUMENT_UPLOAD → VERIFICATION → FEE_DEPOSIT → CONVERTED
 *                                                   ↘ WAITLISTED / REJECTED / WITHDRAWN (at any step)
 *
 * DESIGN DECISIONS (CTO-level):
 *  1. State Machine pattern — no if/else spaghetti; transition table drives all logic.
 *  2. AdmissionStepLog is written on EVERY transition for full funnel analytics.
 *  3. Services are pure — no HTTP layer; inject PrismaClient from outside.
 *  4. Each step transition validates its required payload before proceeding.
 */

import { PrismaClient } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────
export type AdmissionStatus =
  | 'INQUIRY'
  | 'DOCUMENT_UPLOAD'
  | 'VERIFICATION'
  | 'FEE_DEPOSIT'
  | 'CONVERTED'
  | 'WAITLISTED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface TransitionContext {
  actorId: string;
  note?: string;
  payload?: Record<string, unknown>;
}

// ── Transition table ──────────────────────────────────────────────────────────
const ALLOWED_TRANSITIONS: Record<AdmissionStatus, AdmissionStatus[]> = {
  INQUIRY:         ['DOCUMENT_UPLOAD', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
  DOCUMENT_UPLOAD: ['VERIFICATION',    'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
  VERIFICATION:    ['FEE_DEPOSIT',     'DOCUMENT_UPLOAD', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
  FEE_DEPOSIT:     ['CONVERTED',       'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
  CONVERTED:       [],                 // terminal
  WAITLISTED:      ['DOCUMENT_UPLOAD', 'REJECTED', 'WITHDRAWN'],
  REJECTED:        [],                 // terminal
  WITHDRAWN:       [],                 // terminal
};

// ── Step-specific validators ──────────────────────────────────────────────────
function validateDocumentUpload(payload: Record<string, unknown>) {
  const required = ['documentTypes'];  // e.g. ['aadhar', 'birthCert']
  for (const key of required) {
    if (!payload[key]) throw new Error(`Missing required field for DOCUMENT_UPLOAD: ${key}`);
  }
}

function validateFeeDeposit(payload: Record<string, unknown>) {
  if (!payload.receiptNumber) throw new Error('receiptNumber is required for FEE_DEPOSIT');
  if (!payload.amount || Number(payload.amount) <= 0) throw new Error('Valid amount is required for FEE_DEPOSIT');
}

function validateConversion(payload: Record<string, unknown>) {
  if (!payload.enrolledStudentId) throw new Error('enrolledStudentId is required for CONVERTED');
}

// ── Main service ──────────────────────────────────────────────────────────────
export class AdmissionStateMachineService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Transition an Admission to a new status.
   * Writes an AdmissionStepLog and AdmissionActivity atomically.
   */
  async transition(
    admissionId: string,
    tenantId: string,
    toStatus: AdmissionStatus,
    ctx: TransitionContext,
  ) {
    // 1. Fetch current admission
    const admission = await this.prisma.admission.findFirst({
      where: { id: admissionId, tenantId },
    });
    if (!admission) throw new Error(`Admission ${admissionId} not found`);

    const fromStatus = admission.status as AdmissionStatus;

    // 2. Validate transition is allowed
    const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new Error(
        `Invalid transition: ${fromStatus} → ${toStatus}. Allowed: [${allowed.join(', ')}]`,
      );
    }

    // 3. Step-specific payload validation
    const payload = ctx.payload ?? {};
    if (toStatus === 'DOCUMENT_UPLOAD') validateDocumentUpload(payload);
    if (toStatus === 'FEE_DEPOSIT')     validateFeeDeposit(payload);
    if (toStatus === 'CONVERTED')       validateConversion(payload);

    // 4. Compute duration in this step
    const stepStartedAt = this._getStepStartedAt(admission, fromStatus);
    const durationMs = stepStartedAt
      ? Date.now() - new Date(stepStartedAt).getTime()
      : null;

    // 5. Build update data
    const stepTimestampField = this._getStepTimestampField(toStatus);
    const stepDataField      = this._getStepDataField(toStatus);

    const updateData: Record<string, unknown> = {
      status:    toStatus,
      updatedAt: new Date(),
      ...(stepTimestampField ? { [stepTimestampField]: new Date() } : {}),
      ...(stepDataField && Object.keys(payload).length > 0
        ? { [stepDataField]: payload }
        : {}),
      ...(toStatus === 'CONVERTED' && payload.enrolledStudentId
        ? { enrolledStudentId: payload.enrolledStudentId as string, convertedAt: new Date() }
        : {}),
      ...(toStatus === 'REJECTED' && payload.reason
        ? { rejectionReason: payload.reason as string, rejectedAt: new Date() }
        : {}),
    };

    // 6. Atomic write — transition + log + activity
    const [updated] = await this.prisma.$transaction([
      // Update Admission
      this.prisma.admission.update({
        where: { id: admissionId },
        data: updateData as Parameters<typeof this.prisma.admission.update>[0]['data'],
      }),

      // Write analytics step log
      this.prisma.admissionStepLog.create({
        data: {
          admissionId,
          tenantId,
          branchId:   admission.branchId,
          fromStep:   fromStatus,
          toStep:     toStatus,
          actorId:    ctx.actorId,
          durationMs: durationMs ? Math.round(durationMs) : null,
          note:       ctx.note ?? null,
          metadata:   Object.keys(payload).length > 0 ? payload : null,
        },
      }),

      // Write human-readable activity
      this.prisma.admissionActivity.create({
        data: {
          admissionId,
          tenantId,
          actorId:  ctx.actorId,
          action:   `STATUS_CHANGED_TO_${toStatus}`,
          note:     ctx.note ?? `Moved from ${fromStatus} to ${toStatus}`,
        },
      }),
    ]);

    return updated;
  }

  // ── Funnel analytics ─────────────────────────────────────────────────────────
  /**
   * Returns funnel data per step — how many admissions,
   * avg time spent, and drop-off rate. Essential for school owners.
   */
  async getFunnelAnalytics(tenantId: string, branchId?: string) {
    const steps: AdmissionStatus[] = [
      'INQUIRY', 'DOCUMENT_UPLOAD', 'VERIFICATION', 'FEE_DEPOSIT', 'CONVERTED',
    ];

    const counts = await this.prisma.admission.groupBy({
      by: ['status'],
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      _count: { id: true },
    });

    const avgDurations = await this.prisma.admissionStepLog.groupBy({
      by: ['toStep'],
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      _avg: { durationMs: true },
    });

    const countMap = Object.fromEntries(counts.map(c => [c.status, c._count.id]));
    const durMap   = Object.fromEntries(avgDurations.map(d => [d.toStep, d._avg.durationMs]));

    return steps.map((step, idx) => {
      const count   = countMap[step] ?? 0;
      const prevCount = idx > 0 ? (countMap[steps[idx - 1]] ?? 0) : count;
      return {
        step,
        count,
        dropOffRate: prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : 0,
        avgHoursInStep: durMap[step]
          ? Math.round((durMap[step]! / 3_600_000) * 10) / 10
          : null,
      };
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────────
  private _getStepStartedAt(admission: Record<string, unknown>, status: AdmissionStatus): string | null {
    const map: Partial<Record<AdmissionStatus, string>> = {
      INQUIRY:         'inquiredAt',
      DOCUMENT_UPLOAD: 'documentUploadedAt',
      VERIFICATION:    'verifiedAt',
      FEE_DEPOSIT:     'feeDepositedAt',
    };
    const field = map[status];
    return field ? (admission[field] as string | null) : null;
  }

  private _getStepTimestampField(status: AdmissionStatus): string | null {
    const map: Partial<Record<AdmissionStatus, string>> = {
      DOCUMENT_UPLOAD: 'documentUploadedAt',
      VERIFICATION:    'verifiedAt',
      FEE_DEPOSIT:     'feeDepositedAt',
      CONVERTED:       'convertedAt',
      REJECTED:        'rejectedAt',
    };
    return map[status] ?? null;
  }

  private _getStepDataField(status: AdmissionStatus): string | null {
    const map: Partial<Record<AdmissionStatus, string>> = {
      DOCUMENT_UPLOAD: 'documentUpload',
      VERIFICATION:    'verificationData',
      FEE_DEPOSIT:     'feeDepositData',
    };
    return map[status] ?? null;
  }
}
