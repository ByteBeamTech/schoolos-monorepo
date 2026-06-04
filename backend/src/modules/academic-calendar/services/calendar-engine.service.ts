import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';

@Injectable()
export class CalendarEngineService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}
async isWorkingDay(
  tenantId: string,
  date: Date,
  classId?: string,
  sectionId?: string,
) {
  const day = date.getUTCDay();

  // Sunday
  if (day === 0) {
    return {
      workingDay: false,
      reason: 'Sunday',
      eventId: null,
    };
  }

  const events =
    await this.prisma.academicCalendarEvent.findMany({
      where: {
        tenantId,
        isPublished: true,
        blocksAttendance: true,

        startDate: {
          lte: date,
        },

        endDate: {
          gte: date,
        },
      },

      include: {
        targets: true,
      },
    });

  for (const event of events) {

    // Entire school holiday
    if (event.scope === 'ALL_SCHOOL') {
      return {
        workingDay: false,
        reason: event.title,
        eventId: event.id,
      };
    }

    // Class specific holiday
    if (
      event.scope === 'CLASS' &&
      classId
    ) {
      const applies =
        event.targets.some(
          target => target.classId === classId,
        );

      if (applies) {
        return {
          workingDay: false,
          reason: event.title,
          eventId: event.id,
        };
      }
    }

    // Section specific holiday
    if (
      event.scope === 'SECTION' &&
      sectionId
    ) {
      const applies =
        event.targets.some(
          target => target.sectionId === sectionId,
        );

      if (applies) {
        return {
          workingDay: false,
          reason: event.title,
          eventId: event.id,
        };
      }
    }
  }

  return {
    workingDay: true,
    reason: null,
    eventId: null,
  };
}
}
