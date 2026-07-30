import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TripType } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { buildReadScope, requireWriteBranch } from '@modules/crm/services/branch-scope.util';
import { EVENTS } from '@core/events/events.constants';
import {
  AssignTripResourcesDto,
  CancelTripDto,
  CreateTripDto,
  ListTripsQueryDto,
} from '../dto/trip.dto';
import { ReplaceTripResourceDto } from '../dto/trip-incident.dto';

/**
 * SAD Ch.5/Ch.8/Ch.15 ADR-003: Vehicle, Driver and Conductor are assigned at
 * Trip level (not Route level) — supports replacements and multiple trips
 * per day. AF-003: explicit Trip lifecycle
 * (SCHEDULED -> RUNNING -> COMPLETED, or -> CANCELLED).
 */
@Injectable()
export class TripService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: ListTripsQueryDto) {
    const scope = buildReadScope(user, query.branchId);

    const where: Prisma.TripWhereInput = { ...scope.where };
    if (query.routeId) where.routeId = query.routeId;
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.status) where.status = query.status;
    if (query.date) where.tripDate = new Date(query.date);
    else if (query.dateFrom || query.dateTo) {
      where.tripDate = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        orderBy: [{ tripDate: 'desc' }, { tripType: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.trip.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const scope = buildReadScope(user);
    const trip = await this.prisma.trip.findFirst({ where: { ...scope.where, id } });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  /**
   * Rejects if any of the given resources (vehicle/driver/conductor) is
   * already on a non-cancelled Trip for the same date+tripType (Ch.8
   * validation: "Date overlaps"). Multiple trips per day for the same
   * resource are fine (Ch.5: "Multiple Trips per Day") as long as they're
   * different tripTypes — a vehicle can't run two MORNING trips at once.
   */
  private async assertResourcesAvailable(
    tenantId: string,
    tripDate: Date,
    tripType: TripType,
    resources: { vehicleId?: string | null; driverId?: string | null; conductorId?: string | null },
    excludeTripId?: string,
  ) {
    const checks: { field: 'vehicleId' | 'driverId' | 'conductorId'; label: string }[] = [
      { field: 'vehicleId', label: 'vehicle' },
      { field: 'driverId', label: 'driver' },
      { field: 'conductorId', label: 'conductor' },
    ];

    for (const { field, label } of checks) {
      const resourceId = resources[field];
      if (!resourceId) continue;

      const clash = await this.prisma.trip.findFirst({
        where: {
          tenantId,
          tripDate,
          tripType,
          status: { in: ['SCHEDULED', 'RUNNING'] },
          [field]: resourceId,
          ...(excludeTripId ? { id: { not: excludeTripId } } : {}),
        },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException(`This ${label} is already assigned to another ${tripType} trip on this date`);
      }
    }
  }

  async create(user: AuthenticatedUser, dto: CreateTripDto) {
    const tenantId = user.tenantId;
    const scope = buildReadScope(user);

    const route = await this.prisma.route.findFirst({ where: { ...scope.where, id: dto.routeId } });
    if (!route) throw new NotFoundException('Route not found');

    const tripDate = new Date(dto.tripDate);
    await this.assertResourcesAvailable(tenantId, tripDate, dto.tripType, dto);

    const trip = await this.prisma.trip.create({
      data: {
        tenantId,
        branchId: route.branchId,
        routeId: dto.routeId,
        tripType: dto.tripType,
        tripDate,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId,
        conductorId: dto.conductorId,
      },
    });

    await this.audit.logCreate({
      tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Trip',
      entityId: trip.id,
      after: { routeId: dto.routeId, tripType: dto.tripType, tripDate: dto.tripDate },
    });

    return trip;
  }

  /** ADR-003: assign or replace Vehicle/Driver/Conductor. Only while the Trip is still SCHEDULED. */
  async assignResources(user: AuthenticatedUser, id: string, dto: AssignTripResourcesDto) {
    const before = await this.getOne(user, id);
    if (before.status !== 'SCHEDULED') {
      throw new BadRequestException(
        `Cannot change resource assignment on a trip in status ${before.status}. ` +
          'Driver/vehicle replacement mid-trip is a Daily Operations concern.',
      );
    }

    await this.assertResourcesAvailable(
      before.tenantId,
      before.tripDate,
      before.tripType,
      {
        vehicleId: dto.vehicleId !== undefined ? dto.vehicleId : before.vehicleId,
        driverId: dto.driverId !== undefined ? dto.driverId : before.driverId,
        conductorId: dto.conductorId !== undefined ? dto.conductorId : before.conductorId,
      },
      id,
    );

    const data: Prisma.TripUpdateInput = {};
    if (dto.vehicleId !== undefined) {
      data.vehicle = dto.vehicleId ? { connect: { id: dto.vehicleId } } : { disconnect: true };
    }
    if (dto.driverId !== undefined) {
      data.driver = dto.driverId ? { connect: { id: dto.driverId } } : { disconnect: true };
    }
    if (dto.conductorId !== undefined) {
      data.conductor = dto.conductorId ? { connect: { id: dto.conductorId } } : { disconnect: true };
    }

    const after = await this.prisma.trip.update({ where: { id }, data });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Trip',
      entityId: id,
      before: { vehicleId: before.vehicleId, driverId: before.driverId, conductorId: before.conductorId },
      after: { vehicleId: after.vehicleId, driverId: after.driverId, conductorId: after.conductorId },
    });

    return after;
  }

  /**
   * Ch.5 Daily Operations: Driver Replacement / Vehicle Breakdown. Unlike
   * assignResources() above (Phase 5, SCHEDULED-only), this is allowed while
   * a trip is RUNNING — that's the whole point: something went wrong
   * mid-trip and a resource needs swapping without cancelling the trip.
   * Logs a TripIncident (VEHICLE_BREAKDOWN and/or DRIVER_REPLACEMENT)
   * against the *previous* resource, atomically with the swap.
   */
  async replaceResource(user: AuthenticatedUser, id: string, dto: ReplaceTripResourceDto) {
    const before = await this.getOne(user, id);
    if (before.status !== 'RUNNING' && before.status !== 'SCHEDULED') {
      throw new BadRequestException(`Cannot replace resources on a trip in status ${before.status}`);
    }
    if (!dto.vehicleId && !dto.driverId) {
      throw new BadRequestException('Provide at least a new vehicleId or driverId');
    }

    await this.assertResourcesAvailable(
      before.tenantId,
      before.tripDate,
      before.tripType,
      { vehicleId: dto.vehicleId ?? before.vehicleId, driverId: dto.driverId ?? before.driverId },
      id,
    );

    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.trip.update({
        where: { id },
        data: {
          ...(dto.vehicleId ? { vehicle: { connect: { id: dto.vehicleId } } } : {}),
          ...(dto.driverId ? { driver: { connect: { id: dto.driverId } } } : {}),
        },
      });

      if (dto.vehicleId) {
        await tx.tripIncident.create({
          data: {
            tenantId: before.tenantId,
            tripId: id,
            vehicleId: before.vehicleId,
            driverId: before.driverId,
            type: 'VEHICLE_BREAKDOWN',
            severity: 'MEDIUM',
            description: dto.reason,
            reportedBy: user.id,
          },
        });
        await this.writeTripEvent(tx, EVENTS.VEHICLE_ASSIGNED, before, user, { newVehicleId: dto.vehicleId });
      }
      if (dto.driverId) {
        await tx.tripIncident.create({
          data: {
            tenantId: before.tenantId,
            tripId: id,
            vehicleId: before.vehicleId,
            driverId: before.driverId,
            type: 'DRIVER_REPLACEMENT',
            severity: 'MEDIUM',
            description: dto.reason,
            reportedBy: user.id,
          },
        });
        await this.writeTripEvent(tx, EVENTS.DRIVER_ASSIGNED, before, user, { newDriverId: dto.driverId });
      }

      return updated;
    });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Trip',
      entityId: id,
      before: { vehicleId: before.vehicleId, driverId: before.driverId },
      after: { vehicleId: after.vehicleId, driverId: after.driverId },
    });

    return after;
  }

  /** SCHEDULED -> RUNNING. Requires a Vehicle and Driver already assigned. */
  async start(user: AuthenticatedUser, id: string) {
    const before = await this.getOne(user, id);
    if (before.status !== 'SCHEDULED') {
      throw new BadRequestException(`Cannot start a trip in status ${before.status}`);
    }
    if (!before.vehicleId || !before.driverId) {
      throw new BadRequestException('A trip needs a Vehicle and a Driver assigned before it can start');
    }

    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.trip.update({
        where: { id },
        data: { status: 'RUNNING', startedAt: new Date() },
      });
      await this.writeTripEvent(tx, EVENTS.TRIP_STARTED, before, user);
      return updated;
    });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Trip',
      entityId: id,
      before: { status: before.status },
      after: { status: after.status },
    });

    return after;
  }

  /** RUNNING -> COMPLETED. */
  async complete(user: AuthenticatedUser, id: string) {
    const before = await this.getOne(user, id);
    if (before.status !== 'RUNNING') {
      throw new BadRequestException(`Cannot complete a trip in status ${before.status}`);
    }

    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.trip.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await this.writeTripEvent(tx, EVENTS.TRIP_COMPLETED, before, user);
      return updated;
    });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Trip',
      entityId: id,
      before: { status: before.status },
      after: { status: after.status },
    });

    return after;
  }

  /** SCHEDULED|RUNNING -> CANCELLED. */
  async cancel(user: AuthenticatedUser, id: string, dto: CancelTripDto) {
    const before = await this.getOne(user, id);
    if (before.status !== 'SCHEDULED' && before.status !== 'RUNNING') {
      throw new BadRequestException(`Cannot cancel a trip in status ${before.status}`);
    }

    const after = await this.prisma.trip.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: dto.reason },
    });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Trip',
      entityId: id,
      before: { status: before.status },
      after: { status: after.status, cancelReason: dto.reason },
    });

    return after;
  }

  /**
   * AF-004 Daily Trip Generation. Materializes a Trip for `date` from every
   * active TripSchedule whose daysOfWeek includes that date's weekday and
   * that doesn't already have one (the @@unique([tripScheduleId, tripDate])
   * constraint is the actual backstop; createMany({ skipDuplicates: true })
   * makes this idempotent so re-running it for the same date is safe).
   */
  async generateForBranchAndDate(tenantId: string, branchId: string | undefined, date: Date) {
    const weekday = date.getUTCDay();

    const schedules = await this.prisma.tripSchedule.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        isActive: true,
        daysOfWeek: { has: weekday },
      },
    });

    if (schedules.length === 0) return { created: 0, scheduleCount: 0 };

    const result = await this.prisma.trip.createMany({
      data: schedules.map((s) => ({
        tenantId: s.tenantId,
        branchId: s.branchId,
        routeId: s.routeId,
        tripScheduleId: s.id,
        tripType: s.tripType,
        tripDate: date,
      })),
      skipDuplicates: true,
    });

    return { created: result.count, scheduleCount: schedules.length };
  }

  /** Manual trigger (used when TransportSettings.tripGenerationMode is MANUAL — see Phase 0.5 AF-002). */
  async generateForDate(user: AuthenticatedUser, dateStr?: string) {
    const { tenantId, branchId } = requireWriteBranch(user);
    const date = dateStr ? new Date(dateStr) : new Date();

    const result = await this.generateForBranchAndDate(tenantId, branchId, date);

    await this.audit.logCreate({
      tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Trip',
      entityId: `generation:${branchId}:${date.toISOString().slice(0, 10)}`,
      after: result,
    });

    return result;
  }

  /** AF-008 event envelope via EventOutbox, written inside the caller's transaction. */
  private async writeTripEvent(
    tx: Prisma.TransactionClient,
    eventType: string,
    trip: { id: string; tenantId: string; branchId: string | null; routeId: string },
    user: AuthenticatedUser,
    extraPayload: Record<string, unknown> = {},
  ) {
    await tx.eventOutbox.create({
      data: {
        uniqueKey: `${eventType}:${trip.id}:${Date.now()}`,
        type: eventType,
        payload: {
          core: { tenantId: trip.tenantId, branchId: trip.branchId },
          eventType,
          aggregateType: 'Trip',
          aggregateId: trip.id,
          performedBy: user.id,
          tripId: trip.id,
          routeId: trip.routeId,
          ...extraPayload,
        },
      },
    });
  }
}
