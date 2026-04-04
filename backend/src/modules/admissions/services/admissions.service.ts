import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { CreateAdmissionDto, UpdateAdmissionStatusDto } from '../dto/admissions.dto';

@Injectable()
export class AdmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(tenantId: string) {
    const pipeline = await this.prisma.admission.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
    });

    const map: Record<string, number> = {};
    pipeline.forEach((r: any) => { map[r.status] = r._count; });

    const [total, thisMonth] = await Promise.all([
      this.prisma.admission.count({ where: { tenantId } }),
      this.prisma.admission.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    const enrolled  = map['ENROLLED'] ?? 0;
    const inquiries = map['INQUIRY'] ?? 0;
    const convRate  = total > 0 ? Math.round((enrolled / total) * 100) : 0;

    return {
      total,
      thisMonth,
      enrolled,
      inquiries,
      conversionRate: convRate,
      byStatus: map,
    };
  }

  async list(
    tenantId: string,
    filters: { status?: string; source?: string; search?: string } = {},
  ) {
    const where: any = { tenantId };

    if (filters.status) where.status = filters.status;
    if (filters.source) where.source = filters.source;

    if (filters.search) {
      const s = filters.search;

      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },

        // 🔹 Father
        { fatherFirstName: { contains: s, mode: 'insensitive' } },
        { fatherLastName: { contains: s, mode: 'insensitive' } },

        // 🔹 Mother
        { motherFirstName: { contains: s, mode: 'insensitive' } },
        { motherLastName: { contains: s, mode: 'insensitive' } },

        // 🔹 Guardian
        { guardianFirstName: { contains: s, mode: 'insensitive' } },
        { guardianLastName: { contains: s, mode: 'insensitive' } },

        // 🔹 Phones
        { guardianPhone: { contains: s } },
        { alternatePhone: { contains: s } },

        // 🔹 Email
	{ fatherEmail: { contains: s, mode: 'insensitive' } },
	{ motherEmail: { contains: s, mode: 'insensitive' } },
        //{ email: { contains: s, mode: 'insensitive' } },
      ];
    }

    return this.prisma.admission.findMany({
      where,
      orderBy: [{ followUpDate: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async getById(tenantId: string, id: string) {
    const a = await this.prisma.admission.findFirst({
      where: { id, tenantId },
      include: { activities: { orderBy: { createdAt: 'desc' } } },
    });

    if (!a) throw new NotFoundException('Admission not found');

    return a;
  }

  async create(
    tenantId: string,
    dto: CreateAdmissionDto,
    actorId: string,
  ) {
    const admission = await this.prisma.admission.create({
      data: {
        tenantId,

        // 🔹 Student
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender ?? null,

        // 🔹 Contact
        guardianPhone: dto.phone ?? null,
        alternatePhone: dto.alternatePhone ?? null,
        fatherEmail: dto.fatherEmail ?? null,
	motherEmail: dto.motherEmail ?? null,


        // 🔹 Parent Info
        fatherFirstName: dto.fatherFirstName ?? null,
        fatherLastName: dto.fatherLastName ?? null,

        motherFirstName: dto.motherFirstName ?? null,
        motherLastName: dto.motherLastName ?? null,

        guardianFirstName: dto.guardianFirstName ?? null,
        guardianLastName: dto.guardianLastName ?? null,

        // 🔹 Academic
        academicYear: dto.academicYear,

        // 🔹 Address
        addressLine1: dto.addressLine ?? null,
        city: dto.city ?? null,
        state: dto.state ?? null,
        pincode: dto.pincode ?? null,

        // 🔹 Source
        source: (dto.source ?? 'DIRECT') as any,

        // 🔹 Notes
	//
	branchId: dto.branchId,
        notes: dto.notes ?? null,
        followUpDate: dto.followUpDate
          ? new Date(dto.followUpDate)
          : null,

        // 🔹 Status
        status: 'INQUIRY' as any,
      },
    });

    await this.prisma.admissionActivity.create({
      data: {
        admissionId: admission.id,
        tenantId,
        actorId,
        action: 'INQUIRY_CREATED',
        note: dto.notes ?? null,
      } as any,
    });

    return admission;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    dto: UpdateAdmissionStatusDto,
    actorId: string,
  ) {
    const a = await this.prisma.admission.findFirst({
      where: { id, tenantId },
    });

    if (!a) throw new NotFoundException('Admission not found');

    const updated = await this.prisma.admission.update({
      where: { id },
      data: {
        status: dto.status as any,
        rejectionReason: dto.rejectionReason ?? null,
        followUpDate: dto.followUpDate
          ? new Date(dto.followUpDate)
          : null,
      },
    });

    await this.prisma.admissionActivity.create({
      data: {
        admissionId: id,
        tenantId,
        actorId,
        action: `STATUS_${dto.status}`,
        note: dto.note ?? null,
      },
    });

    return updated;
  }

  async addNote(
    tenantId: string,
    id: string,
    note: string,
    actorId: string,
  ) {
    const a = await this.prisma.admission.findFirst({
      where: { id, tenantId },
    });

    if (!a) throw new NotFoundException('Admission not found');

    await this.prisma.admission.update({
      where: { id },
      data: { notes: note },
    });

    return this.prisma.admissionActivity.create({
      data: {
        admissionId: id,
        tenantId,
        actorId,
        action: 'NOTE_ADDED',
        note,
      },
    });
  }

  async sourceReport(tenantId: string) {
    const bySource = await this.prisma.admission.groupBy({
      by: ['source'],
      where: { tenantId },
      _count: true,
    });

    return bySource
      .map((r: any) => ({ source: r.source, count: r._count }))
      .sort((a: any, b: any) => b.count - a.count);
  }
}
