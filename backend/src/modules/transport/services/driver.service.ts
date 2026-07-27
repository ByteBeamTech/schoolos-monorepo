import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { buildReadScope, requireWriteBranch } from '@modules/crm/services/branch-scope.util';
import { CreateDriverDto, ListDriversQueryDto, UpdateDriverDto } from '../dto/driver.dto';

/** SAD Ch.6 Driver Management / license expiry tracking. */
@Injectable()
export class DriverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: ListDriversQueryDto) {
    const scope = buildReadScope(user, query.branchId);

    const where: Prisma.DriverWhereInput = { ...scope.where, deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { licenseNumber: { contains: s, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.driver.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.driver.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const scope = buildReadScope(user);
    const driver = await this.prisma.driver.findFirst({
      where: { ...scope.where, id, deletedAt: null },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }

  async create(user: AuthenticatedUser, dto: CreateDriverDto) {
    const { tenantId, branchId } = requireWriteBranch(user, dto.branchId);

    const existing = await this.prisma.driver.findFirst({
      where: { tenantId, licenseNumber: dto.licenseNumber, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        `A driver with license number ${dto.licenseNumber} already exists.`,
      );
    }

    const driver = await this.prisma.driver.create({
      data: {
        tenantId,
        branchId,
        name: dto.name.trim(),
        phone: dto.phone?.trim(),
        licenseNumber: dto.licenseNumber.trim(),
        licenseExpiryDate: dto.licenseExpiryDate ? new Date(dto.licenseExpiryDate) : undefined,
        isActive: dto.isActive,
      },
    });

    await this.audit.logCreate({
      tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Driver',
      entityId: driver.id,
      after: { branchId, licenseNumber: driver.licenseNumber },
    });

    return driver;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateDriverDto) {
    const before = await this.getOne(user, id);

    if (dto.licenseNumber && dto.licenseNumber !== before.licenseNumber) {
      const clash = await this.prisma.driver.findFirst({
        where: {
          tenantId: before.tenantId,
          licenseNumber: dto.licenseNumber,
          deletedAt: null,
          NOT: { id },
        },
        select: { id: true },
      });
      if (clash) {
        throw new BadRequestException(
          `A driver with license number ${dto.licenseNumber} already exists.`,
        );
      }
    }

    const data: Prisma.DriverUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.phone !== undefined) data.phone = dto.phone?.trim();
    if (dto.licenseNumber !== undefined) data.licenseNumber = dto.licenseNumber.trim();
    if (dto.licenseExpiryDate !== undefined) {
      data.licenseExpiryDate = dto.licenseExpiryDate ? new Date(dto.licenseExpiryDate) : null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const after = await this.prisma.driver.update({ where: { id }, data });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Driver',
      entityId: id,
      before: { licenseNumber: before.licenseNumber, isActive: before.isActive },
      after: { licenseNumber: after.licenseNumber, isActive: after.isActive },
    });

    return after;
  }

  async remove(user: AuthenticatedUser, id: string) {
    const before = await this.getOne(user, id);

    const after = await this.prisma.driver.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.logDelete({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Driver',
      entityId: id,
      before: { licenseNumber: before.licenseNumber },
    });

    return after;
  }
}
