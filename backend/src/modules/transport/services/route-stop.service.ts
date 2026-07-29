import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { buildReadScope } from '@modules/crm/services/branch-scope.util';
import { AddRouteStopDto, ReorderRouteStopsDto, UpdateRouteStopDto } from '../dto/route-stop.dto';

/** Prisma Client's error code for a unique constraint violation. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

/**
 * SAD Ch.4: RouteStop represents the relationship between a Route and a
 * physical Stop (ADR-001: RouteStop cannot exist independently of Route).
 * Scoped through the parent Route's tenant/branch — RouteStop itself has no
 * branchId column.
 */
@Injectable()
export class RouteStopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Loads the parent Route within the caller's branch scope, or throws. */
  private async loadRoute(user: AuthenticatedUser, routeId: string) {
    const scope = buildReadScope(user);
    const route = await this.prisma.route.findFirst({
      where: { ...scope.where, id: routeId, deletedAt: null },
    });
    if (!route) throw new NotFoundException('Route not found');
    return route;
  }

  async list(user: AuthenticatedUser, routeId: string) {
    await this.loadRoute(user, routeId);
    return this.prisma.routeStop.findMany({
      where: { routeId },
      orderBy: { sequence: 'asc' },
      include: { stop: true },
    });
  }

  async add(user: AuthenticatedUser, routeId: string, dto: AddRouteStopDto) {
    const route = await this.loadRoute(user, routeId);

    const stop = await this.prisma.stop.findFirst({
      where: { id: dto.stopId, tenantId: route.tenantId, deletedAt: null },
    });
    if (!stop) throw new NotFoundException('Stop not found');

    try {
      const routeStop = await this.prisma.routeStop.create({
        data: {
          tenantId: route.tenantId,
          routeId,
          stopId: dto.stopId,
          sequence: dto.sequence,
          distanceFromStartKm: dto.distanceFromStartKm,
          etaMinutesFromStart: dto.etaMinutesFromStart,
          boardingOrder: dto.boardingOrder,
        },
      });

      await this.audit.logCreate({
        tenantId: route.tenantId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'RouteStop',
        entityId: routeStop.id,
        after: { routeId, stopId: dto.stopId, sequence: dto.sequence },
      });

      return routeStop;
    } catch (err: any) {
      if (err?.code === PRISMA_UNIQUE_VIOLATION) {
        throw new ConflictException('This stop is already on this route');
      }
      throw err;
    }
  }

  async update(user: AuthenticatedUser, routeId: string, routeStopId: string, dto: UpdateRouteStopDto) {
    await this.loadRoute(user, routeId);
    const before = await this.prisma.routeStop.findFirst({ where: { id: routeStopId, routeId } });
    if (!before) throw new NotFoundException('RouteStop not found');

    const data: Prisma.RouteStopUpdateInput = {};
    if (dto.sequence !== undefined) data.sequence = dto.sequence;
    if (dto.distanceFromStartKm !== undefined) data.distanceFromStartKm = dto.distanceFromStartKm;
    if (dto.etaMinutesFromStart !== undefined) data.etaMinutesFromStart = dto.etaMinutesFromStart;
    if (dto.boardingOrder !== undefined) data.boardingOrder = dto.boardingOrder;

    const after = await this.prisma.routeStop.update({ where: { id: routeStopId }, data });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'RouteStop',
      entityId: routeStopId,
      before: { sequence: before.sequence },
      after: { sequence: after.sequence },
    });

    return after;
  }

  /** Reassigns `sequence` 0..n-1 to match the given order (Ch.4: Sequence). */
  async reorder(user: AuthenticatedUser, routeId: string, dto: ReorderRouteStopsDto) {
    const route = await this.loadRoute(user, routeId);

    const existing = await this.prisma.routeStop.findMany({ where: { routeId } });
    const existingIds = new Set(existing.map((r) => r.id));
    if (
      dto.routeStopIds.length !== existing.length ||
      !dto.routeStopIds.every((id) => existingIds.has(id))
    ) {
      throw new BadRequestException('routeStopIds must be exactly the current set of stops on this route');
    }

    await this.prisma.$transaction(
      dto.routeStopIds.map((id, index) =>
        this.prisma.routeStop.update({ where: { id }, data: { sequence: index } }),
      ),
    );

    await this.audit.logUpdate({
      tenantId: route.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Route',
      entityId: routeId,
      before: {},
      after: { reorderedStopCount: dto.routeStopIds.length },
    });

    return this.list(user, routeId);
  }

  /** RouteStop has no deletedAt (it's a pure join row, not a master record) — hard delete. */
  async remove(user: AuthenticatedUser, routeId: string, routeStopId: string) {
    await this.loadRoute(user, routeId);
    const before = await this.prisma.routeStop.findFirst({ where: { id: routeStopId, routeId } });
    if (!before) throw new NotFoundException('RouteStop not found');

    const activeAssignment = await this.prisma.studentTransportAssignment.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [{ pickupRouteStopId: routeStopId }, { dropRouteStopId: routeStopId }],
      },
      select: { id: true },
    });
    if (activeAssignment) {
      throw new BadRequestException(
        'This stop has active student assignments and cannot be removed from the route',
      );
    }

    await this.prisma.routeStop.delete({ where: { id: routeStopId } });

    await this.audit.logDelete({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'RouteStop',
      entityId: routeStopId,
      before: { routeId, stopId: before.stopId },
    });
  }
}
