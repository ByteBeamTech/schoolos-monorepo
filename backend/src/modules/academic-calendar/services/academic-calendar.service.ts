import { NotFoundException, Injectable } from '@nestjs/common';
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
  actorId: string,
) 


{
  const session =
    await this.prisma.academicSession.findUnique({
      where: { id: sessionId, tenantId },
    });

  if (!session) return;

  const startYear =
    session.startDate.getFullYear();

  const endYear =
    session.endDate.getFullYear();

const holidays = [
  {
    title: 'Independence Day',
    date: new Date(Date.UTC(startYear, 7, 15)),
  },
  {
    title: 'Gandhi Jayanti',
    date: new Date(Date.UTC(startYear, 9, 2)),
  },
  {
    title: 'Christmas',
    date: new Date(Date.UTC(startYear, 11, 25)),
  },
  {
    title: 'Republic Day',
    date: new Date(Date.UTC(endYear, 0, 26)),
  },
];
  // create AcademicCalendarEvent rows
const created = [];

for (const holiday of holidays) {
  const existing =
    await this.prisma.academicCalendarEvent.findFirst({
      where: {
        tenantId,
        sessionId,
        title: holiday.title,
      },
    });

  if (existing) continue;

  const event =
    await this.prisma.academicCalendarEvent.create({
      data: {
        tenantId,
        sessionId,

        title: holiday.title,
        type: 'NATIONAL_HOLIDAY',

        startDate: holiday.date,
        endDate: holiday.date,

        isWorkingDay: false,
        blocksAttendance: true,
        isPublished: true,

        scope: 'ALL_SCHOOL',
        audience: 'BOTH',

        createdBy: actorId,
      },
    });

  created.push(event);
}

return {
  seeded: created.length,
  events: created,
};


}


async createEvent(
  tenantId: string,
  branchId: string | null,
  actorId: string,
  sessionId: string,
  dto: CreateCalendarEventDto,
) {
  const event =
    await this.prisma.academicCalendarEvent.create({
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

  // Save target rows


if (
  dto.targets?.length &&
  dto.scope !== 'ALL_SCHOOL'
) {

  for (const target of dto.targets) {

    if (target.classId) {

      const cls =
        await this.prisma.class.findFirst({
          where: {
            id: target.classId,
            tenantId,
          },
        });

      if (!cls) {
        throw new Error(
          `Invalid class: ${target.classId}`,
        );
      }
    }

    if (target.sectionId) {

      const section =
        await this.prisma.section.findFirst({
          where: {
            id: target.sectionId,
            tenantId,
          },
        });

      if (!section) {
        throw new Error(
          `Invalid section: ${target.sectionId}`,
        );
      }
    }
  }

  await this.prisma.academicCalendarEventTarget.createMany({
    data: dto.targets.map(target => ({
      eventId: event.id,
      classId: target.classId ?? null,
      sectionId: target.sectionId ?? null,
    })),
  });
}
 return event;
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

    include: {
    targets: true,
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
  const {
    targets,
    sessionId,
    startDate,
    endDate,
    ...updateData
  } = dto;


const event =
  await this.prisma.academicCalendarEvent.findFirst({
    where: {
      id,
      tenantId,
    },
  });

if (!event) {
  throw new NotFoundException(
    'Calendar event not found',
  );
}




  return this.prisma.academicCalendarEvent.update({
    where: {
      id: event.id,
    },

    data: {
      ...updateData,

      ...(startDate && {
        startDate: new Date(startDate),
      }),

      ...(endDate && {
        endDate: new Date(endDate),
      }),
    },
  });
}



async deleteEvent(
  tenantId: string,
  id: string,
) {
  const event =
    await this.prisma.academicCalendarEvent.findFirst({
      where: {
        id,
        tenantId,
      },
    });

  if (!event) {
    throw new NotFoundException(
      'Calendar event not found',
    );
  }

  return this.prisma.academicCalendarEvent.delete({
    where: {
      id: event.id,
    },
  });
}
async publishEvent(
  tenantId: string,
  id: string,
) {

      


const event =
  await this.prisma.academicCalendarEvent.findFirst({
    where: {
      id,
      tenantId,
    },
  });

if (!event) {
  throw new NotFoundException(
    'Calendar event not found',
  );
}

return this.prisma.academicCalendarEvent.update({
  where: {
    id: event.id,
  },



    data: {
      isPublished: true,
    },
  });
}

async unpublishEvent(
  tenantId: string,
  id: string,
) {
  
	
const event =
  await this.prisma.academicCalendarEvent.findFirst({
    where: {
      id,
      tenantId,
    },
  });

if (!event) {
  throw new NotFoundException(
    'Calendar event not found',
  );
}

return this.prisma.academicCalendarEvent.update({
  where: {
    id: event.id,
  },


    data: {
      isPublished: false,
    },
  });
}

}
