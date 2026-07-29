import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, RouteStatus } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { buildReadScope, requireWriteBranch } from '@modules/crm/services/branch-scope.util';
import { EVENTS } from '@core/events/events.constants';
import { CloneRouteDto, ConfirmSuspendRouteDto, CreateRouteDto, ListRoutesQueryDto, UpdateRouteDto } from '../dto/route.dto';

/**
 * SAD Ch.3/Ch.15 ADR-001: Route is the Planning Aggregate Root.
 * AF-003: Route has an explicit lifecycle (DRAFT/ACTIVE/SUSPENDED/ARCHIVED).
 */
@Injectable()
export class RouteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------
  // Phase 3 — Route Planning
  // ------------------------------------------------------------------

  async list(user: AuthenticatedUser, query: ListRoutesQueryDto) {
    const scope = buildReadScope(user, query.branchId);

    const where: Prisma.RouteWhereInput = { ...scope.where, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.search) where.name = { contains: query.search.trim(), mode: 'insensitive' };

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.route.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.route.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const scope = buildReadScope(user);
    const route = await this.prisma.route.findFirst({
      where: { ...scope.where, id, deletedAt: null },
    });
    if (!route) throw new NotFoundException('Route not found');
    return route;
  }

  /** New routes always start DRAFT (SAD Ch.4) — status is not caller-settable at creation. */
  async create(user: AuthenticatedUser, dto: CreateRouteDto) {
    const { tenantId, branchId } = requireWriteBranch(user, dto.branchId);

    const route = await this.prisma.route.create({
      data: { tenantId, branchId, name: dto.name.trim(), description: dto.description?.trim() },
    });

    await this.audit.logCreate({
      tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Route',
      entityId: route.id,
      after: { branchId, name: route.name, status: route.status },
    });

    return route;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateRouteDto) {
    const before = await this.getOne(user, id);

    const data: Prisma.RouteUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim();

    const after = await this.prisma.route.update({ where: { id }, data });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Route',
      entityId: id,
      before: { name: before.name },
      after: { name: after.name },
    });

    return after;
  }

  /** Logical deletion — only DRAFT routes (never activated) may be removed this way. */
  async remove(user: AuthenticatedUser, id: string) {
    const before = await this.getOne(user, id);
    if (before.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only a DRAFT route can be deleted. Suspend or archive an activated route instead.',
      );
    }

    const after = await this.prisma.route.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.audit.logDelete({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Route',
      entityId: id,
      before: { name: before.name },
    });

    return after;
  }

  /**
   * SAD Ch.4 Route Simulation — preview only, nothing is persisted.
   * Distance/ETA come from the route's RouteStops; estimated revenue sums
   * each pickup RouteStop's currently-active price across its active
   * StudentTransportAssignments (0 for now, until Phase 6 Student
   * Assignment exists — the schema and this query are already correct for
   * when it does).
   */
  async simulate(user: AuthenticatedUser, id: string) {
    await this.getOne(user, id);

    const routeStops = await this.prisma.routeStop.findMany({
      where: { routeId: id },
      orderBy: { sequence: 'asc' },
      include: {
        stop: true,
        pricing: { where: { isActive: true, effectiveTo: null } },
        pickupAssignments: { where: { status: 'ACTIVE' } },
      },
    });

    const totalDistanceKm = routeStops.reduce(
      (max, rs) => Math.max(max, Number(rs.distanceFromStartKm ?? 0)),
      0,
    );
    const totalEtaMinutes = routeStops.reduce(
      (max, rs) => Math.max(max, rs.etaMinutesFromStart ?? 0),
      0,
    );
    const occupancy = routeStops.reduce((sum, rs) => sum + rs.pickupAssignments.length, 0);
    const estimatedRevenue = routeStops.reduce((sum, rs) => {
      const price = rs.pricing[0]?.feeAmount ? Number(rs.pricing[0].feeAmount) : 0;
      return sum + price * rs.pickupAssignments.length;
    }, 0);

    return {
      routeId: id,
      stopCount: routeStops.length,
      totalDistanceKm,
      totalEtaMinutes,
      occupancy,
      estimatedRevenue,
      stops: routeStops.map((rs) => ({
        routeStopId: rs.id,
        stopName: rs.stop.name,
        sequence: rs.sequence,
        distanceFromStartKm: rs.distanceFromStartKm,
        etaMinutesFromStart: rs.etaMinutesFromStart,
        activePickups: rs.pickupAssignments.length,
      })),
    };
  }

  // ------------------------------------------------------------------
  // Phase 4 — Route Lifecycle (AF-003 state machine)
  // ------------------------------------------------------------------

  /** DRAFT|SUSPENDED -> ACTIVE. Requires at least one RouteStop. */
  async activate(user: AuthenticatedUser, id: string) {
    const before = await this.getOne(user, id);
    if (before.status !== 'DRAFT' && before.status !== 'SUSPENDED') {
      throw new BadRequestException(`Cannot activate a route in status ${before.status}`);
    }

    const stopCount = await this.prisma.routeStop.count({ where: { routeId: id } });
    if (stopCount === 0) {
      throw new BadRequestException('A route needs at least one stop before it can be activated');
    }

    const after = await this.publishAndAudit(user, before, 'ACTIVE', EVENTS.ROUTE_ACTIVATED);
    return after;
  }

  /** ACTIVE|SUSPENDED -> ARCHIVED. Terminal state (SAD Ch.4). */
  async archive(user: AuthenticatedUser, id: string) {
    const before = await this.getOne(user, id);
    if (before.status !== 'ACTIVE' && before.status !== 'SUSPENDED') {
      throw new BadRequestException(`Cannot archive a route in status ${before.status}`);
    }

    const after = await this.prisma.route.update({ where: { id }, data: { status: 'ARCHIVED' } });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Route',
      entityId: id,
      before: { status: before.status },
      after: { status: after.status },
    });

    return after;
  }

  /** Clones a route's stops (not its pricing) into a new DRAFT route (SAD Ch.8: Clone). */
  async clone(user: AuthenticatedUser, id: string, dto: CloneRouteDto) {
    const source = await this.getOne(user, id);
    const sourceStops = await this.prisma.routeStop.findMany({ where: { routeId: id } });

    const cloned = await this.prisma.$transaction(async (tx) => {
      const route = await tx.route.create({
        data: {
          tenantId: source.tenantId,
          branchId: source.branchId,
          name: dto.name.trim(),
          description: source.description,
        },
      });

      if (sourceStops.length > 0) {
        await tx.routeStop.createMany({
          data: sourceStops.map((rs) => ({
            tenantId: source.tenantId,
            routeId: route.id,
            stopId: rs.stopId,
            sequence: rs.sequence,
            distanceFromStartKm: rs.distanceFromStartKm,
            etaMinutesFromStart: rs.etaMinutesFromStart,
            boardingOrder: rs.boardingOrder,
          })),
        });
      }

      return route;
    });

    await this.audit.logCreate({
      tenantId: source.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Route',
      entityId: cloned.id,
      after: { clonedFromRouteId: id, stopCount: sourceStops.length },
    });

    return cloned;
  }

  /**
   * AF-007 Operational Wizard Framework, step Preview/Impact Analysis, for
   * the Route Suspend operation (one of AF-007's explicitly listed
   * applicable operations). Read-only — nothing is changed or persisted.
   */
  async previewSuspend(user: AuthenticatedUser, id: string) {
    const route = await this.getOne(user, id);
    if (route.status !== 'ACTIVE') {
      throw new BadRequestException(`Cannot suspend a route in status ${route.status}`);
    }

    const [affectedAssignments, upcomingTrips] = await this.prisma.$transaction([
      this.prisma.studentTransportAssignment.findMany({
        where: { routeId: id, status: 'ACTIVE' },
        select: { id: true, studentId: true },
      }),
      this.prisma.trip.findMany({
        where: { routeId: id, status: 'SCHEDULED', tripDate: { gte: new Date() } },
        select: { id: true, tripDate: true },
      }),
    ]);

    const impactToken = this.computeImpactToken(id, affectedAssignments, upcomingTrips);

    return {
      routeId: id,
      routeName: route.name,
      affectedStudentCount: affectedAssignments.length,
      affectedStudentIds: affectedAssignments.map((a) => a.studentId),
      upcomingTripCount: upcomingTrips.length,
      upcomingTripIds: upcomingTrips.map((t) => t.id),
      impactToken,
    };
  }

  /**
   * AF-007 steps Execute (Transaction) -> Publish Domain Events -> Audit ->
   * Completion Report. `impactToken` must match a fresh recompute of the
   * same impact analysis the caller previewed — if the underlying data
   * changed since the preview (a new assignment, a cancelled trip), this
   * rejects and asks the caller to re-preview rather than executing against
   * stale impact data.
   */
  async confirmSuspend(user: AuthenticatedUser, id: string, dto: ConfirmSuspendRouteDto) {
    const route = await this.getOne(user, id);
    if (route.status !== 'ACTIVE') {
      throw new BadRequestException(`Cannot suspend a route in status ${route.status}`);
    }

    const [affectedAssignments, upcomingTrips] = await this.prisma.$transaction([
      this.prisma.studentTransportAssignment.findMany({
        where: { routeId: id, status: 'ACTIVE' },
        select: { id: true, studentId: true },
      }),
      this.prisma.trip.findMany({
        where: { routeId: id, status: 'SCHEDULED', tripDate: { gte: new Date() } },
        select: { id: true, tripDate: true },
      }),
    ]);

    const currentToken = this.computeImpactToken(id, affectedAssignments, upcomingTrips);
    if (currentToken !== dto.impactToken) {
      throw new ConflictException(
        'The impact analysis has changed since it was last previewed. Please re-run the preview and confirm again.',
      );
    }

    const after = await this.publishAndAudit(user, route, 'SUSPENDED', EVENTS.ROUTE_SUSPENDED, {
      reason: dto.reason,
      affectedStudentCount: affectedAssignments.length,
      upcomingTripCount: upcomingTrips.length,
    });

    return {
      route: after,
      completionReport: {
        affectedStudentCount: affectedAssignments.length,
        upcomingTripCount: upcomingTrips.length,
        reason: dto.reason ?? null,
      },
    };
  }

  private computeImpactToken(
    routeId: string,
    assignments: { id: string }[],
    trips: { id: string }[],
  ): string {
    const material = [
      routeId,
      ...assignments.map((a) => a.id).sort(),
      ...trips.map((t) => t.id).sort(),
    ].join('|');
    return createHash('sha256').update(material).digest('hex').slice(0, 16);
  }

  /**
   * Atomically applies the Route status transition and writes the AF-008
   * domain event (EventOutbox), then logs the audit entry best-effort
   * afterwards. Audit is intentionally not part of the DB transaction: no
   * other call site in this codebase passes a transaction client into
   * AuditService (`grep -rn "audit\.log.*,\s*tx"` turns up nothing), and
   * PrismaTransactionClient — derived from the PrismaService wrapper class
   * (onModuleInit/onModuleDestroy/isHealthy/forTenant) — doesn't structurally
   * match what `$transaction`'s callback actually infers (based on the raw
   * PrismaClient), so passing tx through fails to compile (TS2345). The
   * route-status-change + event-publish pair is the part that must be
   * atomic; audit logging follows the same best-effort convention already
   * used everywhere else.
   */
  private async publishAndAudit(
    user: AuthenticatedUser,
    before: { id: string; tenantId: string; branchId: string | null; status: string },
    newStatus: RouteStatus,
    eventType: string,
    extraPayload: Record<string, unknown> = {},
  ) {
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.route.update({ where: { id: before.id }, data: { status: newStatus } });

      await tx.eventOutbox.create({
        data: {
          uniqueKey: `${eventType}:${before.id}:${Date.now()}`,
          type: eventType,
          payload: {
            core: { tenantId: before.tenantId, branchId: before.branchId },
            eventType,
            aggregateType: 'Route',
            aggregateId: before.id,
            performedBy: user.id,
            routeId: before.id,
            previousStatus: before.status,
            newStatus: updated.status,
            ...extraPayload,
          },
        },
      });

      return updated;
    });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Route',
      entityId: before.id,
      before: { status: before.status },
      after: { status: after.status },
    });

    return after;
  }
}
