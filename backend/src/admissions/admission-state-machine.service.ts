import { PrismaClient, AdmissionStepStatus } from '@prisma/client';

export type AdmissionStatus = AdmissionStepStatus;

export interface TransitionContext {
  actorId: string;
  note?: string;
  payload?: Record<string, unknown>;
}

const ALLOWED_TRANSITIONS: Record<AdmissionStatus, AdmissionStatus[]> = {
  INQUIRY: ['UNDER_REVIEW', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['DOCUMENT_UPLOAD', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
  DOCUMENT_UPLOAD: ['UNDER_REVIEW', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
  VERIFICATION: ['UNDER_REVIEW', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
  FEE_DEPOSIT: ['CONVERTED', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
  CONVERTED: [],
  WAITLISTED: ['UNDER_REVIEW', 'REJECTED', 'WITHDRAWN'],
  REJECTED: [],
  WITHDRAWN: [],
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
      where: {
        id: admissionId,
        tenantId,
      },
    });

    if (!admission) {
      throw new Error(`Admission ${admissionId} not found`);
    }

    const fromStatus = admission.status as AdmissionStatus;

    const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];

    if (!allowed.includes(toStatus)) {
      throw new Error(
        `Invalid transition ${fromStatus} → ${toStatus}`,
      );
    }

    const updateData = {
      status: toStatus,
      updatedAt: new Date(),
    };

    const [updated] = await this.prisma.$transaction([
      this.prisma.admission.update({
        where: {
          id: admissionId,
        },
        data: updateData,
      }),

      this.prisma.admissionStepLog.create({
        data: {
          application: {
            connect: {
              id: admissionId,
            },
          },

          updatedBy: {
            connect: {
              id: ctx.actorId,
            },
          },

          oldStatus: fromStatus,
          newStatus: toStatus,
        },
      }),

      this.prisma.admissionActivity.create({
        data: {
          admission: {
            connect: {
              id: admissionId,
            },
          },
          tenantId,
          actorId: ctx.actorId ?? null,
          action: `STATUS_CHANGED_TO_${toStatus}`,
          note: ctx.note ?? null,
        },
      }),
    ]);

    return updated;
  }

  async getFunnelAnalytics(
    tenantId: string,
    branchId?: string,
  ) {
    const steps: AdmissionStatus[] = [
      'INQUIRY',
      'DOCUMENT_UPLOAD',
      'VERIFICATION',
      'FEE_DEPOSIT',
      'CONVERTED',
    ];

    const counts = await this.prisma.admission.groupBy({
      by: ['status'],
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
      },
      _count: {
        id: true,
      },
    });

    const countMap = Object.fromEntries(
      counts.map((c) => [c.status, c._count.id]),
    );

    return steps.map((step, idx) => {
      const count = countMap[step] ?? 0;

      const prev =
        idx > 0
          ? countMap[steps[idx - 1]] ?? 0
          : count;

      return {
        step,
        count,
        dropOffRate:
          prev > 0
            ? Math.round(((prev - count) / prev) * 100)
            : 0,
        avgHoursInStep: null,
      };
    });
  }
}
