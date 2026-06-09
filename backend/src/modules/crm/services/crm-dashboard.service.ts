import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { buildReadScope } from './branch-scope.util';

export interface CrmDashboardSummary {
  scope: { tenantId: string; branchId?: string; tenantWide: boolean };
  counts: {
    newLeads: number;
    openLeads: number;
    todaysFollowUps: number;
    overdueFollowUps: number;
    applicationsSubmitted: number;
    applicationsPendingApproval: number;
    admissionsApproved: number;
    admissionsRejected: number;
    enrollmentsCompleted: number;
  };
  pipeline: Array<{ status: string; count: number }>;
  workQueue: {
    todaysFollowUps: Array<{
      id: string;
      title: string;
      dueDate: Date;
      leadId: string;
      leadName: string;
      leadPhone: string;
      assignedToId: string;
    }>;
    overdueFollowUps: Array<{
      id: string;
      title: string;
      dueDate: Date;
      leadId: string;
      leadName: string;
      leadPhone: string;
      assignedToId: string;
    }>;
  };
  conversion: {
    leadsCreated: number;
    applicationsCreated: number;
    enrolled: number;
    leadToApplicationPct: number;
    applicationToEnrolledPct: number;
    leadToEnrolledPct: number;
  };
  sources: Array<{ sourceId: string | null; sourceName: string; leads: number; enrolled: number; conversionPct: number }>;
}

const OPEN_LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'FOLLOW_UP',
  'VISIT_SCHEDULED',
  'INTERESTED',
  'APPLICATION_STARTED',
] as const;

const PIPELINE_STATUSES = [
  'NEW',
  'CONTACTED',
  'FOLLOW_UP',
  'VISIT_SCHEDULED',
  'INTERESTED',
  'APPLICATION_STARTED',
  'APPLICATION_SUBMITTED',
  'APPROVED',
  'ENROLLED',
  'LOST',
] as const;

@Injectable()
export class CrmDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(user: AuthenticatedUser, branchIdFilter?: string): Promise<CrmDashboardSummary> {
    const scope = buildReadScope(user, branchIdFilter);
    const leadWhere: Prisma.LeadWhereInput = { ...scope.where };

    // For follow-ups, we filter via the linked lead's branch.
    const taskBranchClause: Prisma.FollowUpTaskWhereInput = scope.tenantWide
      ? scope.branchId
        ? { lead: { branchId: scope.branchId } }
        : {}
      : { lead: { branchId: user.branchId! } };

    // Date windows
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const last30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    // ---- COUNTS ----
    const [
      newLeads,
      openLeads,
      todaysFollowUps,
      overdueFollowUps,
      applicationsSubmitted,
      applicationsPendingApproval,
      admissionsApproved,
      admissionsRejected,
      enrollmentsCompleted,
    ] = await this.prisma.$transaction([
      this.prisma.lead.count({ where: { ...leadWhere, status: 'NEW' as any } }),
      this.prisma.lead.count({
        where: { ...leadWhere, status: { in: OPEN_LEAD_STATUSES as any } },
      }),
      this.prisma.followUpTask.count({
        where: {
          tenantId: user.tenantId,
          ...taskBranchClause,
          dueDate: { gte: startOfDay, lte: endOfDay },
          status: { in: ['PENDING', 'IN_PROGRESS'] as any },
        },
      }),
      this.prisma.followUpTask.count({
        where: {
          tenantId: user.tenantId,
          ...taskBranchClause,
          dueDate: { lt: startOfDay },
          status: { in: ['PENDING', 'IN_PROGRESS'] as any },
        },
      }),
      this.prisma.admissionApplication.count({
        where: {
          ...scope.where,
          status: { in: ['SUBMITTED', 'IN_REVIEW'] as any },
        },
      }),
      this.prisma.admissionApplication.count({
        where: { ...scope.where, status: 'IN_REVIEW' as any },
      }),
      this.prisma.admissionApplication.count({
        where: { ...scope.where, status: 'APPROVED' as any },
      }),
      this.prisma.admissionApplication.count({
        where: { ...scope.where, status: 'REJECTED' as any },
      }),
      this.prisma.admissionApplication.count({
        where: { ...scope.where, status: 'ENROLLED' as any },
      }),
    ]);

    // ---- PIPELINE (group by status) ----
    const pipelineRows = await this.prisma.lead.groupBy({
      by: ['status'],
      where: leadWhere,
      _count: { _all: true },
    });
    const pipelineMap = new Map<string, number>();
    for (const r of pipelineRows) pipelineMap.set(r.status as string, r._count._all);
    const pipeline = PIPELINE_STATUSES.map((s) => ({
      status: s,
      count: pipelineMap.get(s) ?? 0,
    }));

