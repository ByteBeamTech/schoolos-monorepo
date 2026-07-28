import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { buildReadScope, requireWriteBranch } from '@modules/crm/services/branch-scope.util';
import { CreateStopDto, ListStopsQueryDto, UpdateStopDto } from '../dto/stop.dto';

/** SAD Ch.4 Stop Management (Master Stops, GPS Coordinates, Landmarks, Stop Groups). */
@Injectable()
export class StopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: ListStopsQueryDto) {
    const scope = buildReadScope(user, query.branchId);

    const where: Prisma.StopWhereInput = { ...scope.where, deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.stopGroup) where.stopGroup = query.stopGroup;
    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { landmark: { contains: s, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stop.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.stop.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const scope = buildReadScope(user);
    const stop = await this.prisma.stop.findFirst({
      where: { ...scope.where, id, deletedAt: null },
    });
    if (!stop) throw new NotFoundException('Stop not found');
    return stop;
  }

  async create(user: AuthenticatedUser, dto: CreateStopDto) {
    const { tenantId, branchId } = requireWriteBranch(user, dto.branchId);

    const stop = await this.prisma.stop.create({
      data: {
        tenantId,
        branchId,
        name: dto.name.trim(),
        landmark: dto.landmark?.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        stopGroup: dto.stopGroup?.trim(),
        isActive: dto.isActive,
      },
    });

    await this.audit.logCreate({
      tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Stop',
      entityId: stop.id,
      after: { branchId, name: stop.name },
    });

    return stop;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateStopDto) {
    const before = await this.getOne(user, id);

    const data: Prisma.StopUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.landmark !== undefined) data.landmark = dto.landmark?.trim();
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.stopGroup !== undefined) data.stopGroup = dto.stopGroup?.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const after = await this.prisma.stop.update({ where: { id }, data });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Stop',
      entityId: id,
      before: { name: before.name, isActive: before.isActive },
      after: { name: after.name, isActive: after.isActive },
    });

    return after;
  }

  /** Logical deletion (SAD Ch.7 "Soft Delete: Logical deletion for master records"). */
  async remove(user: AuthenticatedUser, id: string) {
    const before = await this.getOne(user, id);

    const after = await this.prisma.stop.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.logDelete({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Stop',
      entityId: id,
      before: { name: before.name },
    });

    return after;
  }
}
