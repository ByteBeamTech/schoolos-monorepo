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

    const event =
      await this.prisma.academicCalendarEvent.findFirst({
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
        orderBy: {
          startDate: 'desc',
        },
      });

    if (event) {
      return {
        workingDay: false,
        reason: event.title,
        eventId: event.id,
      };
    }

    return {
      workingDay: true,
      reason: null,
      eventId: null,
    };
  }
}
