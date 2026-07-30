import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { buildReadScope } from '@modules/crm/services/branch-scope.util';
import { ReportIncidentDto, ResolveIncidentDto } from '../dto/trip-incident.dto';

/** SAD Ch.5 Daily Operations: Driver Replacement, Vehicle Breakdown, Route Diversion, and general incidents, all logged against a Trip. */
@Injectable()
export class TripIncidentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async loadTrip(user: AuthenticatedUser, tripId: string) {
    const scope = buildReadScope(user);
    const trip = await this.prisma.trip.findFirst({ where: { ...scope.where, id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async list(user: AuthenticatedUser, tripId: string) {
    await this.loadTrip(user, tripId);
    return this.prisma.tripIncident.findMany({ where: { tripId }, orderBy: { reportedAt: 'desc' } });
  }

  async report(user: AuthenticatedUser, tripId: string, dto: ReportIncidentDto) {
    const trip = await this.loadTrip(user, tripId);

    const incident = await this.prisma.tripIncident.create({
      data: {
        tenantId: trip.tenantId,
        tripId,
        vehicleId: trip.vehicleId,
        driverId: trip.driverId,
        type: dto.type,
        severity: dto.severity,
        description: dto.description,
        reportedBy: user.id,
      },
    });

    await this.audit.logCreate({
      tenantId: trip.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'TripIncident',
      entityId: incident.id,
      after: { tripId, type: dto.type, severity: dto.severity },
    });

    return incident;
  }

  async resolve(user: AuthenticatedUser, tripId: string, incidentId: string, dto: ResolveIncidentDto) {
    await this.loadTrip(user, tripId);
    const before = await this.prisma.tripIncident.findFirst({ where: { id: incidentId, tripId } });
    if (!before) throw new NotFoundException('TripIncident not found');
    if (before.resolvedAt) {
      throw new BadRequestException('This incident has already been resolved');
    }

    const after = await this.prisma.tripIncident.update({
      where: { id: incidentId },
      data: { resolvedAt: new Date(), resolutionNotes: dto.resolutionNotes },
    });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'TripIncident',
      entityId: incidentId,
      before: { resolvedAt: before.resolvedAt },
      after: { resolvedAt: after.resolvedAt },
    });

    return after;
  }
}
