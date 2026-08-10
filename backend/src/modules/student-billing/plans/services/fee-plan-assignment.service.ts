// backend/src/modules/student-billing/plans/services/fee-plan-assignment.service.ts
//
// Phase 3 (frozen). Genuinely new -- FeeAssignment (student-level) is
// retired, not repurposed; this is a structurally different entity.

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../../core/compliance/audit.service';
import { CreateFeePlanAssignmentDto } from '../../dto/billing.dto';

@Injectable()
export class FeePlanAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Tenant/branch/session boundaries enforced explicitly, not assumed
   * from foreign key presence alone -- AcademicSession itself has no
   * branchId (confirmed directly against the live schema: sessions are
   * shared across every branch of a tenant), so branch-consistency is
   * checked via Class, which does carry both branchId and sessionId.
   */
  async create(tenantId: string, branchId: string, dto: CreateFeePlanAssignmentDto, actorId: string) {
    const session = await this.prisma.academicSession.findFirst({ where: { id: dto.sessionId, tenantId } });
    if (!session) throw new NotFoundException(`Academic session not found: ${dto.sessionId}`);

    const feePlan = await this.prisma.feePlan.findFirst({
      where: { id: dto.feePlanId, tenantId, branchId, sessionId: dto.sessionId },
    });
    if (!feePlan) throw new NotFoundException(`Fee plan not found in this branch/session: ${dto.feePlanId}`);

    const cls = await this.prisma.class.findFirst({
      where: { id: dto.classId, tenantId, branchId, sessionId: dto.sessionId },
    });
    if (!cls) throw new NotFoundException(`Class not found in this branch/session: ${dto.classId}`);

    if (dto.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: { id: dto.sectionId, tenantId, branchId, classId: dto.classId },
      });
      if (!section) throw new NotFoundException(`Section not found on this class: ${dto.sectionId}`);
    }

    // Duplicate prevention is also enforced at the database level
    // (FeePlanAssignment_scope_unique, COALESCE-based -- see the
    // migration) -- this check exists to return a clear, specific error
    // rather than a raw constraint-violation message, not as the only
    // guard.
    const existing = await this.prisma.feePlanAssignment.findFirst({
      where: { tenantId, sessionId: dto.sessionId, classId: dto.classId, sectionId: dto.sectionId ?? null },
    });
    if (existing) {
      throw new ConflictException(
        dto.sectionId
          ? `A fee plan assignment already exists for this section in this session.`
          : `A class-level fee plan assignment already exists for this class in this session.`,
      );
    }

    const assignment = await this.prisma.feePlanAssignment.create({
      data: {
        tenantId, branchId,
        sessionId: dto.sessionId,
        feePlanId: dto.feePlanId,
        classId:   dto.classId,
        sectionId: dto.sectionId ?? null,
        createdById: actorId,
      },
    });

    await this.audit.logCreate({
      tenantId, actorId, entityType: 'FeePlanAssignment', entityId: assignment.id,
      after: { feePlanId: dto.feePlanId, classId: dto.classId, sectionId: dto.sectionId ?? null },
    });
    return assignment;
  }

  async findAll(tenantId: string, branchId: string, sessionId?: string) {
    return this.prisma.feePlanAssignment.findMany({
      where: { tenantId, branchId, ...(sessionId && { sessionId }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Section-specific assignment wins over class-level -- the frozen
   * resolution rule, and the sole reason this method exists rather than
   * a plain findFirst. Called at billing execution time (InvoiceService,
   * below), always against the student's class/section AS OF the
   * billing period being processed, never blindly their current one.
   */
  async resolveForClassSection(
    tenantId: string, branchId: string, sessionId: string, classId: string, sectionId: string | null,
  ) {
    if (sectionId) {
      const sectionMatch = await this.prisma.feePlanAssignment.findFirst({
        where: { tenantId, branchId, sessionId, classId, sectionId },
      });
      if (sectionMatch) return sectionMatch;
    }
    return this.prisma.feePlanAssignment.findFirst({
      where: { tenantId, branchId, sessionId, classId, sectionId: null },
    });
  }
}
