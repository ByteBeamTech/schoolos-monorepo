import { Injectable, NotFoundException } from '@nestjs/common';
import { TripBoardingType } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { buildReadScope } from '@modules/crm/services/branch-scope.util';
import { MarkAttendanceDto } from '../dto/trip-attendance.dto';

/**
 * SAD Ch.5 Daily Operations: Boarding, Drop Attendance, Student No-show.
 * "No-show" isn't a separate mechanism — it's TripAttendanceStatus.ABSENT,
 * the same status a Transport Manager would use to mark a student didn't
 * board when expected.
 */
@Injectable()
export class TripAttendanceService {
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

  /** EVENING trips default to DROP attendance; everything else (MORNING/SPECIAL/EMERGENCY) defaults to PICKUP. Callers can always override explicitly. */
  private inferBoardingType(tripType: string, explicit?: TripBoardingType): TripBoardingType {
    if (explicit) return explicit;
    return tripType === 'EVENING' ? 'DROP' : 'PICKUP';
  }

  /**
   * The expected roster for a trip: every student with an ACTIVE
   * StudentTransportAssignment on the trip's route, joined against any
   * attendance already marked for that boardingType.
   */
  async getRoster(user: AuthenticatedUser, tripId: string, boardingType?: TripBoardingType) {
    const trip = await this.loadTrip(user, tripId);
    const effectiveBoardingType = this.inferBoardingType(trip.tripType, boardingType);

    const [assignments, marked] = await Promise.all([
      this.prisma.studentTransportAssignment.findMany({
        where: { routeId: trip.routeId, status: 'ACTIVE' },
        include: { student: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.tripAttendance.findMany({ where: { tripId, boardingType: effectiveBoardingType } }),
    ]);

    const markedByStudent = new Map(marked.map((m) => [m.studentId, m]));

    return {
      tripId,
      boardingType: effectiveBoardingType,
      roster: assignments.map((a) => ({
        studentId: a.studentId,
        studentName: `${a.student.firstName} ${a.student.lastName}`.trim(),
        assignmentId: a.id,
        attendanceStatus: markedByStudent.get(a.studentId)?.status ?? 'NOT_MARKED',
        markedAt: markedByStudent.get(a.studentId)?.markedAt ?? null,
      })),
    };
  }

  /** Marks (or re-marks) one student's Boarding/Drop attendance for a trip — upsert on (tripId, studentId, boardingType). */
  async markAttendance(user: AuthenticatedUser, tripId: string, dto: MarkAttendanceDto) {
    const trip = await this.loadTrip(user, tripId);
    const boardingType = this.inferBoardingType(trip.tripType, dto.boardingType);

    const existing = await this.prisma.tripAttendance.findFirst({
      where: { tripId, studentId: dto.studentId, boardingType },
    });

    const after = existing
      ? await this.prisma.tripAttendance.update({
          where: { id: existing.id },
          data: { status: dto.status, markedAt: new Date(), markedBy: user.id },
        })
      : await this.prisma.tripAttendance.create({
          data: {
            tenantId: trip.tenantId,
            tripId,
            studentId: dto.studentId,
            boardingType,
            status: dto.status,
            markedAt: new Date(),
            markedBy: user.id,
          },
        });

    if (existing) {
      await this.audit.logUpdate({
        tenantId: trip.tenantId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'TripAttendance',
        entityId: after.id,
        before: { status: existing.status },
        after: { status: after.status },
      });
    } else {
      await this.audit.logCreate({
        tenantId: trip.tenantId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'TripAttendance',
        entityId: after.id,
        after: { studentId: dto.studentId, boardingType, status: dto.status },
      });
    }

    return after;
  }
}
