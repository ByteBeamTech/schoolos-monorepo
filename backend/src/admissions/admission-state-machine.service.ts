import { PrismaClient } from '@prisma/client';

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

const ALLOWED_TRANSITIONS: Record<AdmissionStatus, AdmissionStatus[]> = {
INQUIRY:         ['DOCUMENT_UPLOAD', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
DOCUMENT_UPLOAD: ['VERIFICATION',    'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
VERIFICATION:    ['FEE_DEPOSIT',     'DOCUMENT_UPLOAD', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
FEE_DEPOSIT:     ['CONVERTED',       'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
CONVERTED:       [],
WAITLISTED:      ['DOCUMENT_UPLOAD', 'REJECTED', 'WITHDRAWN'],
REJECTED:        [],
WITHDRAWN:       [],
};

export class AdmissionStateMachineService {
constructor(private readonly prisma: PrismaClient) {}

async transition(
admissionId: string,
tenantId: string,
toStatus: AdmissionStatus,
ctx: TransitionContext,
) {
const admission = await this.prisma.admission.findFirst({
where: { id: admissionId, tenantId },
});

if (!admission) throw new Error(`Admission ${admissionId} not found`);

const fromStatus = admission.status as AdmissionStatus;

const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
if (!allowed.includes(toStatus)) {
  throw new Error(`Invalid transition ${fromStatus} → ${toStatus}`);
}

const payload = ctx.payload ?? {};

const stepStartedAt = this._getStepStartedAt(admission, fromStatus);

const durationMs = stepStartedAt
  ? Date.now() - new Date(stepStartedAt).getTime()
  : null;

const stepTimestampField = this._getStepTimestampField(toStatus);
const stepDataField = this._getStepDataField(toStatus);

const updateData: Record<string, unknown> = {
  status: toStatus,
  updatedAt: new Date(),
  ...(stepTimestampField && { [stepTimestampField]: new Date() }),
  ...(stepDataField && Object.keys(payload).length > 0 && {
    [stepDataField]: payload,
  }),
};

const [updated] = await this.prisma.$transaction([
  this.prisma.admission.update({
    where: { id: admissionId },
    data: updateData as any,
  }),

  this.prisma.admissionStepLog.create({
    data: {
      admissionId,
      tenantId,
      branchId: admission.branchId ?? null,

      step: toStatus,
      fromStep: fromStatus,   // ✅ FIXED

      actorId: ctx.actorId ?? null,

      durationMs: durationMs ? Math.round(durationMs) : null, // ✅ FIXED

      note: ctx.note ?? null,
      metadata: Object.keys(payload).length > 0 ? payload : null as any,
    },
  }),

  this.prisma.admissionActivity.create({
    data: {
      admissionId,
      tenantId,
      actorId: ctx.actorId ?? null,
      action: `STATUS_CHANGED_TO_${toStatus}`,
      note: ctx.note ?? `Moved from ${fromStatus} to ${toStatus}`,
    },
  }),
]);

return updated;

}

async getFunnelAnalytics(tenantId: string, branchId?: string) {
const steps: AdmissionStatus[] = [
'INQUIRY',
'DOCUMENT_UPLOAD',
'VERIFICATION',
'FEE_DEPOSIT',
'CONVERTED',
];

const counts = await this.prisma.admission.groupBy({
  by: ['status'],
  where: { tenantId, ...(branchId ? { branchId } : {}) },
  _count: { id: true },
});

const avgDurations = await this.prisma.admissionStepLog.groupBy({
  by: ['step'],
  where: { tenantId, ...(branchId ? { branchId } : {}) },
  _avg: { durationMs: true }, // ✅ FIXED
});

const countMap = Object.fromEntries(
  counts.map(c => [c.status, c._count.id]),
);

const durMap: Record<string, number | null> = Object.fromEntries(
  avgDurations.map(d => [d.step, d._avg.durationMs]), // ✅ FIXED
);

return steps.map((step, idx) => {
  const count = countMap[step] ?? 0;
  const prev = idx > 0 ? countMap[steps[idx - 1]] ?? 0 : count;

  return {
    step,
    count,
    dropOffRate:
      prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0,
    avgHoursInStep: durMap[step]
      ? Math.round((durMap[step]! / 3_600_000) * 10) / 10
      : null,
  };
});

}

private _getStepStartedAt(admission: any, status: AdmissionStatus) {
const map: any = {
INQUIRY: 'inquiredAt',
DOCUMENT_UPLOAD: 'documentUploadedAt',
VERIFICATION: 'verifiedAt',
FEE_DEPOSIT: 'feeDepositedAt',
};
return map[status] ? admission[map[status]] : null;
}

private _getStepTimestampField(status: AdmissionStatus) {
const map: any = {
DOCUMENT_UPLOAD: 'documentUploadedAt',
VERIFICATION: 'verifiedAt',
FEE_DEPOSIT: 'feeDepositedAt',
CONVERTED: 'convertedAt',
REJECTED: 'rejectedAt',
};
return map[status] ?? null;
}

private _getStepDataField(status: AdmissionStatus) {
const map: any = {
DOCUMENT_UPLOAD: 'documentUpload',
VERIFICATION: 'verificationData',
FEE_DEPOSIT: 'feeDepositData',
};
return map[status] ?? null;
}
}

