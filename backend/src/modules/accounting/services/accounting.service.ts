import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { CreateExpenseDto, CreateVendorDto } from '../dto/accounting.dto';

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Stats ──────────────────────────────────────────────────────────────────
  async stats(tenantId: string) {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, thisMonth, byCategory, vendors] = await Promise.all([
      this.prisma.expense.aggregate({ where: { tenantId }, _sum: { amount: true }, _count: true }),
      this.prisma.expense.aggregate({ where: { tenantId, expenseDate: { gte: monthStart } }, _sum: { amount: true } }),
      this.prisma.expense.groupBy({ by: ['category'], where: { tenantId }, _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } } }),
      this.prisma.vendor.count({ where: { tenantId, isActive: true } }),
    ]);

    return {
      totalExpenses:    Number(total._sum.amount    ?? 0),
      expenseCount:     total._count,
      thisMonthTotal:   Number(thisMonth._sum.amount ?? 0),
      byCategory:       byCategory.map((r: any) => ({ category: r.category, amount: Number(r._sum.amount ?? 0) })),
      activeVendors:    vendors,
    };
  }

  // ── Expenses ──────────────────────────────────────────────────────────────
  async listExpenses(tenantId: string, filters: { category?: string; fromDate?: string; toDate?: string } = {}) {
    const where: any = { tenantId };
    if (filters.category) where.category  = filters.category;
    if (filters.fromDate || filters.toDate) {
      where.expenseDate = {};
      if (filters.fromDate) where.expenseDate.gte = new Date(filters.fromDate);
      if (filters.toDate)   where.expenseDate.lte = new Date(filters.toDate);
    }
    return this.prisma.expense.findMany({
      where,
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { expenseDate: 'desc' },
      take:    100,
    });
  }

  async createExpense(tenantId: string, dto: CreateExpenseDto, actorId: string) {
    return this.prisma.expense.create({
      data: {
        tenantId,
        category:    dto.category as any,
        amount:      dto.amount,
        description: dto.description,
        expenseDate: new Date(dto.expenseDate),
        vendorId:    dto.vendorId   ?? null,
        receiptUrl:  dto.receiptUrl ?? null,
        createdBy:   actorId,
      },
      include: { vendor: { select: { name: true } } },
    });
  }

  async approveExpense(tenantId: string, id: string, actorId: string) {
    const e = await this.prisma.expense.findFirst({ where: { id, tenantId } });
    if (!e) throw new NotFoundException('Expense not found');
    return this.prisma.expense.update({ where: { id }, data: { approvedBy: actorId } });
  }

  // ── Vendors ───────────────────────────────────────────────────────────────
  async listVendors(tenantId: string) {
    return this.prisma.vendor.findMany({
      where:   { tenantId, isActive: true },
      include: { _count: { select: { expenses: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createVendor(tenantId: string, dto: CreateVendorDto) {
    return this.prisma.vendor.create({
      data: {
        tenantId,
        name:        dto.name,
        contactName: dto.contactName ?? null,
        phone:       dto.phone       ?? null,
        email:       dto.email       ?? null,
        gstNumber:   dto.gstNumber   ?? null,
      },
    });
  }

  // ── Tally XML Export ──────────────────────────────────────────────────────
  async tallyExport(tenantId: string, fromDate: string, toDate: string): Promise<string> {
    const expenses = await this.prisma.expense.findMany({
      where: {
        tenantId,
        expenseDate: {
          gte: new Date(fromDate),
          lte: new Date(toDate),
        },
      },
      include: { vendor: { select: { name: true, gstNumber: true } } },
      orderBy: { expenseDate: 'asc' },
    });

    const vouchers = expenses.map((e: any) => {
      const date    = new Date(e.expenseDate).toISOString().split('T')[0].replace(/-/g, '');
      const amt     = Number(e.amount).toFixed(2);
      const vendor  = e.vendor?.name ?? 'Cash';
      const narr    = e.description.replace(/[<>&"']/g, (c: string) => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;' }[c] ?? c));
      return `  <VOUCHER VCHTYPE="Payment" ACTION="Create">
    <DATE>${date}</DATE>
    <NARRATION>${narr}</NARRATION>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${vendor}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${amt}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${e.category}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${amt}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>SchoolOS Export</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  }
}
