import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { CreateTimetableSlotDto, UpdateTimetableSlotDto, BulkCreateTimetableDto } from '../dto/timetable.dto';

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  async createSlot(tenantId: string, dto: CreateTimetableSlotDto) {
    // Conflict check — same section + day + period
    const conflict = await this.prisma.timetableSlot.findFirst({
      where: {
        tenantId,
        sectionId: dto.sectionId,
        dayOfWeek: dto.dayOfWeek,
        periodNumber: dto.periodNumber,
        isActive: true,
      },
    });

    if (conflict) {
      throw new ConflictException(
        `${DAYS[dto.dayOfWeek]} Period ${dto.periodNumber} is already assigned for this section`,
      );
    }

    // Teacher conflict check — same teacher + day + period across sections
    const teacherConflict = await this.prisma.timetableSlot.findFirst({
      where: {
        tenantId,
        teacherId: dto.teacherId,
        dayOfWeek: dto.dayOfWeek,
        periodNumber: dto.periodNumber,
        isActive: true,
      },
    });

    if (teacherConflict) {
      throw new ConflictException(
        `Teacher is already assigned to another class on ${DAYS[dto.dayOfWeek]} Period ${dto.periodNumber}`,
      );
    }

    return this.prisma.timetableSlot.create({
      data: { tenantId, ...dto },
      include: {
        section: {
          include: {
            class: true,
          },
        },
      },
    });
  }
    
  async replaceSectionTimetable(
  tenantId: string,
  sectionId: string,
  slots: any[],
) {
  return this.prisma.$transaction(async (tx) => {

    await tx.timetableSlot.deleteMany({
      where: {
        tenantId,
        sectionId,
      },
    });

    if (slots.length === 0) {
      return {
        success: true,
        slotsReplaced: 0,
      };
    }

    const inserted = await tx.timetableSlot.createMany({
      data: slots.map((slot) => ({
        tenantId,
        sectionId,
        subjectId: slot.subjectId,
        teacherId: slot.teacherId,
        dayOfWeek: slot.dayOfWeek,
        periodNumber: slot.periodNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    });

    return {
      success: true,
      slotsReplaced: inserted.count,
    };
  });
}  



  async bulkCreate(tenantId: string, dto: BulkCreateTimetableDto) {
    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const slot of dto.slots) {
      try {
        await this.createSlot(tenantId, {
          ...slot,
          sectionId: dto.sectionId,
        });

        results.created++;
      } catch (e: any) {
        results.skipped++;
        results.errors.push(e.message);
      }
    }

    return results;
  }

  async getWeeklyTimetable(tenantId: string, sectionId: string) {
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId,
        sectionId,
        isActive: true,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { periodNumber: 'asc' },
      ],
    });

    const grid: Record<number, typeof slots> = {};

    for (let d = 1; d <= 6; d++) {
      grid[d] = slots.filter((s: any) => s.dayOfWeek === d);
    }

    return {
      sectionId,
      days: Object.entries(grid).map(([day, daySlots]) => ({
        day: parseInt(day),
        dayName: DAYS[parseInt(day)],
        slots: daySlots,
      })),
      totalSlots: slots.length,
    };
  }

  async getTeacherTimetable(tenantId: string, teacherId: string) {
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId,
        teacherId,
        isActive: true,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { periodNumber: 'asc' },
      ],
    });

    const grid: Record<number, typeof slots> = {};

    for (let d = 1; d <= 6; d++) {
      grid[d] = slots.filter((s: any) => s.dayOfWeek === d);
    }

    return {
      teacherId,
      days: Object.entries(grid).map(([day, daySlots]) => ({
        day: parseInt(day),
        dayName: DAYS[parseInt(day)],
        slots: daySlots,
      })),
    };
  }

  async updateSlot(
    tenantId: string,
    id: string,
    dto: UpdateTimetableSlotDto,
  ) {
    const slot = await this.prisma.timetableSlot.findFirst({
      where: { id, tenantId },
    });

    if (!slot) {
      throw new NotFoundException(`Timetable slot ${id} not found`);
    }

    return this.prisma.timetableSlot.update({
      where: { id },
      data: dto,
    });
  }

  async deleteSlot(tenantId: string, id: string) {
    const slot = await this.prisma.timetableSlot.findFirst({
      where: { id, tenantId },
    });

    if (!slot) {
      throw new NotFoundException(`Timetable slot ${id} not found`);
    }

    return this.prisma.timetableSlot.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async clearSection(tenantId: string, sectionId: string) {
    const result = await this.prisma.timetableSlot.updateMany({
      where: {
        tenantId,
        sectionId,
      },
      data: {
        isActive: false,
      },
    });

    return {
      cleared: result.count,
    };
  }

  /**
   * Rich timetable with subject + teacher names
   */
  async getWeeklyTimetableWithSubjects(
    tenantId: string,
    sectionId: string,
  ) {
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId,
        sectionId,
        isActive: true,
      },

      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },

        teacher: {
          select: {
            id: true,
            employeeId: true,

            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },

        section: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },

      orderBy: [
        { dayOfWeek: 'asc' },
        { periodNumber: 'asc' },
      ],
    });

    const grouped = new Map<number, typeof slots>();

    for (let d = 1; d <= 6; d++) {
      grouped.set(d, []);
    }

    for (const s of slots) {
      grouped.get((s as any).dayOfWeek as number)?.push(s);
    }

    return {
      sectionId,

      className:
        (slots[0] as any)?.section?.class?.name ?? null,

      days: Array.from(grouped.entries()).map(
        ([day, daySlots]) => ({
          day,
          dayName: DAYS[day],

          slots: daySlots.map((s: any) => ({
            id: s.id,
            periodNumber: s.periodNumber,
            startTime: s.startTime,
            endTime: s.endTime,

            subject: s.subject
              ? {
                  id: s.subject.id,
                  name: s.subject.name,
                  code: s.subject.code,
                }
              : null,

            teacher: s.teacher
              ? {
                  id: s.teacher.id,
                  employeeId: s.teacher.employeeId,

                  name: s.teacher.profile
                    ? `${s.teacher.profile.firstName} ${s.teacher.profile.lastName}`
                    : null,
                }
              : null,
          })),
        }),
      ),

      totalSlots: slots.length,
    };
  }
}
