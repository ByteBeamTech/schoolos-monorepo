// backend/src/modules/student-billing/plans/utils/student-resolution.util.ts
//
// Phase 3 (frozen): student billing eligibility and point-in-time
// class/section both come from the existing Academic/Student domain --
// no Billing-owned enrollment table, no invented isBillable boolean, no
// second history table alongside StudentPromotion. Both functions take a
// Prisma client so callers control transaction boundaries; neither
// function owns a query strategy beyond what's written here.

import { Prisma, StudentStatus } from '@prisma/client';

/**
 * Confirmed against the live StudentStatus enum (8 values), not assumed:
 * ENROLLED, ACTIVE, INACTIVE, ALUMNI, DROPPED, TRANSFERRED, ARCHIVED,
 * DELETED. Only ENROLLED and ACTIVE are billable -- stated here
 * explicitly, as the one place this decision lives, rather than
 * implicitly baked into a query filter someone has to reverse-engineer
 * later.
 */
export const BILLABLE_STUDENT_STATUSES: StudentStatus[] = [
  StudentStatus.ENROLLED,
  StudentStatus.ACTIVE,
];

export interface BillingPeriodWindow {
  periodStart: Date;
  periodEnd: Date;
}

/**
 * A student leaving mid-period must not simply disappear from billing --
 * this function's whole purpose is making that explicit rather than
 * leaving it to whichever query happens to filter status=ACTIVE and miss
 * the case entirely. Uses admissionDate (falling back to enrolledAt,
 * which is NOT NULL, if admissionDate was never recorded) and leftAt,
 * both confirmed real fields on the live Student model.
 */
export function isStudentEligibleForPeriod(
  student: { status: StudentStatus; admissionDate: Date | null; enrolledAt: Date; leftAt: Date | null },
  window: BillingPeriodWindow,
): boolean {
  if (!BILLABLE_STUDENT_STATUSES.includes(student.status)) return false;

  const admittedBy = student.admissionDate ?? student.enrolledAt;
  if (admittedBy > window.periodEnd) return false; // not yet admitted for this period

  if (student.leftAt && student.leftAt < window.periodStart) return false; // left before this period began

  return true;
}

/**
 * Resolves a student's class/section AS OF a given date, per the frozen
 * "do not simply assume the student's current section applies to every
 * historical period" rule. Reuses StudentPromotion -- confirmed real,
 * confirmed it has no toClassId (class is derived via Section.classId,
 * since Section already belongs to exactly one Class) -- rather than
 * inventing a second history table.
 *
 * Only promotions with a real toSectionId AND a real processedAt are
 * considered a genuine, resolved placement -- a PENDING or CANCELLED
 * promotion, or one recorded without ever actually being processed,
 * must not be treated as having happened.
 */
export async function resolveClassSectionAsOf(
  tx: Prisma.TransactionClient,
  tenantId: string,
  studentId: string,
  asOfDate: Date,
): Promise<{ classId: string; sectionId: string | null }> {
  const promotion = await tx.studentPromotion.findFirst({
    where: {
      tenantId,
      studentId,
      processedAt: { not: null, lte: asOfDate },
      toSectionId: { not: null },
    },
    orderBy: { processedAt: 'desc' },
  });

  if (promotion?.toSectionId) {
    const section = await tx.section.findUnique({ where: { id: promotion.toSectionId } });
    if (section) return { classId: section.classId, sectionId: section.id };
  }

  // No resolved promotion as of this date -- the student's current
  // class/section is also their as-of-period class/section (never
  // promoted, or every promotion on record postdates asOfDate).
  const student = await tx.student.findUniqueOrThrow({ where: { id: studentId } });
  return { classId: student.classId, sectionId: student.sectionId };
}
