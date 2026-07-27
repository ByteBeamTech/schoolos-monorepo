// ADR-LIB-001 §2 -- Library borrowers are existing platform entities
// (Student, Staff), never a LibraryMember aggregate. This service is
// the ONE place that knows how to turn (tenantId, borrowerType,
// borrowerId) into a normalized shape; every other Library service
// codes against that shape, never against Student/Staff directly.

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import type { BorrowerType } from '@prisma/client';

export interface ResolvedBorrower {
  borrowerType: BorrowerType;
  borrowerId:   string;
  displayName:  string;
  /** The borrower's own home branch at resolution time (nullable -- Staff.branchId is optional on this platform). */
  branchId:     string | null;
  /** Admission number (Student) or employee id (Staff). */
  displayId:    string | null;
  /**
   * "Active enough to borrow" -- matches this platform's existing
   * `isActive` convention (students.service.ts / staff.service.ts both
   * filter on this flag, not the more granular status enum, for
   * "usable" checks). ADR-LIB-001 §2's lifecycle rules (inactive,
   * alumni, dropped, transferred, archived, exited, suspended) all
   * collapse to this one boolean on this platform -- a borrower whose
   * record is not `isActive` cannot be issued a new book or renew one,
   * but their existing issue history remains fully visible.
   */
  isActive:     boolean;
}

@Injectable()
export class BorrowerResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    tenantId: string,
    borrowerType: BorrowerType,
    borrowerId: string,
  ): Promise<ResolvedBorrower> {
    if (borrowerType === 'STUDENT') {
      const student = await this.prisma.student.findFirst({
        where: { id: borrowerId, tenantId },
      });
      if (!student) {
        throw new NotFoundException(`Student not found: ${borrowerId}`);
      }
      return {
        borrowerType: 'STUDENT',
        borrowerId:   student.id,
        displayName:  `${student.firstName} ${student.lastName}`.trim(),
        branchId:     student.branchId ?? null,
        displayId:    student.admissionNumber ?? null,
        isActive:     student.isActive === true,
      };
    }

    if (borrowerType === 'STAFF') {
      const staff = await this.prisma.staff.findFirst({
        where:   { id: borrowerId, tenantId },
        include: { profile: true },
      });
      if (!staff) {
        throw new NotFoundException(`Staff not found: ${borrowerId}`);
      }
      const displayName = staff.profile
        ? `${staff.profile.firstName} ${staff.profile.lastName}`.trim()
        : 'Unknown Staff';
      return {
        borrowerType: 'STAFF',
        borrowerId:   staff.id,
        displayName,
        branchId:     staff.branchId ?? null,
        displayId:    staff.employeeId ?? null,
        isActive:     staff.isActive === true,
      };
    }

    throw new BadRequestException(`Unsupported borrower type: ${borrowerType}`);
  }

  /**
   * ADR-LIB-001 §2 -- "does this borrower have unreturned copies" --
   * the query TC/transfer/offboarding workflows are expected to call
   * before finalizing a leave/exit. Only the open-issues half is
   * implemented here; the unbilled/unpaid-fine half depends on Phase
   * 4's LibraryChargeRequest and does not exist yet.
   */
  async hasOpenLibraryObligations(
    tenantId: string,
    borrowerType: BorrowerType,
    borrowerId: string,
  ): Promise<boolean> {
    const openIssue = await this.prisma.bookIssue.findFirst({
      where:  { tenantId, borrowerType, borrowerId, status: 'ISSUED' },
      select: { id: true },
    });
    return !!openIssue;
  }
}
