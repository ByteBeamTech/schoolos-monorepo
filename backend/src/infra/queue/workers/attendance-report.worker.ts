// infra/queue/workers/attendance-report.worker.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger }             from '@nestjs/common';
import { Job }                from 'bull';
import { QUEUE_NAMES }        from '../queue.module';
import { PrismaService } from '@infra/database/prisma.service';

export interface AttendanceReportJob {
  tenantId:    string;
  branchId?:   string;
  classId?:    string;
  date:        string; // ISO date
  reportType:  'daily' | 'weekly' | 'monthly';
}

@Processor(QUEUE_NAMES.ATTENDANCE)
export class AttendanceReportWorker {
  private readonly logger = new Logger(AttendanceReportWorker.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('generate-report')
  async handleGenerateReport(job: Job<AttendanceReportJob>) {
    const { tenantId, branchId, classId, date, reportType } = job.data;
    this.logger.log(`[AttendanceWorker] Generating ${reportType} report for tenant=${tenantId} date=${date}`);

    const targetDate = new Date(date);
    let startDate: Date;
    let endDate: Date = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    switch (reportType) {
      case 'daily':
        startDate = new Date(targetDate);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate = new Date(targetDate);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);
        break;
    }

    const where: any = {
      tenantId,
      date: { gte: startDate, lte: endDate },
      ...(branchId ? { branchId } : {}),
      ...(classId  ? { classId }  : {}),
    };

    const records = await this.prisma.attendance.findMany({ where });

    const summary = {
      tenantId,
      reportType,
      date,
      total:   records.length,
      present: records.filter((r: any) => r.status === 'PRESENT').length,
      absent:  records.filter((r: any) => r.status === 'ABSENT').length,
      late:    records.filter((r: any) => r.status === 'LATE').length,
      onLeave: records.filter((r: any) => r.status === 'ON_LEAVE').length,
    };

    this.logger.log(`[AttendanceWorker] Report done: ${JSON.stringify(summary)}`);
    return summary;
  }
}
