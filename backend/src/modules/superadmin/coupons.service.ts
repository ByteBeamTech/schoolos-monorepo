import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
 
@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}
 
  async list() {
    // Auto-expire coupons past their expiry date on read
    const now = new Date();
    await this.prisma.coupon.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lt: now } },
      data:  { status: 'EXPIRED' },
    });
 
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
 
  async create(data: {
    code:      string;
    discount:  number;
    type:      'PERCENT' | 'FLAT';
    maxUses:   number;
    expiresAt: string;
  }, createdBy: string) {
    const existing = await this.prisma.coupon.findUnique({
      where: { code: data.code.toUpperCase() },
    });
    if (existing) throw new ConflictException(`Coupon code ${data.code} already exists`);
 
    return this.prisma.coupon.create({
      data: {
        code:      data.code.toUpperCase(),
        discount:  data.discount,
        type:      data.type,
        maxUses:   data.maxUses,
        expiresAt: new Date(data.expiresAt),
        status:    'ACTIVE',
        createdBy,
      },
    });
  }
 
  async remove(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return this.prisma.coupon.delete({ where: { id } });
  }
 
  // Called by onboarding flow when a school applies a coupon code
  async apply(code: string): Promise<{ discount: number; type: string }> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!coupon)                           throw new NotFoundException('Coupon not found');
    if (coupon.status !== 'ACTIVE')        throw new ConflictException('Coupon is not active');
    if (coupon.expiresAt < new Date())     throw new ConflictException('Coupon has expired');
    if (coupon.uses >= coupon.maxUses)     throw new ConflictException('Coupon has reached maximum uses');
 
    await this.prisma.coupon.update({
      where: { id: coupon.id },
      data:  {
        uses:   { increment: 1 },
        status: coupon.uses + 1 >= coupon.maxUses ? 'EXPIRED' : 'ACTIVE',
      },
    });
 
    return { discount: Number(coupon.discount), type: coupon.type };
  }
}
