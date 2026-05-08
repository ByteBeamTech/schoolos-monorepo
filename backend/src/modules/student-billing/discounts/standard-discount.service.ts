// modules/student-billing/discounts/standard-discount.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';

export interface DiscountRule {
  category:    string;
  type:        'PERCENTAGE' | 'FLAT';
  value:       number;
  maxAmount?:  number;
  autoApply:   boolean;
  description: string;
}

const STANDARD_RULES: DiscountRule[] = [
  { category: 'MERIT',         type: 'PERCENTAGE', value: 10,  maxAmount: 2000, autoApply: true,  description: 'Merit scholarship — top 10% of class' },
  { category: 'SIBLING',       type: 'PERCENTAGE', value: 5,   maxAmount: 1000, autoApply: true,  description: 'Sibling discount — second child onwards' },
  { category: 'STAFF_CHILD',   type: 'PERCENTAGE', value: 50,  maxAmount: 5000, autoApply: true,  description: 'Staff ward — 50% tuition fee waiver' },
  { category: 'EARLY_PAYMENT', type: 'PERCENTAGE', value: 2,   maxAmount: 500,  autoApply: false, description: 'Early payment discount' },
  { category: 'SCHOLARSHIP',   type: 'PERCENTAGE', value: 100,                  autoApply: false, description: 'Full scholarship — requires principal approval' },
];

@Injectable()
export class StandardDiscountService {
  private readonly logger = new Logger(StandardDiscountService.name);

  constructor(private readonly prisma: PrismaService) {}

  async autoApplyDiscounts(
    tenantId:  string,
    studentId: string,
    invoiceId: string,
    actorId:   string,
  ): Promise<{ applied: number; totalDiscount: number }> {
    const student = await this.prisma.student.findFirst({
      where:   { id: studentId, tenantId },
      // Student has `guardianLinks` (GuardianStudent[]) not `guardians`
      include: { guardianLinks: { select: { guardianId: true } } },
    });
    if (!student) return { applied: 0, totalDiscount: 0 };

    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!invoice) return { applied: 0, totalDiscount: 0 };

    const existingDiscounts = await this.prisma.discount.findMany({
      where: { studentId, tenantId, approvalStatus: 'APPROVED' },
    });
    const appliedCategories = new Set(existingDiscounts.map((d: any) => d.category));

    let totalDiscount = 0;
    let applied       = 0;
    const invoiceAmount = Number(invoice.totalAmount);

    // ── Merit ─────────────────────────────────────────────────────────────────
    if (!appliedCategories.has('MERIT')) {
      const eligible = await this.checkMeritEligibility(tenantId, studentId);
      if (eligible) {
        const amount = this.calculateDiscount(invoiceAmount, STANDARD_RULES[0]);
        await this.applyDiscount(tenantId, studentId, invoiceId, 'MERIT', 'PERCENTAGE', 10, amount, actorId);
        totalDiscount += amount; applied++;
      }
    }

    // ── Sibling ───────────────────────────────────────────────────────────────
    if (!appliedCategories.has('SIBLING')) {
      const siblingCount = await this.countSiblings(tenantId, studentId, student.guardianLinks);
      if (siblingCount > 0) {
        const amount = this.calculateDiscount(invoiceAmount, STANDARD_RULES[1]);
        await this.applyDiscount(tenantId, studentId, invoiceId, 'SIBLING', 'PERCENTAGE', 5, amount, actorId);
        totalDiscount += amount; applied++;
      }
    }

    // ── Staff child ───────────────────────────────────────────────────────────
    if (!appliedCategories.has('STAFF_CHILD')) {
      const isStaff = await this.checkStaffChild(tenantId, student.guardianLinks);
      if (isStaff) {
        const amount = this.calculateDiscount(invoiceAmount, STANDARD_RULES[2]);
        await this.applyDiscount(tenantId, studentId, invoiceId, 'STAFF_CHILD', 'PERCENTAGE', 50, amount, actorId);
        totalDiscount += amount; applied++;
      }
    }

    if (totalDiscount > 0) {
      const existingDiscount = Number(invoice.discountAmount ?? 0);
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          discountAmount: existingDiscount + totalDiscount,
          dueAmount:      Math.max(0, Number(invoice.dueAmount) - totalDiscount),
          totalAmount:    Math.max(0, invoiceAmount - totalDiscount),
        },
      });
    }

    this.logger.log(`Auto-applied ${applied} discounts totalling ${totalDiscount} to invoice ${invoiceId}`);
    return { applied, totalDiscount };
  }

  // ─── Eligibility checks ─────────────────────────────────────────────────────

  private async checkMeritEligibility(_tenantId: string, _studentId: string): Promise<boolean> {
    // Extend: check grades or a merit flag in metadata
    return false;
  }

  private async countSiblings(
    tenantId:      string,
    studentId:     string,
    guardianLinks: { guardianId: string }[],
  ): Promise<number> {
    if (!guardianLinks.length) return 0;
    const guardianIds = guardianLinks.map(g => g.guardianId);

    return this.prisma.student.count({
      where: {
        tenantId,
        id:           { not: studentId },
        isActive:     true,
        guardianLinks: { some: { guardianId: { in: guardianIds } } },
      },
    });
  }

  private async checkStaffChild(
    tenantId:      string,
    guardianLinks: { guardianId: string }[],
  ): Promise<boolean> {
    if (!guardianLinks.length) return false;
    const guardianIds = guardianLinks.map(g => g.guardianId);

    const count = await this.prisma.user.count({
      where: {
        tenantId,
        id:   { in: guardianIds },
        role: { in: ['TEACHER', 'STAFF', 'HR_MANAGER', 'RECEPTIONIST', 'TRANSPORT_MANAGER'] },
      },
    });
    return count > 0;
  }

  private calculateDiscount(amount: number, rule: DiscountRule): number {
    let discount = rule.type === 'PERCENTAGE' ? amount * (rule.value / 100) : rule.value;
    if (rule.maxAmount) discount = Math.min(discount, rule.maxAmount);
    return Math.round(discount * 100) / 100;
  }

  private async applyDiscount(
    tenantId:      string,
    studentId:     string,
    invoiceId:     string,
    category:      string,
    type:          string,
    value:         number,
    appliedAmount: number,
    actorId:       string,
  ) {
    // Discount schema: tenantId, studentId, category, type, value, reason, validFrom,
    // approvalStatus, invoiceId — no approvedBy/approvedAt/appliedAmount fields
    await (this.prisma as any).discount.create({
      data: {
        tenantId,
        studentId,
        invoiceId,
        category:       category as any,
        type:           type as any,
        value,
        reason:         `Auto-applied: ${STANDARD_RULES.find(r => r.category === category)?.description}`,
        approvalStatus: 'APPROVED',
        validFrom:      new Date(),
      },
    });
  }

  getStandardRules(): DiscountRule[] {
    return STANDARD_RULES;
  }
}
