import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { buildReadScope, requireWriteBranch } from '@modules/crm/services/branch-scope.util';
import { CreateTripScheduleDto, UpdateTripScheduleDto } from '../dto/trip-schedule.dto';

/** SAD Ch.5 Trip Scheduling — recurring definition. AF-004's Daily Trip Generation job materializes dated Trip rows from these. */
@Injectable()
export class TripScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, routeId?: string) {
    const scope = buildReadScope(user);
    return this.prisma.tripSchedule.findMany({
      where: { ...scope.where, ...(routeId ? { routeId } : {}) },
      orderBy: [{ routeId: 'asc' }, { departureTime: 'asc' }],
    });
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const scope = buildReadScope(user);
    const schedule = await this.prisma.tripSchedule.findFirst({ where: { ...scope.where, id } });
    if (!schedule) throw new NotFoundException('TripSchedule not found');
    return schedule;
  }

  async create(user: AuthenticatedUser, dto: CreateTripScheduleDto) {
    const { tenantId, branchId } = requireWriteBranch(user, dto.branchId);

    const route = await this.prisma.route.findFirst({ where: { id: dto.routeId, tenantId } });
    if (!route) throw new NotFoundException('Route not found');
    if (route.branchId && route.branchId !== branchId) {
      throw new NotFoundException('Route not found');
    }

    const schedule = await this.prisma.tripSchedule.create({
      data: {
        tenantId,
        branchId,
        routeId: dto.routeId,
        tripType: dto.tripType,
        departureTime: dto.departureTime,
        daysOfWeek: dto.daysOfWeek,
      },
    });

    await this.audit.logCreate({
      tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'TripSchedule',
      entityId: schedule.id,
      after: { routeId: dto.routeId, tripType: dto.tripType, departureTime: dto.departureTime },
    });

    return schedule;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateTripScheduleDto) {
    const before = await this.getOne(user, id);

    const data: Prisma.TripScheduleUpdateInput = {};
    if (dto.departureTime !== undefined) data.departureTime = dto.departureTime;
    if (dto.daysOfWeek !== undefined) data.daysOfWeek = dto.daysOfWeek;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const after = await this.prisma.tripSchedule.update({ where: { id }, data });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'TripSchedule',
      entityId: id,
      before: { departureTime: before.departureTime, isActive: before.isActive },
      after: { departureTime: after.departureTime, isActive: after.isActive },
    });

    return after;
  }

  /** No soft-delete field on TripSchedule — deactivate instead of removing, so past Trips keep a valid tripScheduleId. */
  async deactivate(user: AuthenticatedUser, id: string) {
    return this.update(user, id, { isActive: false });
  }
}
