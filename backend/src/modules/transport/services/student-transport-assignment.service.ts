import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { buildReadScope } from '@modules/crm/services/branch-scope.util';
import { EVENTS } from '@core/events/events.constants';
import { TransportSettingsService } from './transport-settings.service';
import {
  AssignStudentDto,
  ConfirmTransferStudentDto,
  EndAssignmentDto,
  ListStudentAssignmentsQueryDto,
  TransferPreviewQueryDto,
} from '../dto/student-transport-assignment.dto';

/**
 * SAD Ch.5: StudentTransportAssignment. "Assign Student" and "Remove
 * Assignment" are plain operations (Ch.8 API); "Student Transfer" is one of
 * AF-007's explicitly-listed wizard operations, so it gets the same
 * preview -> impactToken -> confirm shape as RouteService's Suspend wizard
 * (Phase 4).
 */
@Injectable()
export class StudentTransportAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: TransportSettingsService,
  ) {}

  async list(user: AuthenticatedUser, query: ListStudentAssignmentsQueryDto) {
    const scope = buildReadScope(user, query.branchId);
    const where: Prisma.StudentTransportAssignmentWhereInput = { ...scope.where };
    if (query.studentId) where.studentId = query.studentId;
    if (query.routeId) where.routeId = query.routeId;
    if (query.status) where.status = query.status;

    return this.prisma.studentTransportAssignment.findMany({
      where,
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const scope = buildReadScope(user);
    const assignment = await this.prisma.studentTransportAssignment.findFirst({
      where: { ...scope.where, id },
    });
    if (!assignment) throw new NotFoundException('StudentTransportAssignment not found');
    return assignment;
  }

  /** Validates routeId/pickupRouteStopId/dropRouteStopId are mutually consistent and within the caller's scope. */
  private async loadAndValidateRouteStops(
    user: AuthenticatedUser,
    routeId: string,
    pickupRouteStopId: string,
    dropRouteStopId: string,
  ) {
    const scope = buildReadScope(user);
    const route = await this.prisma.route.findFirst({ where: { ...scope.where, id: routeId, deletedAt: null } });
    if (!route) throw new NotFoundException('Route not found');

    const [pickup, drop] = await Promise.all([
      this.prisma.routeStop.findFirst({ where: { id: pickupRouteStopId, routeId } }),
      this.prisma.routeStop.findFirst({ where: { id: dropRouteStopId, routeId } }),
    ]);
    if (!pickup) throw new NotFoundException('pickupRouteStopId is not a stop on this route');
    if (!drop) throw new NotFoundException('dropRouteStopId is not a stop on this route');

    return { route, pickup, drop };
  }

  private async getActiveFeeForRouteStop(routeStopId: string): Promise<number | null> {
    const pricing = await this.prisma.transportStopPricing.findFirst({
      where: { routeStopId, isActive: true, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    return pricing ? Number(pricing.feeAmount) : null;
  }

  /** SAD Ch.8: "Assign Student". Duplicate-assignment rule is AF-002-configurable (Phase 0.5). */
  async assign(user: AuthenticatedUser, dto: AssignStudentDto) {
    const scope = buildReadScope(user);

    const student = await this.prisma.student.findFirst({
      where: { ...scope.where, id: dto.studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const { route } = await this.loadAndValidateRouteStops(
      user,
      dto.routeId,
      dto.pickupRouteStopId,
      dto.dropRouteStopId,
    );

    if (route.branchId && student.branchId && student.branchId !== route.branchId) {
      throw new BadRequestException('This student belongs to a different branch than this route');
    }

    // Default matches TransportSettings.allowMultipleActiveAssignments' own
    // schema default (false) — a tenant-wide route (branchId: null) has no
    // branch-specific settings to consult, but the duplicate check itself
    // must still run regardless.
    let allowMultipleActiveAssignments = false;
    if (route.branchId) {
      const branchSettings = await this.settings.getOrCreate(route.tenantId, route.branchId, this.toSettingsCaller(user));
      allowMultipleActiveAssignments = branchSettings.allowMultipleActiveAssignments;
    }

    if (!allowMultipleActiveAssignments) {
      const existingActive = await this.prisma.studentTransportAssignment.findFirst({
        where: { studentId: dto.studentId, status: 'ACTIVE' },
      });
      if (existingActive) {
        throw new ConflictException(
          'This student already has an active transport assignment. Use Transfer instead, or Remove it first.',
        );
      }
    }

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();

    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.studentTransportAssignment.create({
        data: {
          tenantId: route.tenantId,
          branchId: route.branchId,
          studentId: dto.studentId,
          routeId: dto.routeId,
          pickupRouteStopId: dto.pickupRouteStopId,
          dropRouteStopId: dto.dropRouteStopId,
          effectiveFrom,
        },
      });

      await tx.eventOutbox.create({
        data: {
          uniqueKey: `${EVENTS.STUDENT_ASSIGNED}:${created.id}:${Date.now()}`,
          type: EVENTS.STUDENT_ASSIGNED,
          payload: {
            core: { tenantId: route.tenantId, branchId: route.branchId },
            eventType: EVENTS.STUDENT_ASSIGNED,
            aggregateType: 'StudentTransportAssignment',
            aggregateId: created.id,
            performedBy: user.id,
            studentId: dto.studentId,
            routeId: dto.routeId,
          },
        },
      });

      return created;
    });

    await this.audit.logCreate({
      tenantId: route.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'StudentTransportAssignment',
      entityId: assignment.id,
      after: { studentId: dto.studentId, routeId: dto.routeId },
    });

    return assignment;
  }

  /** SAD Ch.8: "Remove Assignment". */
  async remove(user: AuthenticatedUser, id: string, dto: EndAssignmentDto) {
    const before = await this.getOne(user, id);
    if (before.status !== 'ACTIVE') {
      throw new BadRequestException(`Cannot remove an assignment in status ${before.status}`);
    }

    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : new Date();
    const after = await this.prisma.studentTransportAssignment.update({
      where: { id },
      data: { status: 'ENDED', effectiveTo },
    });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'StudentTransportAssignment',
      entityId: id,
      before: { status: before.status },
      after: { status: after.status, reason: dto.reason },
    });

    return after;
  }

  // ------------------------------------------------------------------
  // AF-007 wizard: Student Transfer
  // ------------------------------------------------------------------

  async previewTransfer(user: AuthenticatedUser, id: string, dto: TransferPreviewQueryDto) {
    const current = await this.getOne(user, id);
    if (current.status !== 'ACTIVE') {
      throw new BadRequestException(`Cannot transfer an assignment in status ${current.status}`);
    }

    await this.loadAndValidateRouteStops(user, dto.newRouteId, dto.newPickupRouteStopId, dto.newDropRouteStopId);

    const [oldFee, newFee] = await Promise.all([
      this.getActiveFeeForRouteStop(current.pickupRouteStopId),
      this.getActiveFeeForRouteStop(dto.newPickupRouteStopId),
    ]);

    const impactToken = this.computeTransferImpactToken(id, dto.newRouteId, dto.newPickupRouteStopId, dto.newDropRouteStopId);

    return {
      assignmentId: id,
      currentRouteId: current.routeId,
      newRouteId: dto.newRouteId,
      currentMonthlyFee: oldFee,
      newMonthlyFee: newFee,
      feeDelta: oldFee !== null && newFee !== null ? newFee - oldFee : null,
      impactToken,
    };
  }

  async confirmTransfer(user: AuthenticatedUser, id: string, dto: ConfirmTransferStudentDto) {
    const current = await this.getOne(user, id);
    if (current.status !== 'ACTIVE') {
      throw new BadRequestException(`Cannot transfer an assignment in status ${current.status}`);
    }

    const { route: newRoute } = await this.loadAndValidateRouteStops(
      user,
      dto.newRouteId,
      dto.newPickupRouteStopId,
      dto.newDropRouteStopId,
    );

    const currentToken = this.computeTransferImpactToken(
      id,
      dto.newRouteId,
      dto.newPickupRouteStopId,
      dto.newDropRouteStopId,
    );
    if (currentToken !== dto.impactToken) {
      throw new ConflictException(
        'The transfer impact has changed since it was last previewed. Please re-run the preview and confirm again.',
      );
    }

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();

    const newAssignment = await this.prisma.$transaction(async (tx) => {
      await tx.studentTransportAssignment.update({
        where: { id },
        data: { status: 'TRANSFERRED', effectiveTo: effectiveFrom },
      });

      const created = await tx.studentTransportAssignment.create({
        data: {
          tenantId: current.tenantId,
          branchId: newRoute.branchId,
          studentId: current.studentId,
          routeId: dto.newRouteId,
          pickupRouteStopId: dto.newPickupRouteStopId,
          dropRouteStopId: dto.newDropRouteStopId,
          effectiveFrom,
        },
      });

      await tx.eventOutbox.create({
        data: {
          uniqueKey: `${EVENTS.STUDENT_TRANSFERRED}:${created.id}:${Date.now()}`,
          type: EVENTS.STUDENT_TRANSFERRED,
          payload: {
            core: { tenantId: current.tenantId, branchId: newRoute.branchId },
            eventType: EVENTS.STUDENT_TRANSFERRED,
            aggregateType: 'StudentTransportAssignment',
            aggregateId: created.id,
            performedBy: user.id,
            studentId: current.studentId,
            previousAssignmentId: id,
            previousRouteId: current.routeId,
            newRouteId: dto.newRouteId,
            reason: dto.reason,
          },
        },
      });

      return created;
    });

    await this.audit.logUpdate({
      tenantId: current.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'StudentTransportAssignment',
      entityId: id,
      before: { routeId: current.routeId },
      after: { routeId: dto.newRouteId, newAssignmentId: newAssignment.id },
    });

    return { previousAssignmentId: id, newAssignment };
  }

  private computeTransferImpactToken(
    assignmentId: string,
    newRouteId: string,
    newPickupRouteStopId: string,
    newDropRouteStopId: string,
  ): string {
    const material = [assignmentId, newRouteId, newPickupRouteStopId, newDropRouteStopId].join('|');
    return createHash('sha256').update(material).digest('hex').slice(0, 16);
  }

  /** Normalizes AuthenticatedUser for TransportSettingsService, which expects branchIds as a required array (see Phase 3+4's note on the two AuthenticatedUser interfaces in this codebase). */
  private toSettingsCaller(user: AuthenticatedUser) {
    return { id: user.id, role: user.role, branchId: user.branchId, branchIds: user.branchIds ?? [] };
  }
}
