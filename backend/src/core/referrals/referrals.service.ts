import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { randomBytes }   from 'crypto';

export interface CreateReferralDto {
  referrerTenantId: string;
  refereeEmail:     string;
  refereeName:      string;
  refereePhone?:    string;
  source?:          string;
  notes?:           string;
}

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private generateCode(): string {
    return randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F9B2C1"
  }

  async create(dto: CreateReferralDto) {
    const referrer = await this.prisma.tenant.findFirst({ where: { id: dto.referrerTenantId } });
    if (!referrer) throw new NotFoundException(`Referrer tenant not found: ${dto.referrerTenantId}`);

    const code = this.generateCode();

    // Store in tenant metadata (no dedicated table yet — uses notification as proxy)
    const record = await this.prisma.notification.create({
      data: {
        tenantId:    dto.referrerTenantId,
        channel:     'EMAIL' as any,
        status:      'PENDING' as any,
        templateId:  'REFERRAL_RECORD',
        subject:     `Referral: ${dto.refereeName}`,
        body:        JSON.stringify({
          code,
          referrerTenantId: dto.referrerTenantId,
          referrerName:     referrer.name,
          refereeEmail:     dto.refereeEmail,
          refereeName:      dto.refereeName,
          refereePhone:     dto.refereePhone ?? null,
          source:           dto.source ?? 'direct',
          notes:            dto.notes  ?? null,
          status:           'PENDING',
          convertedAt:      null,
        }),
        recipientId: dto.referrerTenantId,
      },
    });

    const body = JSON.parse(record.body);
    this.logger.log(`Referral created: ${code} from ${referrer.name} → ${dto.refereeName}`);

    return { id: record.id, code, ...body, createdAt: record.createdAt };
  }

  async listByTenant(tenantId: string) {
    const records = await this.prisma.notification.findMany({
      where:   { tenantId, templateId: 'REFERRAL_RECORD' },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r: any) => ({ id: r.id, ...JSON.parse(r.body), createdAt: r.createdAt }));
  }

  async listAll() {
    const records = await this.prisma.notification.findMany({
      where:   { templateId: 'REFERRAL_RECORD' },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r: any) => ({ id: r.id, ...JSON.parse(r.body), createdAt: r.createdAt }));
  }

  async updateStatus(id: string, status: 'PENDING' | 'CONVERTED' | 'REJECTED') {
    const record = await this.prisma.notification.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Referral ${id} not found`);

    const body = JSON.parse(record.body);
    body.status      = status;
    body.convertedAt = status === 'CONVERTED' ? new Date().toISOString() : null;

    return this.prisma.notification.update({
      where: { id },
      data:  { body: JSON.stringify(body) },
    });
  }

  async getStats(tenantId?: string) {
    const all       = tenantId ? await this.listByTenant(tenantId) : await this.listAll();
    const total     = all.length;
    const converted = all.filter((r: any) => r.status === 'CONVERTED').length;
    const pending   = all.filter((r: any) => r.status === 'PENDING').length;
    const rejected  = all.filter((r: any) => r.status === 'REJECTED').length;
    const conversionRate = total > 0 ? Math.round(converted / total * 100) : 0;

    // Top referrers
    const byReferrer: Record<string, number> = {};
    all.forEach((r: any) => { byReferrer[r.referrerName] = (byReferrer[r.referrerName] ?? 0) + 1; });
    const topReferrers = Object.entries(byReferrer)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return { total, converted, pending, rejected, conversionRate, topReferrers };
  }

  async verify(referralCode: string) {
    const all    = await this.listAll();
    const record = all.find((r: any) => r.code === referralCode);
    if (!record) return { valid: false, code: referralCode };
    return { valid: true, code: referralCode, status: record.status, refereeName: record.refereeName };
  }
}
