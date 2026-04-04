import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';

@Injectable()
export class LeadService {
  constructor(private readonly prisma: PrismaService) {}

  async createLead(data: any, tenantId: string, branchId: string) {
    // If branchId is a placeholder, try to find the first real one
    let targetBranch = branchId;
    if (branchId === 'ACTUAL_BRANCH_ID' || !branchId) {
      const firstBranch = await (this.prisma as any).branch.findFirst({
        where: { tenantId }
      });
      targetBranch = firstBranch?.id || branchId;
    }

    return (this.prisma as any).lead.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        parentName: data.parentName || 'N/A',
        status: data.status || 'NEW',
        tenantId,
        branchId: targetBranch,
      },
    });
  }

  async findAllLeads(tenantId: string) {
    return (this.prisma as any).lead.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
