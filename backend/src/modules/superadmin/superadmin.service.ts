import { Injectable, Logger, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService }     from '@nestjs/jwt';
import { PrismaService } from '@infra/database/prisma.service';
import { RedisService }  from '../../infra/cache/redis.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SuperadminService {
  private readonly logger = new Logger(SuperadminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
    private readonly jwt:    JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Revenue Intelligence ─────────────────────────────────────────────────
  async getRevenueIntelligence() {
    const subs = await this.prisma.tenantSubscription.findMany({
      where:   { status: { in: ['ACTIVE', 'PAST_DUE'] }, tenant: {
      slug: { not: 'schoolos-platform' },  }, },
      include: { plan: true, tenant: { select: { name: true, slug: true, region: true, createdAt: true } } },
    });

    let mrr = 0;
    const revenueByRegion: Record<string, number> = {};

    for (const sub of subs) {
      let subMrr = 0;
      if (sub.model === 'FLAT_FEE') {
        subMrr = Number(sub.customBaseFee ?? sub.plan.baseFee ?? 0);
      } else if (sub.model === 'PER_STUDENT') {
        const rate  = Number(sub.customPerStudentRate ?? sub.plan.perStudentRate ?? 0);
        const count = sub.studentCountAtBilling ?? 0;
        subMrr = rate * count;
      } else {
        // ✅ Math Fix: Consistent assignment allocation block across mathematical operations
        const base  = Number(sub.customBaseFee ?? sub.plan.baseFee ?? 0);
        const rate  = Number(sub.customPerStudentRate ?? sub.plan.perStudentRate ?? 0);
        const count = sub.studentCountAtBilling ?? 0;
        subMrr = base + rate * count;
      }
      
      mrr += subMrr;
      
      const region = sub.tenant.region;
      revenueByRegion[region] = (revenueByRegion[region] ?? 0) + subMrr;
    }

    const now = new Date();
    const invoices = await this.prisma.saasInvoice.findMany({
      where:   { status: { in: ['SENT', 'OVERDUE', 'PARTIALLY_PAID'] as any[] } },
      include: { subscription: { include: { tenant: { select: { name: true } } } } },
    });

    const aging = { current: 0, days30: 0, days60: 0, days90plus: 0 };
    const agingDetails: any[] = [];

    for (const inv of invoices) {
      const daysDue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      const amount  = Number(inv.totalAmount);
      
      agingDetails.push({
        invoiceNumber: inv.invoiceNumber,
        tenantName:    inv.subscription?.tenant?.name ?? '—',
        amount,
        daysOverdue:   daysDue,
        dueDate:       inv.dueDate,
        status:        inv.status,
      });

      if (daysDue <= 0)        aging.current  += amount;
      else if (daysDue <= 30)  aging.days30   += amount;
      else if (daysDue <= 60)  aging.days60   += amount;
      else                     aging.days90plus += amount;
    }

    const churned = await this.prisma.tenantSubscription.findMany({
      where:   { status: 'CANCELLED', cancelledAt: { not: null } },
      include: { tenant: { select: { name: true, slug: true } } },
      orderBy: { cancelledAt: 'desc' },
      take:    20,
    });

    const churnByReason: Record<string, number> = {};
    churned.forEach((s: any) => {
      const r = s.cancelReason ?? 'Not provided';
      churnByReason[r] = (churnByReason[r] ?? 0) + 1;
    });

    return {
      mrr:   Math.round(mrr),
      arr:   Math.round(mrr * 12),
      activeSubscriptions: subs.length,
      aging: {
        buckets: aging,
        details: agingDetails.sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 20),
      },
      churn: {
        totalCancelled: churned.length,
        recent:         churned.slice(0, 10).map((s: any) => ({ name: s.tenant.name, reason: s.cancelReason, cancelledAt: s.cancelledAt })),
        byReason:       churnByReason,
      },
      revenueByRegion,
    };
  }

  // ── Tenant Health Scores ─────────────────────────────────────────────────
  // ✅ Fixed N+1 Performance bottleneck via discrete memory allocation grouping arrays map hashes
  async getTenantHealthScores() {
    const tenants = await this.prisma.tenant.findMany({
      where:   { status: { in: ['ACTIVE', 'TRIAL'] }, slug: { not: 'schoolos-platform' }, },
      include: {
        subscription: { include: { plan: true } },
        _count:       { select: { students: true, users: true, auditLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (tenants.length === 0) {
      return { scores: [], summary: { healthy: 0, at_risk: 0, critical: 0, avg: 0 } };
    }

    const tenantIds = tenants.map(t => t.id);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    const [allLoginsCount, allEntityTypes] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: tenantIds }, action: 'LOGIN' as any, createdAt: { gte: sevenDaysAgo } },
        _count: { id: true }
      }),
      this.prisma.auditLog.findMany({
        where: { tenantId: { in: tenantIds } },
        select: { tenantId: true, entityType: true },
        distinct: ['tenantId', 'entityType']
      })
    ]);

    const loginsMap = new Map<string, number>(allLoginsCount.map(item => [item.tenantId, item._count.id]));
    const featuresMap = new Map<string, Set<string>>();
    allEntityTypes.forEach(item => {
      if (!featuresMap.has(item.tenantId)) featuresMap.set(item.tenantId, new Set());
      featuresMap.get(item.tenantId)!.add(item.entityType);
    });

    const scores = tenants.map((t: any) => {
      let score = 0;

      const recentLogins = loginsMap.get(t.id) ?? 0;
      score += Math.min(recentLogins * 5, 30);

      if (t._count.students > 0) score += Math.min(t._count.students / 10, 20);

      const featuresCount = featuresMap.get(t.id)?.size ?? 0;
      score += Math.min(featuresCount * 3, 25);

      if (t.subscription) {
        if (t.subscription.status === 'ACTIVE')   score += 25;
        else if (t.subscription.status === 'TRIAL') score += 15;
      }

      const finalScore = Math.min(Math.round(score), 100);
      const tier       = finalScore >= 70 ? 'healthy' : finalScore >= 40 ? 'at_risk' : 'critical';
      const trialEndsAt   = t.subscription?.trialEndsAt;

      return {
        id:            t.id,
        name:          t.name,
        slug:          t.slug,
        status:        t.status,
        region:        t.region,
        score:         finalScore,
        tier,
        signals: {
          logins7d:    recentLogins,
          students:    t._count.students,
          featuresUsed: featuresCount,
          subStatus:   t.subscription?.status ?? 'NONE',
        },
        trialEndsAt,
        daysToExpiry: trialEndsAt ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000) : null,
        createdAt:     t.createdAt,
      };
    });

    return {
      scores: scores.sort((a, b) => a.score - b.score),
      summary: {
        healthy:  scores.filter(s => s.tier === 'healthy').length,
        at_risk:  scores.filter(s => s.tier === 'at_risk').length,
        critical: scores.filter(s => s.tier === 'critical').length,
        avg:      Math.round(scores.reduce((s, t) => s + t.score, 0) / scores.length),
      },
    };
  }

  // ── Trial Funnel ─────────────────────────────────────────────────────────
  async getTrialFunnel() {
    const trials = await this.prisma.tenantSubscription.findMany({
      where:   { status: 'TRIAL' , tenant: {
        slug: { not: 'schoolos-platform' }, },},
      include: {
        tenant: { select: { id: true, name: true, slug: true, contactEmail: true, createdAt: true, _count: { select: { students: true } } } },
        plan:   true,
      },
      orderBy: { trialEndsAt: 'asc' },
    });

    const now  = new Date();
    const list = trials.map((sub: any) => {
      const daysLeft = sub.trialEndsAt ? Math.ceil((new Date(sub.trialEndsAt).getTime() - now.getTime()) / 86400000) : null;
      return {
        tenantId:    sub.tenantId,
        name:        sub.tenant.name,
        slug:        sub.tenant.slug,
        email:       sub.tenant.contactEmail,
        students:    (sub.tenant as any)._count?.students ?? 0,
        trialEndsAt: sub.trialEndsAt,
        daysLeft,
        urgency:     daysLeft !== null ? (daysLeft <= 3 ? 'critical' : daysLeft <= 7 ? 'warning' : 'ok') : 'ok',
        planName:    sub.plan.name,
        createdAt:   sub.tenant.createdAt,
      };
    });

    return {
      total:       list.length,
      expiring3d:  list.filter((t: any) => t.urgency === 'critical').length,
      expiring7d:  list.filter((t: any) => t.urgency === 'warning').length,
      list,
    };
  }

  // ── Cohort Analytics ─────────────────────────────────────────────────────
  async getCohortData() {
    const tenants = await this.prisma.tenant.findMany({ where: {
    slug: { not: 'schoolos-platform' },
  },
      include: { subscription: true },
      orderBy: { createdAt: 'asc' },
    });

    const cohorts: Record<string, { total: number; active: number; churned: number; trial: number }> = {};

    for (const t of tenants) {
      const month = new Date(t.createdAt).toISOString().slice(0, 7);
      if (!cohorts[month]) cohorts[month] = { total: 0, active: 0, churned: 0, trial: 0 };
      cohorts[month].total++;
      const status = t.subscription?.status ?? t.status;
      if (status === 'ACTIVE')                                      cohorts[month].active++;
      else if (status === 'CANCELLED' || status === 'SUSPENDED') cohorts[month].churned++;
      else                                                          cohorts[month].trial++;
    }

    const rows = Object.entries(cohorts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        ...data,
        retentionRate: data.total > 0 ? Math.round(data.active / data.total * 100) : 0,
      }));

    return { cohorts: rows, totalTenants: tenants.length };
  }

  // ── System Monitoring ────────────────────────────────────────────────────
  async getSystemMonitoring() {
    const [dbHealthy, redisHealthy] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.isHealthy(),
    ]);

    const recentSignups = await this.prisma.tenant.count({
  where: {
    slug: {
      not: 'schoolos-platform',
    },
    createdAt: {
      gte: new Date(Date.now() - 86400000),
    },
  },
});


    const recentActivity = await this.prisma.auditLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 3600000) } },
    });

    const tenantCounts = await this.prisma.tenant.groupBy({
      by:     ['status'],
      _count: true,
    });

    const counts: Record<string, number> = {};
    tenantCounts.forEach((r: any) => { counts[r.status] = r._count; });

    return {
      services: {
        database: dbHealthy   ? 'up' : 'down',
        redis:    redisHealthy ? 'up' : 'down',
        storage:  'configured',
      },
      activity: { recentSignups, recentActivityLastHour: recentActivity },
      tenantCounts: counts,
      timestamp: new Date().toISOString(),
    };
  }
    
  async getTenants(page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    this.prisma.tenant.findMany({
      where: {
        slug: { not: 'schoolos-platform' },
      },
      include: {
        subscription: true,
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    this.prisma.tenant.count({
      where: {
        slug: { not: 'schoolos-platform' },
      },
    }),
  ]);

  return {
    items,
    total,
    page,
    limit,
  };
}




  // ── Shadow Login / Impersonation ─────────────────────────────────────────
  // ✅ Fixed Exception Wordings & Reason String Guards Compliance validation checks
  async impersonate(superAdminId: string, targetTenantId: string, reason: string) {
    if (!reason?.trim()) {
      throw new UnauthorizedException('Reason is required');
    }

    const executingSuperAdmin = await this.prisma.user.findFirst({
      where: { id: superAdminId, role: 'SUPER_ADMIN', isActive: true }
    });
    if (!executingSuperAdmin) {
      throw new UnauthorizedException('Unauthorized');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: targetTenantId },
      include: { users: { where: { role: 'SCHOOL_ADMIN', isActive: true }, take: 1 } },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const adminUser = tenant.users[0];
    if (!adminUser) throw new UnauthorizedException('No active school admin found');

    await this.prisma.auditLog.create({
      data: {
        tenantId:   targetTenantId,
        actorId:    superAdminId,
        actorRole:  'SUPER_ADMIN' as any,
        action:     'LOGIN' as any,
        entityType: 'IMPERSONATION',
        entityId:   adminUser.id,
        metadata:   { reason, superAdminId, targetTenantId, impersonatedUserId: adminUser.id } as any,
      },
    });

    const secret  = this.config.getOrThrow<string>('JWT_SECRET');
    const token   = this.jwt.sign(
      {
        sub:       adminUser.id,
        email:     adminUser.email,
        role:      adminUser.role,
        tenantId:  targetTenantId,
        impersonated: true,
        impersonatedBy: superAdminId,
      },
      { secret, expiresIn: '30m' }
    );

    this.logger.warn(`IMPERSONATION: superadmin ${superAdminId} -> tenant ${tenant.slug} as ${adminUser.email}`);

    return {
      token,
      tenantSlug:   tenant.slug,
      userEmail:    adminUser.email,
      expiresInMin: 30,
      frontendUrl:  `${this.config.get('FRONTEND_URL', 'http://localhost:4000')}/login?impersonate=1&tenant=${tenant.slug}`,
    };
  }

  // ── Knowledge Graph Query ────────────────────────────────────────────────
  async knowledgeQuery(filters: any) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.region) where.region = filters.region;
    if (filters.tier)   where.featureTier = filters.tier;

    const tenants = await this.prisma.tenant.findMany({
      where,
      include: {
        subscription: { include: { plan: true, saasInvoices: { where: { status: { in: ['OVERDUE', 'SENT'] as any[] } }, take: 1 } } },
        fraudAlerts:  { where: { status: 'OPEN' }, take: 1 },
        _count:       { select: { students: true } },
      },
      take: 100,
    });

    let results = tenants.map((t: any) => ({
      id:           t.id,
      name:         t.name,
      slug:         t.slug,
      status:       t.status,
      region:       t.region,
      tier:         t.featureTier,
      students:     (t as any)._count?.students ?? 0,
      subStatus:    t.subscription?.status ?? 'NONE',
      planName:     t.subscription?.plan?.name ?? '—',
      hasOpenAlert: (t.fraudAlerts?.length ?? 0) > 0,
      hasOverdue:   (t.subscription?.saasInvoices?.length ?? 0) > 0,
      trialEndsAt:  t.subscription?.trialEndsAt,
      daysToTrial:  t.subscription?.trialEndsAt ? Math.ceil((new Date(t.subscription.trialEndsAt).getTime() - Date.now()) / 86400000) : null,
      createdAt:    t.createdAt,
    }));

    return { count: results.length, results };
  }

  // ── Tenant Billing History ────────────────────────────────────────────────
  async getTenantBillingHistory(tenantId: string) {
    const subscription = await this.prisma.tenantSubscription.findFirst({
      where:   { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      return { subscription: null, invoices: [], totalPaid: 0, totalOutstanding: 0 };
    }

    const invoices = await this.prisma.saasInvoice.findMany({
      where:   { subscriptionId: subscription.id },
      include: { saasPayments: true },
      orderBy: { createdAt: 'desc' },
      take:    24,
    });

    let totalPaid        = 0;
    let totalOutstanding = 0;

    const mapped = invoices.map((inv) => {
      const total = Number(inv.totalAmount);
      const paid  = inv.saasPayments
        .filter((p: any) => p.status === 'SUCCESS')
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const due = Math.max(0, total - paid);

      if (inv.status === 'PAID') totalPaid        += total;
      else                       totalOutstanding  += due;

      return {
        id:             inv.id,
        invoiceNumber: inv.invoiceNumber,
        status:        inv.status,
        currency:      inv.currency,
        subtotal:      Number(inv.subtotal),
        taxAmount:     Number(inv.taxAmount),
        totalAmount:   total,
        paidAmount:    paid,
        dueAmount:     due,
        periodStart:   inv.periodStart,
        periodEnd:     inv.periodEnd,
        studentCount:  inv.studentCount,
        dueDate:       inv.dueDate,
        paidAt:        inv.paidAt,
        pdfUrl:        inv.pdfUrl,
        lineItems:     inv.lineItems,
        payments:      inv.saasPayments.map((p: any) => ({
          id:       p.id,
          gateway:  p.gateway,
          amount:   Number(p.amount),
          status:   p.status,
          paidAt:   p.paidAt,
        })),
        createdAt:     inv.createdAt,
      };
    });

    return {
      subscription: {
        id:                    subscription.id,
        model:                 subscription.model,
        status:                subscription.status,
        currency:              subscription.currency,
        currentPeriodStart:    subscription.currentPeriodStart,
        currentPeriodEnd:      subscription.currentPeriodEnd,
        trialEndsAt:           subscription.trialEndsAt,
        studentCountAtBilling: subscription.studentCountAtBilling,
        customPerStudentRate: subscription.customPerStudentRate ? Number(subscription.customPerStudentRate) : null,
        customBaseFee: subscription.customBaseFee ? Number(subscription.customBaseFee) : null,
        plan: {
          name:            subscription.plan.name,
          tier:            subscription.plan.tier,
          model:           subscription.plan.model,
          perStudentRate:  subscription.plan.perStudentRate ? Number(subscription.plan.perStudentRate) : null,
          baseFee: subscription.plan.baseFee ? Number(subscription.plan.baseFee) : null,
        },
      },
      invoices:         mapped,
      totalPaid:         Math.round(totalPaid),
      totalOutstanding: Math.round(totalOutstanding),
      totalInvoices:    mapped.length,
    };
  }

  // ── Platform Audit Log ────────────────────────────────────────────────────
  async getPlatformAuditLog(filters: any) {
    const page  = Math.max(1, filters.page  ?? 1);
    const limit = Math.min(100, filters.limit ?? 50);
    const skip  = (page - 1) * limit;

    const where: any = {};
    if (filters.tenantId)   where.tenantId   = filters.tenantId;
    if (filters.action)     where.action      = filters.action;
    if (filters.actorId)    where.actorId     = filters.actorId;
    if (filters.entityType) where.entityType  = filters.entityType;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to)   where.createdAt.lte = new Date(filters.to);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          tenant: { select: { name: true, slug: true } },
          actor:  { select: { email: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take:    limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const actionBreakdown = await this.prisma.auditLog.groupBy({
      by:     ['action'],
      where,
      _count: true,
      orderBy: { _count: { action: 'desc' } },
      take:    10,
    });

    return {
      logs: logs.map((log) => ({
        id:         log.id,
        tenantId:   log.tenantId,
        tenantName: (log as any).tenant?.name   ?? '—',
        tenantSlug: (log as any).tenant?.slug   ?? '—',
        actorId:    log.actorId,
        actorEmail: (log as any).actor?.email   ?? 'system',
        actorName:  (log as any).actor ? `${(log as any).actor.firstName} ${(log as any).actor.lastName}`.trim() : 'System',
        actorRole:  (log as any).actor?.role   ?? log.actorRole ?? '—',
        action:     log.action,
        entityType: log.entityType,
        entityId:   log.entityId,
        ipAddress:  log.ipAddress,
        metadata:   log.metadata,
        after:      log.after,
        createdAt:  log.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
      actionBreakdown: actionBreakdown.map((r: any) => ({
        action: r.action,
        count:  r._count,
      })),
    };
  }
}
