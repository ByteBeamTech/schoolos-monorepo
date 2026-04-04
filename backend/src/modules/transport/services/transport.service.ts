import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { CreateRouteDto, AssignStudentDto } from '../dto/transport.dto';

@Injectable()
export class TransportService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(tenantId: string) {
    const [routes, assigned] = await Promise.all([
      this.prisma.transportRoute.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.transportAssignment.count({ where: { endedAt: null, route: { tenantId } } }),
    ]);
    return { routes, assigned };
  }

  async listRoutes(tenantId: string) {
    return this.prisma.transportRoute.findMany({
      where:   { tenantId, status: 'ACTIVE' },
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getRoute(tenantId: string, id: string) {
    const route = await this.prisma.transportRoute.findFirst({
      where:   { id, tenantId },
      include: {
        assignments: {
          where:   { endedAt: null },
          include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } },
        },
      },
    });
    if (!route) throw new NotFoundException('Route not found');
    return route;
  }

  async createRoute(tenantId: string, dto: CreateRouteDto) {
    return this.prisma.transportRoute.create({
      data: {
        tenantId,
        name:          dto.name,
        description:   dto.description   ?? null,
        vehicleNumber: dto.vehicleNumber ?? null,
        driverName:    dto.driverName    ?? null,
        driverPhone:   dto.driverPhone   ?? null,
        feeAmount:     dto.feeAmount,
        stops:         dto.stops ? JSON.stringify(dto.stops) : undefined,
        status:        'ACTIVE',
      },
    });
  }

  async assignStudent(_tenantId: string, dto: AssignStudentDto) {
    const existing = await this.prisma.transportAssignment.findFirst({
      where: { studentId: dto.studentId, endedAt: null },
    });
    if (existing) throw new ConflictException('Student already assigned to a route');

    return this.prisma.transportAssignment.create({
      data:    { studentId: dto.studentId, routeId: dto.routeId, boardingStop: dto.boardingStop ?? null },
      include: {
        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
        route:   { select: { name: true, vehicleNumber: true } },
      },
    });
  }

  async unassignStudent(tenantId: string, studentId: string) {
    const a = await this.prisma.transportAssignment.findFirst({
      where: { studentId, endedAt: null, route: { tenantId } },
    });
    if (!a) throw new NotFoundException('Assignment not found');
    return this.prisma.transportAssignment.update({ where: { id: a.id }, data: { endedAt: new Date() } });
  }
}
