import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { buildReadScope, requireWriteBranch } from '@modules/crm/services/branch-scope.util';
import { CreateConductorDto, ListConductorsQueryDto, UpdateConductorDto } from '../dto/conductor.dto';

/** SAD Ch.6 Conductor Management. */
@Injectable()
export class ConductorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: ListConductorsQueryDto) {
    const scope = buildReadScope(user, query.branchId);

    const where: Prisma.ConductorWhereInput = { ...scope.where, deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.search) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.conductor.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.conductor.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const scope = buildReadScope(user);
    const conductor = await this.prisma.conductor.findFirst({
      where: { ...scope.where, id, deletedAt: null },
    });
    if (!conductor) throw new NotFoundException('Conductor not found');
    return conductor;
  }

  async create(user: AuthenticatedUser, dto: CreateConductorDto) {
    const { tenantId, branchId } = requireWriteBranch(user, dto.branchId);

    const conductor = await this.prisma.conductor.create({
      data: {
        tenantId,
        branchId,
        name: dto.name.trim(),
        phone: dto.phone?.trim(),
        isActive: dto.isActive,
      },
    });

    await this.audit.logCreate({
      tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Conductor',
      entityId: conductor.id,
      after: { branchId, name: conductor.name },
    });

    return conductor;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateConductorDto) {
    const before = await this.getOne(user, id);

    const data: Prisma.ConductorUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.phone !== undefined) data.phone = dto.phone?.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const after = await this.prisma.conductor.update({ where: { id }, data });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Conductor',
      entityId: id,
      before: { name: before.name, isActive: before.isActive },
      after: { name: after.name, isActive: after.isActive },
    });

    return after;
  }

  /** Logical deletion (SAD Ch.7 "Soft Delete: Logical deletion for master records"). */
  async remove(user: AuthenticatedUser, id: string) {
    const before = await this.getOne(user, id);

    const after = await this.prisma.conductor.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.logDelete({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Conductor',
      entityId: id,
      before: { name: before.name },
    });

    return after;
  }
}
