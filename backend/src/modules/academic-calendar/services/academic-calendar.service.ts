import { Injectable } from '@nestjs/common';
import { CreateCalendarEventDto } from '../dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from '../dto/update-calendar-event.dto';
import { CalendarQueryDto } from '../dto/calendar-query.dto';
import { PrismaService } from '@infra/database/prisma.service';

@Injectable()
export class AcademicCalendarService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

async seedDefaultIndianHolidays(
  tenantId: string,
  sessionId: string,
) {
  const session =
    await this.prisma.academicSession.findUnique({
      where: { id: sessionId },
    });

  if (!session) return;

  const startYear =
    session.startDate.getFullYear();

  const endYear =
    session.endDate.getFullYear();

  const holidays = [
    {
      title: 'Independence Day',
      date: new Date(startYear, 7, 15),
    },
    {
      title: 'Gandhi Jayanti',
      date: new Date(startYear, 9, 2),
    },
    {
      title: 'Christmas',
      date: new Date(startYear, 11, 25),
    },
    {
      title: 'Republic Day',
      date: new Date(endYear, 0, 26),
    },
  ];

  // create AcademicCalendarEvent rows
}

async createEvent(
  tenantId: string,
  branchId: string | null,
  actorId: string,
  sessionId: string,
  dto: CreateCalendarEventDto,
) {
  return this.prisma.academicCalendarEvent.create({
    data: {
      tenantId,
      branchId,
      sessionId,

      title: dto.title,
      description: dto.description,

      type: dto.type,
      scope: dto.scope ?? 'ALL_SCHOOL',
      audience: dto.audience ?? 'BOTH',

      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),

      isWorkingDay: dto.isWorkingDay ?? true,
      blocksAttendance: dto.blocksAttendance ?? false,
      isPublished: dto.isPublished ?? false,

      color: dto.color,
      isRecurring: dto.isRecurring ?? false,
      recurrenceRule: dto.recurrenceRule,

      createdBy: actorId,
    },
  });
}

async listEvents(
  tenantId: string,
  query: CalendarQueryDto,
) {
  return this.prisma.academicCalendarEvent.findMany({
    where: {
      tenantId,

      ...(query.sessionId && {
        sessionId: query.sessionId,
      }),

      ...(query.fromDate &&
        query.toDate && {
          startDate: {
            gte: new Date(query.fromDate),
          },
          endDate: {
            lte: new Date(query.toDate),
          },
        }),
    },

    orderBy: {
      startDate: 'asc',
    },
  });
}

async getMonthView(
  tenantId: string,
  sessionId: string,
  year: number,
  month: number,
) {
  const from = new Date(year, month - 1, 1);

  const to = new Date(
    year,
    month,
    0,
    23,
    59,
    59,
  );

  return this.prisma.academicCalendarEvent.findMany({
    where: {
      tenantId,
      sessionId,

      startDate: {
        lte: to,
      },

      endDate: {
        gte: from,
      },

      isPublished: true,
    },

    orderBy: {
      startDate: 'asc',
    },
  });
}

async updateEvent(
  tenantId: string,
  id: string,
  dto: UpdateCalendarEventDto,
) {
  return this.prisma.academicCalendarEvent.update({
    where: {
      id,
      tenantId,
    },

    data: {
      ...dto,

      ...(dto.startDate && {
        startDate: new Date(dto.startDate),
      }),

      ...(dto.endDate && {
        endDate: new Date(dto.endDate),
      }),
    },
  });
}

async deleteEvent(
  tenantId: string,
  id: string,
) {
  return this.prisma.academicCalendarEvent.delete({
    where: {
      id,
      tenantId,
    },
  });
}

async publishEvent(
  tenantId: string,
  id: string,
) {
  return this.prisma.academicCalendarEvent.update({
    where: {
      id,
      tenantId,
    },

    data: {
      isPublished: true,
    },
  });
}



}
