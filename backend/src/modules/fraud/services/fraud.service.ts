import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma.service';

@Injectable()
export class FraudService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: { status?: string; severity?: string; tenantId?: string } = {}) {
    const where: any = {};
    if (filters.status)   where.status   = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.tenantId) where.tenantId = filters.tenantId;

    return this.prisma.fraudAlert.findMany({
      where,
      include: { tenant: { select: { name: true, slug: true } } },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take:    100,
    });
  }

  async update(id: string, data: { status: string; resolvedBy?: string }) {
    const alert = await this.prisma.fraudAlert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');

    return this.prisma.fraudAlert.update({
      where: { id },
      data:  {
        status:     data.status as any,
        resolvedBy: data.resolvedBy ?? null,
        resolvedAt: data.status === 'RESOLVED' ? new Date() : null,
      },
    });
  }

  async stats() {
    const [open, critical, investigating] = await Promise.all([
      this.prisma.fraudAlert.count({ where: { status: 'OPEN' } }),
      this.prisma.fraudAlert.count({ where: { status: 'OPEN', severity: 'CRITICAL' } }),
      this.prisma.fraudAlert.count({ where: { status: 'INVESTIGATING' } }),
    ]);
    return { open, critical, investigating };
  }
}
