import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AdmissionStepStatus } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import {
  CreateAdmissionDto,
  UpdateAdmissionStatusDto,
} from '../dto/admissions.dto';

@Injectable()
export class AdmissionsService {
  private readonly logger = new Logger(AdmissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================
  // 📊 STATS
  // =========================
  async stats(tenantId: string) {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pipeline, total, thisMonth] = await Promise.all([
      this.prisma.admission.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.admission.count({ where: { tenantId } }),
      this.prisma.admission.count({
        where: { tenantId, createdAt: { gte: startMonth } },
      }),
    ]);

    const map: Record<string, number> = {};

    for (const r of pipeline) {
      map[r.status] = r._count._all;
    }

    const enrolled = map['ENROLLED'] ?? 0;
    const inquiries = map['INQUIRY'] ?? 0;
    const convRate = total > 0 ? Math.round((enrolled / total) * 100) : 0;

    return {
      total,
      thisMonth,
      enrolled,
      inquiries,
      conversionRate: convRate,
      byStatus: map,
    };
  }

  // =========================
  // 📋 LIST (Ultimate Query Engine)
  // =========================
  async list(
    tenantId: string,
    filters: {
      status?: string;
      source?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const startTime = Date.now();
    const traceId = `adm-list-${tenantId}-${startTime}`;

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, Math.min(100, filters.limit ?? 50));

    const where: any = { tenantId };

    if (filters.status) where.status = filters.status;
    if (filters.source)
      where.source = filters.source.trim().toUpperCase();

    // 🔍 Search (Safe + Fast-ready)
    if (filters.search?.trim()) {
      const s = filters.search.trim();

      if (s.length > 50) {
        throw new BadRequestException('Search query too long');
      }

      const normalizedPhone = s.replace(/\D/g, '');

      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        ...(normalizedPhone
          ? [{ guardianPhone: { contains: normalizedPhone } }]
          : []),
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.admission.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,

          // 👨‍👩‍👧 Parent Info
          fatherFirstName: true,
          fatherLastName: true,
          motherFirstName: true,
          motherLastName: true,

          // 📞 Contact
          guardianPhone: true,
          alternatePhone: true,
          email: true,

          // 📍 Address
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          pincode: true,

          // 🎯 Status
          status: true,
          source: true,
          followUpDate: true,

          createdAt: true,
        },
        orderBy: [
          { followUpDate: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.admission.count({ where }),
    ]);

    const lastPage = Math.max(1, Math.ceil(total / limit));

    if (total > 0 && page > lastPage) {
      throw new BadRequestException(
        `Page ${page} out of bounds. Max: ${lastPage}`,
      );
    }

    this.logger.debug({
      traceId,
      event: 'ADMISSION_LIST_FETCH',
      tenantId,
      total,
      page,
      limit,
      latencyMs: Date.now() - startTime,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        lastPage,
      },
    };
  }

  // =========================
  // 🔍 GET BY ID
  // =========================
  async getById(tenantId: string, id: string) {
    const admission = await this.prisma.admission.findFirst({
      where: { id, tenantId },
      include: {
        activities: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!admission) {
      throw new NotFoundException('Admission not found');
    }

    return admission;
  }

  // =========================
  // ➕ CREATE
  // =========================
  async create(
    tenantId: string,
    dto: CreateAdmissionDto,
    actorId: string,
  ) {
    if (!dto.firstName?.trim()) {
      throw new BadRequestException('First name is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const admission = await tx.admission.create({
        data: {

          tenantId,
          branchId: dto.branchId,
          academicYear: dto.academicYear || '2024-2025',

          firstName: dto.firstName.trim(),
          lastName: dto.lastName?.trim() ?? null,

          fatherFirstName: dto.fatherFirstName ?? null,
          fatherLastName: dto.fatherLastName ?? null,
          motherFirstName: dto.motherFirstName ?? null,
          motherLastName: dto.motherLastName ?? null,

          guardianPhone: dto.phone ?? null,
          alternatePhone: dto.alternatePhone ?? null,
          email: dto.email ?? null,

          addressLine1: dto.addressLine1 ?? null,
          addressLine2: dto.addressLine2 ?? null,
          city: dto.city ?? null,
          state: dto.state ?? null,
          pincode: dto.pincode ?? null,

          source: dto.source?.trim().toUpperCase() ?? 'DIRECT',
          notes: dto.notes ?? null,

          followUpDate: dto.followUpDate
            ? new Date(dto.followUpDate)
            : null,

          status: 'INQUIRY' as AdmissionStepStatus,
        },
      });

      await tx.admissionActivity.create({
        data: {

          admissionId: admission.id,
          tenantId,
          actorId,
          action: 'INQUIRY_CREATED',
          note: dto.notes ?? null,
        },
      });

      return admission;
    });
  }

  // =========================
  // 🔄 UPDATE STATUS
  // =========================
  async updateStatus(
    tenantId: string,
    id: string,
    dto: UpdateAdmissionStatusDto,
    actorId: string,
  ) {
    const existing = await this.getById(tenantId, id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.admission.update({
        where: {
          id,
          updatedAt: existing.updatedAt, // 🔒 optimistic locking
        },
        data: {

          status: dto.status as any as any,
          rejectionReason: dto.rejectionReason ?? null,
          followUpDate: dto.followUpDate
            ? new Date(dto.followUpDate)
            : null,
        },
      });

      await tx.admissionActivity.create({
        data: {

          admissionId: id,
          tenantId,
          actorId,
          action: `STATUS_${dto.status}`,
          note: dto.note ?? null,
        },
      });

      return updated;
    });
  }

  // =========================
  // 📝 ADD NOTE
  // =========================
  async addNote(
    tenantId: string,
    id: string,
    note: string,
    actorId: string,
  ) {
    await this.getById(tenantId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.admission.update({
        where: { id },
        data: {
 notes: note },
      });

      return tx.admissionActivity.create({
        data: {

          admissionId: id,
          tenantId,
          actorId,
          action: 'NOTE_ADDED',
          note,
        },
      });
    });
  }

  // =========================
  // 📊 SOURCE REPORT
  // =========================
  async sourceReport(tenantId: string) {
    const rows = await this.prisma.admission.groupBy({
      by: ['source'],
      where: { tenantId },
      _count: { _all: true },
    });

    return rows.map((r) => ({
      source: r.source ?? 'UNKNOWN',
      count: r._count._all,
    }));
  }
}
