import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { CreatePayrollStructureDto, GeneratePayslipDto } from '../dto/payroll.dto';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async getStructure(tenantId: string, staffId: string) {
    return this.prisma.payrollStructure.findFirst({ where: { tenantId, staffId } });
  }

  async listStructures(tenantId: string) {
    return this.prisma.payrollStructure.findMany({
      where:   { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStructure(tenantId: string, dto: CreatePayrollStructureDto, _actorId: string) {
    const existing = await this.prisma.payrollStructure.findFirst({ where: { tenantId, staffId: dto.staffId } });
    if (existing) throw new ConflictException('Payroll structure already exists for this staff member');

    return this.prisma.payrollStructure.create({
      data: {
        tenantId,
        staffId:         dto.staffId,
        basicSalary:     dto.basicSalary,
        hra:             dto.hra             ?? 0,
        da:              dto.da              ?? 0,
        ta:              dto.ta              ?? 0,
        otherAllowances: dto.otherAllowances ?? 0,
        pfEmployee:      dto.pfEmployee      ?? 0,
        pfEmployer:      dto.pfEmployer      ?? 0,
        esi:             dto.esi             ?? 0,
        tds:             dto.tds             ?? 0,
        effectiveFrom:   new Date(dto.effectiveFrom),
      },
    });
  }

  async generatePayslip(tenantId: string, dto: GeneratePayslipDto, actorId: string) {
    const structure = await this.prisma.payrollStructure.findFirst({
      where: { tenantId, staffId: dto.staffId },
    });
    if (!structure) throw new NotFoundException('Payroll structure not found for this staff member');

    const existing = await this.prisma.payrollEntry.findFirst({
      where: { tenantId, staffId: dto.staffId, month: dto.month, year: dto.year },
    });
    if (existing) throw new ConflictException(`Payslip already generated for ${dto.month}/${dto.year}`);

    const workingDays  = 26;
    const presentDays  = dto.presentDays ?? workingDays;
    const ratio        = presentDays / workingDays;

    const basic  = Number(structure.basicSalary) * ratio;
    const hra    = Number(structure.hra)   * ratio;
    const da     = Number(structure.da)    * ratio;
    const ta     = Number(structure.ta)    * ratio;
    const other  = Number(structure.otherAllowances) * ratio;
    const gross  = basic + hra + da + ta + other;

    const pf    = Number(structure.pfEmployee);
    const esi   = Number(structure.esi);
    const tds   = Number(structure.tds);
    const otherDed = dto.otherDeductions ?? 0;
    const net   = gross - pf - esi - tds - otherDed;

    return this.prisma.payrollEntry.create({
      data: {
        tenantId,
        staffId:        dto.staffId,
        structureId:    structure.id,
        month:          dto.month,
        year:           dto.year,
        workingDays,
        presentDays,
        basicPaid:      Math.round(basic  * 100) / 100,
        hraPaid:        Math.round(hra    * 100) / 100,
        daPaid:         Math.round(da     * 100) / 100,
        taPaid:         Math.round(ta     * 100) / 100,
        otherAllowances:Math.round(other  * 100) / 100,
        grossSalary:    Math.round(gross  * 100) / 100,
        pfDeduction:    pf,
        esiDeduction:   esi,
        tdsDeduction:   tds,
        otherDeductions:otherDed,
        netSalary:      Math.round(net    * 100) / 100,
        status:         'DRAFT',
        createdBy:      actorId,
      },
    });
  }

  async listPayslips(tenantId: string, month?: number, year?: number) {
    const where: any = { tenantId };
    if (month) where.month = month;
    if (year)  where.year  = year;
    return this.prisma.payrollEntry.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async approvePayslip(tenantId: string, id: string) {
    const entry = await this.prisma.payrollEntry.findFirst({ where: { id, tenantId } });
    if (!entry) throw new NotFoundException('Payslip not found');
    return this.prisma.payrollEntry.update({ where: { id }, data: { status: 'APPROVED' } });
  }

  async markPaid(tenantId: string, id: string) {
    const entry = await this.prisma.payrollEntry.findFirst({ where: { id, tenantId } });
    if (!entry) throw new NotFoundException('Payslip not found');
    return this.prisma.payrollEntry.update({ where: { id }, data: { status: 'PAID', paidAt: new Date() } });
  }

  async stats(tenantId: string, month: number, year: number) {
    const entries = await this.prisma.payrollEntry.findMany({ where: { tenantId, month, year } });
    const total    = entries.length;
    const paid     = entries.filter((e: any) => e.status === 'PAID').length;
    const draft    = entries.filter((e: any) => e.status === 'DRAFT').length;
    const totalNet = entries.reduce((s: number, e: any) => s + Number(e.netSalary), 0);
    return { total, paid, draft, totalNet: Math.round(totalNet), month, year };
  }
}
