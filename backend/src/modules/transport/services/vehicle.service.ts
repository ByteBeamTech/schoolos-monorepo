import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { buildReadScope, requireWriteBranch } from '@modules/crm/services/branch-scope.util';
import { CreateVehicleDto, ListVehiclesQueryDto, UpdateVehicleDto } from '../dto/vehicle.dto';

/**
 * SAD Ch.6 Vehicle Management / Ch.8 Fleet API (POST/GET/PUT/DELETE
 * /vehicles). Vehicle is the Fleet Aggregate Root (SAD Ch.3).
 *
 * Branch scoping follows the same buildReadScope/requireWriteBranch shape
 * already used by CRM (LeadService) and Admissions (ApplicationService) —
 * reused directly rather than re-implemented.
 */
@Injectable()
export class VehicleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: ListVehiclesQueryDto) {
    const scope = buildReadScope(user, query.branchId);

    const where: Prisma.VehicleWhereInput = { ...scope.where, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.registrationNumber = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        orderBy: [{ registrationNumber: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const scope = buildReadScope(user);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { ...scope.where, id, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async create(user: AuthenticatedUser, dto: CreateVehicleDto) {
    const { tenantId, branchId } = requireWriteBranch(user, dto.branchId);

    const existing = await this.prisma.vehicle.findFirst({
      where: { tenantId, registrationNumber: dto.registrationNumber, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        `A vehicle with registration number ${dto.registrationNumber} already exists.`,
      );
    }

    const vehicle = await this.prisma.vehicle.create({
      data: {
        tenantId,
        branchId,
        registrationNumber: dto.registrationNumber.trim(),
        capacity: dto.capacity,
        fuelType: dto.fuelType,
        chassisNumber: dto.chassisNumber?.trim(),
        engineNumber: dto.engineNumber?.trim(),
        status: dto.status,
      },
    });

    await this.audit.logCreate({
      tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Vehicle',
      entityId: vehicle.id,
      after: { branchId, registrationNumber: vehicle.registrationNumber, status: vehicle.status },
    });

    return vehicle;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateVehicleDto) {
    const before = await this.getOne(user, id);

    if (dto.registrationNumber && dto.registrationNumber !== before.registrationNumber) {
      const clash = await this.prisma.vehicle.findFirst({
        where: {
          tenantId: before.tenantId,
          registrationNumber: dto.registrationNumber,
          deletedAt: null,
          NOT: { id },
        },
        select: { id: true },
      });
      if (clash) {
        throw new BadRequestException(
          `A vehicle with registration number ${dto.registrationNumber} already exists.`,
        );
      }
    }

    const data: Prisma.VehicleUpdateInput = {};
    if (dto.registrationNumber !== undefined) data.registrationNumber = dto.registrationNumber.trim();
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.fuelType !== undefined) data.fuelType = dto.fuelType;
    if (dto.chassisNumber !== undefined) data.chassisNumber = dto.chassisNumber?.trim();
    if (dto.engineNumber !== undefined) data.engineNumber = dto.engineNumber?.trim();
    if (dto.status !== undefined) data.status = dto.status;

    const after = await this.prisma.vehicle.update({ where: { id }, data });

    await this.audit.logUpdate({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Vehicle',
      entityId: id,
      before: { registrationNumber: before.registrationNumber, status: before.status },
      after: { registrationNumber: after.registrationNumber, status: after.status },
    });

    return after;
  }

  /** Logical deletion (SAD Ch.7 "Soft Delete: Logical deletion for master records"). */
  async remove(user: AuthenticatedUser, id: string) {
    const before = await this.getOne(user, id);

    const after = await this.prisma.vehicle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.logDelete({
      tenantId: before.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Vehicle',
      entityId: id,
      before: { registrationNumber: before.registrationNumber },
    });

    return after;
  }
}
