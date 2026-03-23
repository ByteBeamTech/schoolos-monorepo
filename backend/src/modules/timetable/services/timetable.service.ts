import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma.service';
import { CreateTimetableSlotDto, UpdateTimetableSlotDto, BulkCreateTimetableDto } from '../dto/timetable.dto';

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  async createSlot(tenantId: string, dto: CreateTimetableSlotDto) {
    // Conflict check — same section + day + period
    const conflict = await this.prisma.timetableSlot.findFirst({
      where: { tenantId, sectionId: dto.sectionId, dayOfWeek: dto.dayOfWeek, periodNumber: dto.periodNumber, isActive: true },
    });
    if (conflict) throw new ConflictException(
      `${DAYS[dto.dayOfWeek]} Period ${dto.periodNumber} is already assigned for this section`
    );

    // Teacher conflict check — same teacher + day + period across sections
    const teacherConflict = await this.prisma.timetableSlot.findFirst({
      where: { tenantId, teacherId: dto.teacherId, dayOfWeek: dto.dayOfWeek, periodNumber: dto.periodNumber, isActive: true },
    });
    if (teacherConflict) throw new ConflictException(
      `Teacher is already assigned to another class on ${DAYS[dto.dayOfWeek]} Period ${dto.periodNumber}`
    );

    return this.prisma.timetableSlot.create({
      data: { tenantId, ...dto },
      include: {
        section: { include: { class: true } },
      },
    });
  }

  async bulkCreate(tenantId: string, dto: BulkCreateTimetableDto) {
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const slot of dto.slots) {
      try {
        await this.createSlot(tenantId, { ...slot, sectionId: dto.sectionId });
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
      where:   { tenantId, sectionId, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });

    // Group by day
    const grid: Record<number, typeof slots> = {};
    for (let d = 1; d <= 6; d++) {
      grid[d] = slots.filter((s: any) => s.dayOfWeek === d);
    }

    return {
      sectionId,
      days: Object.entries(grid).map(([day, daySlots]) => ({
        day:     parseInt(day),
        dayName: DAYS[parseInt(day)],
        slots:   daySlots,
      })),
      totalSlots: slots.length,
    };
  }

  async getTeacherTimetable(tenantId: string, teacherId: string) {
    const slots = await this.prisma.timetableSlot.findMany({
      where:   { tenantId, teacherId, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });

    const grid: Record<number, typeof slots> = {};
    for (let d = 1; d <= 6; d++) {
      grid[d] = slots.filter((s: any) => s.dayOfWeek === d);
    }

    return {
      teacherId,
      days: Object.entries(grid).map(([day, daySlots]) => ({
        day:     parseInt(day),
        dayName: DAYS[parseInt(day)],
        slots:   daySlots,
      })),
    };
  }

  async updateSlot(tenantId: string, id: string, dto: UpdateTimetableSlotDto) {
    const slot = await this.prisma.timetableSlot.findFirst({ where: { id, tenantId } });
    if (!slot) throw new NotFoundException(`Timetable slot ${id} not found`);
    return this.prisma.timetableSlot.update({ where: { id }, data: dto });
  }

  async deleteSlot(tenantId: string, id: string) {
    const slot = await this.prisma.timetableSlot.findFirst({ where: { id, tenantId } });
    if (!slot) throw new NotFoundException(`Timetable slot ${id} not found`);
    return this.prisma.timetableSlot.update({ where: { id }, data: { isActive: false } });
  }

  async clearSection(tenantId: string, sectionId: string) {
    const result = await this.prisma.timetableSlot.updateMany({
      where: { tenantId, sectionId },
      data:  { isActive: false },
    });
    return { cleared: result.count };
  }
}