    // ---- WORK QUEUE (today / overdue) ----
    const [todayTasks, overdueTasks] = await this.prisma.$transaction([
      this.prisma.followUpTask.findMany({
        where: {
          tenantId: user.tenantId,
          ...taskBranchClause,
          dueDate: { gte: startOfDay, lte: endOfDay },
          status: { in: ['PENDING', 'IN_PROGRESS'] as any },
        },
        orderBy: [{ dueDate: 'asc' }],
        take: 50,
        include: {
          lead: { select: { id: true, parentName: true, parentPhone: true } },
        },
      }),
      this.prisma.followUpTask.findMany({
        where: {
          tenantId: user.tenantId,
          ...taskBranchClause,
          dueDate: { lt: startOfDay },
          status: { in: ['PENDING', 'IN_PROGRESS'] as any },
        },
        orderBy: [{ dueDate: 'asc' }],
        take: 50,
        include: {
          lead: { select: { id: true, parentName: true, parentPhone: true } },
        },
      }),
    ]);

    const shapeTask = (t: typeof todayTasks[number]) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      leadId: t.leadId,
      leadName: t.lead?.parentName ?? '',
      leadPhone: t.lead?.parentPhone ?? '',
      assignedToId: t.assignedToId,
    });

    // ---- CONVERSION (last 30 days) ----
    const [leadsCreated, applicationsCreated, enrolledRecent] = await this.prisma.$transaction([
      this.prisma.lead.count({ where: { ...leadWhere, createdAt: { gte: last30 } } }),
      this.prisma.admissionApplication.count({
        where: { ...scope.where, createdAt: { gte: last30 } },
      }),
      this.prisma.admissionApplication.count({
        where: { ...scope.where, status: 'ENROLLED' as any, convertedAt: { gte: last30 } },
      }),
    ]);

    const pct = (num: number, den: number) =>
      den === 0 ? 0 : Math.round((num / den) * 1000) / 10;

    // ---- LEAD SOURCE BREAKDOWN (last 30 days) ----
    const sourceGroups = await this.prisma.lead.groupBy({
      by: ['sourceId'],
      where: { ...leadWhere, createdAt: { gte: last30 } },
      _count: { _all: true },
    });

    // For "enrolled" per source, join Lead.application.status = ENROLLED.
    const enrolledBySource = await this.prisma.lead.groupBy({
      by: ['sourceId'],
      where: {
        ...leadWhere,
        createdAt: { gte: last30 },
        application: { is: { status: 'ENROLLED' as any } },
      },
      _count: { _all: true },
    });
    const enrolledMap = new Map<string | null, number>();
    for (const r of enrolledBySource)
      enrolledMap.set(r.sourceId as string | null, r._count._all);

    const sourceIds = sourceGroups
      .map((g) => g.sourceId)
      .filter((id): id is string => !!id);
    const sourceNames = sourceIds.length
      ? await this.prisma.leadSource.findMany({
          where: { id: { in: sourceIds }, tenantId: user.tenantId },
          select: { id: true, name: true },
        })
      : [];
    const nameMap = new Map(sourceNames.map((s) => [s.id, s.name]));

    const sources = sourceGroups.map((g) => {
      const id = g.sourceId as string | null;
      const leads = g._count._all;
      const enrolled = enrolledMap.get(id) ?? 0;
      return {
        sourceId: id,
        sourceName: id ? nameMap.get(id) ?? 'Unknown' : 'Direct / Unknown',
        leads,
        enrolled,
        conversionPct: pct(enrolled, leads),
      };
    });

    return {
      scope: {
        tenantId: user.tenantId,
        branchId: scope.branchId,
        tenantWide: scope.tenantWide,
      },
      counts: {
        newLeads,
        openLeads,
        todaysFollowUps,
        overdueFollowUps,
        applicationsSubmitted,
        applicationsPendingApproval,
        admissionsApproved,
        admissionsRejected,
        enrollmentsCompleted,
      },
      pipeline,
      workQueue: {
        todaysFollowUps: todayTasks.map(shapeTask),
        overdueFollowUps: overdueTasks.map(shapeTask),
      },
      conversion: {
        leadsCreated,
        applicationsCreated,
        enrolled: enrolledRecent,
        leadToApplicationPct: pct(applicationsCreated, leadsCreated),
        applicationToEnrolledPct: pct(enrolledRecent, applicationsCreated),
        leadToEnrolledPct: pct(enrolledRecent, leadsCreated),
      },
      sources: sources.sort((a, b) => b.leads - a.leads),
    };
  }
}
