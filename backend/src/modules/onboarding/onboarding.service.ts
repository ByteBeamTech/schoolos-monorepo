import {
  Injectable, Logger, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import * as bcrypt from 'bcryptjs';
import { OnboardTenantDto } from './onboarding.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Validate slug uniqueness (real-time check) ────────────────────────────
  async checkSlug(slug: string) {
    const exists = await this.prisma.tenant.findFirst({ where: { slug } });
    return { available: !exists, slug };
  }

  // ── Full onboarding — atomic transaction ──────────────────────────────────
  async onboardTenant(dto: OnboardTenantDto, actorId: string) {
    // Validate slug
    const slugExists = await this.prisma.tenant.findFirst({ where: { slug: dto.slug } });
    if (slugExists) throw new ConflictException(`School ID "${dto.slug}" is already taken`);

    // Validate admin email not already used globally (check across tenants)
    const emailExists = await this.prisma.user.findFirst({
      where: { email: dto.adminEmail.toLowerCase() },
    });
    if (emailExists) throw new ConflictException(`Admin email "${dto.adminEmail}" is already registered`);

    // Resolve pricing plan
    let plan = dto.planId
      ? await this.prisma.pricingPlan.findUnique({ where: { id: dto.planId } })
      : await this.prisma.pricingPlan.findFirst({
          where: { tier: 'STARTER', currency: (dto.currency ?? 'INR') as any, isActive: true },
          orderBy: { createdAt: 'asc' },
        });

    if (!plan) {
      // Fallback: find any active plan
      plan = await this.prisma.pricingPlan.findFirst({ where: { isActive: true } });
    }
    if (!plan) throw new BadRequestException('No active pricing plans found. Run the seed script first.');

    const trialDays = dto.trialDays ?? plan.trialDays ?? 30;
    const now       = new Date();
    const trialEnd  = new Date(now.getTime() + trialDays * 86400000);

    // Hash password
    const passwordHash = await bcrypt.hash(dto.adminPassword, BCRYPT_ROUNDS);

    // Build academic session name
    const year        = now.getFullYear();
    const sessionName = dto.sessionName ?? `${year}-${(year + 1).toString().slice(2)}`;

    // ── Atomic creation ──────────────────────────────────────────────────
    const result = await this.prisma.$transaction(async (tx: any) => {
      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name:         dto.schoolName,
          slug:         dto.slug,
          contactEmail: dto.adminEmail.toLowerCase(),
          contactPhone: dto.contactPhone,
          status:       trialDays > 0 ? 'TRIAL' : 'ACTIVE',
          featureTier:  plan!.tier,
          maxStudents:  dto.maxStudents ?? plan!.studentLimit ?? 500,
          region:       (dto.region ?? 'IN') as any,
          currency:     (dto.currency ?? 'INR') as any,
          timezone:     dto.region === 'US' ? 'America/New_York' : 'Asia/Kolkata',
          locale:       dto.region === 'US' ? 'en-US' : 'en-IN',
        },
      });

      // 2. Create admin user
      const adminUser = await tx.user.create({
        data: {
          tenantId:        tenant.id,
          email:           dto.adminEmail.toLowerCase(),
          passwordHash,
          firstName:       dto.adminFirstName,
          lastName:        dto.adminLastName,
          role:            'SCHOOL_ADMIN',
          isActive:        true,
          isEmailVerified: false,
        },
      });

      // 2A. Create primary branch
const primaryBranch = await tx.branch.create({
  data: {
    tenantId: tenant.id,
    name: 'Main Campus',
    branchCode: 'MAIN',
    isPrimary: true,
    isActive: true,
    status: 'ACTIVE',
    slug: `${tenant.slug}-main`,
  },
});

// 2B. Assign admin to default branch
await tx.userBranch.create({
  data: {
    tenantId: tenant.id,
    userId: adminUser.id,
    branchId: primaryBranch.id,
    isDefault: true,
    isActive: true,
  },
});

      // 3. Create subscription
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId:           tenant.id,
          planId:             plan!.id,
          model:              plan!.model,
          status:             trialDays > 0 ? 'TRIAL' : 'ACTIVE',
          currency:           (dto.currency ?? 'INR') as any,
          currentPeriodStart: now,
          currentPeriodEnd:   trialEnd,
          trialEndsAt:        trialDays > 0 ? trialEnd : null,
        },
      });

      // 4. Create first academic session
      const session = await tx.academicSession.create({
        data: {
          tenantId:  tenant.id,
          name:      sessionName,
          startDate: new Date(`${year}-04-01`),
          endDate:   new Date(`${year + 1}-03-31`),
          isCurrent: true,
          isLocked:  false,
        },
      });

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          tenantId:   tenant.id,
          actorId,
          actorRole:  'SUPER_ADMIN' as any,
          action:     'CREATE' as any,
          entityType: 'Tenant',
          entityId:   tenant.id,
          after: {
            name: tenant.name, slug: tenant.slug,
            plan: plan!.name, trialDays,
          } as any,
        },
      });

      return { tenant, adminUser, primaryBranch, subscription, session };
    });

    this.logger.log(
      `ONBOARDED: ${result.tenant.name} (${result.tenant.slug}) | plan: ${plan.name} | trial: ${trialDays}d | by: ${actorId}`
    );

    return {
      success:      true,
      tenantId:     result.tenant.id,
      branchId:     result.primaryBranch.id,
      slug:         result.tenant.slug,
      name:         result.tenant.name,
      adminEmail:   result.adminUser.email,
      plan:         plan.name,
      trialEndsAt:  result.subscription.trialEndsAt,
      sessionName:  result.session.name,
      loginUrl:     `${process.env.FRONTEND_URL ?? 'http://localhost:4000'}/login`,
      message:      `School "${dto.schoolName}" onboarded successfully. Admin can login at the frontend URL.`,
    };
  }

  // ── List all pricing plans (for dropdown in UI) ───────────────────────────
  async getPlans() {
    return this.prisma.pricingPlan.findMany({
      where:   { isActive: true },
      orderBy: [{ tier: 'asc' }, { currency: 'asc' }],
    });
  }

  // ── Stats for onboarding dashboard ───────────────────────────────────────
  async getStats() {
    const [total, trial, active, suspended] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'TRIAL' } }),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
    ]);
    return { total, trial, active, suspended };
  }

  // ── List tenants with pagination + search ─────────────────────────────────
  async listTenants(filters: { page?: number; limit?: number; search?: string; status?: string }) {
    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 20;
    const where: any = { deletedAt: null };

    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { name:         { contains: filters.search, mode: 'insensitive' } },
        { slug:         { contains: filters.search, mode: 'insensitive' } },
        { contactEmail: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: {
          subscription: { include: { plan: { select: { name: true, tier: true } } } },
          _count:       { select: { students: true, users: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  // ── Get single tenant detail ──────────────────────────────────────────────
  async getTenant(id: string) {
    return this.prisma.tenant.findUnique({
      where:   { id },
      include: {
        subscription: { include: { plan: true } },
        users:        { where: { role: 'SCHOOL_ADMIN', isActive: true }, select: { email: true, firstName: true, lastName: true, lastLoginAt: true } },
        _count:       { select: { students: true, users: true, auditLogs: true } },
      },
    });
  }

  // ── Update tenant status ──────────────────────────────────────────────────
  async updateTenantStatus(id: string, status: string, actorId: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data:  { status: status as any },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId:   id,
        actorId,
        actorRole:  'SUPER_ADMIN' as any,
        action:     'UPDATE' as any,
        entityType: 'Tenant',
        entityId:   id,
        after:      { status } as any,
      },
    });
    return tenant;
  }

  // ── Reset admin password ──────────────────────────────────────────────────
  async resetAdminPassword(tenantId: string, newPassword: string, actorId: string) {
    const admin = await this.prisma.user.findFirst({
      where: { tenantId, role: 'SCHOOL_ADMIN', isActive: true },
    });
    if (!admin) throw new BadRequestException('No active SCHOOL_ADMIN found for this tenant');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: admin.id }, data: { passwordHash } });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorId,
        actorRole:  'SUPER_ADMIN' as any,
        action:     'UPDATE' as any,
        entityType: 'User',
        entityId:   admin.id,
        after:      { action: 'password_reset_by_superadmin' } as any,
      },
    });

    return { success: true, adminEmail: admin.email };
  }
}
