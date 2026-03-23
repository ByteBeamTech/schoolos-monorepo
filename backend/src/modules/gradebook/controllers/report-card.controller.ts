// ─────────────────────────────────────────────────────────────────────────────
// FILE: backend/src/modules/gradebook/controllers/report-card.controller.ts
// ─────────────────────────────────────────────────────────────────────────────
import {
  Controller, Get, Param, Query, UseGuards, Res,
} from '@nestjs/common';
import { Response }          from 'express';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { ReportCardService } from '../services/report-card.service';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

// ── Inline HTML builder — no external package dependency ─────────────────────
function buildReportCardHtml(data: any, schoolName: string): string {
  const fmt  = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const gClr = (g: string) => g === 'A+' || g === 'A' ? '#059669' : g === 'B+' || g === 'B' ? '#2563eb' : g === 'C' ? '#d97706' : '#dc2626';
  const gBg  = (g: string) => g === 'A+' || g === 'A' ? '#d1fae5' : g === 'B+' || g === 'B' ? '#dbeafe' : g === 'C' ? '#fef3c7' : '#fee2e2';

  const rows = (data.subjects ?? []).map((s: any) => {
    const pass   = !s.isAbsent && (s.obtained ?? 0) >= s.passMarks;
    const status = s.isAbsent ? 'AB' : pass ? 'P' : 'F';
    const stClr  = s.isAbsent ? '#d97706' : pass ? '#059669' : '#dc2626';
    return `<tr>
      <td style="font-weight:500">${s.name}</td>
      <td style="text-align:center">${s.maxMarks}</td>
      <td style="text-align:center;color:#64748b">${s.passMarks}</td>
      <td style="text-align:center;font-weight:700">${s.isAbsent ? '<span style="color:#d97706">ABSENT</span>' : s.obtained ?? '—'}</td>
      <td style="text-align:center">
        <span style="background:${gBg(s.grade)};color:${gClr(s.grade)};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">${s.grade}</span>
      </td>
      <td style="text-align:center;color:${stClr};font-weight:600;font-size:11px">${status}</td>
    </tr>`;
  }).join('');

  const attHtml = data.attendancePercentage !== undefined ? `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px">
      <span style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Attendance</span>
      <div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px">
        <div style="height:100%;width:${Math.min(data.attendancePercentage,100)}%;border-radius:3px;background:${data.attendancePercentage>=75?'#059669':'#dc2626'}"></div>
      </div>
      <span style="font-size:13px;font-weight:700;color:${data.attendancePercentage>=75?'#059669':'#dc2626'}">${data.attendancePercentage}%</span>
    </div>` : '';

  const resultClr = data.passed ? '#059669' : '#dc2626';
  const resultBg  = data.passed ? '#d1fae5' : '#fee2e2';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Report Card — ${data.studentName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;color:#1e293b;padding:40px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th,td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:left}
    th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
    tr:nth-child(even) td{background:#fafafa}
    @media print{body{padding:16px}@page{margin:1cm}}
  </style></head><body>
  <div style="text-align:center;border-bottom:3px solid #1e293b;padding-bottom:16px;margin-bottom:20px">
    <h1 style="font-size:22px;font-weight:800">${schoolName}</h1>
    <div style="font-size:16px;font-weight:800;letter-spacing:2px;margin-top:10px">REPORT CARD</div>
    <div style="font-size:12px;color:#64748b;margin-top:3px">${data.examName} · ${data.sessionName}</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
    ${[['Student Name',data.studentName],['Admission No.',data.admissionNo],['Roll Number',data.rollNumber??'—'],
       ['Class',`${data.className} — ${data.section}`],['Result',data.passed?'PASS':'FAIL'],['Date',fmt(new Date().toISOString())]
      ].map(([l,v])=>`<div style="padding:10px 14px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600">${l}</div>
        <div style="font-size:13px;font-weight:600;margin-top:2px">${v}</div>
      </div>`).join('')}
  </div>
  <table>
    <thead><tr><th>Subject</th><th style="text-align:center">Max</th><th style="text-align:center">Pass</th><th style="text-align:center">Obtained</th><th style="text-align:center">Grade</th><th style="text-align:center">Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${attHtml}
  <div style="display:grid;grid-template-columns:repeat(5,1fr);border:2px solid #1e293b;border-radius:8px;overflow:hidden;margin-bottom:24px">
    ${[
      {l:'Total',     v:`${data.totalObtained}/${data.totalMax}`,  bg:'#f8fafc',  clr:'#1e293b'},
      {l:'Percentage',v:`${data.percentage}%`,                     bg:'#f8fafc',  clr:'#1e293b'},
      {l:'Grade',     v:data.grade,                                bg:gBg(data.grade), clr:gClr(data.grade)},
      {l:'Rank',      v:`${data.rank}/${data.totalStudents}`,      bg:'#f8fafc',  clr:'#1e293b'},
      {l:'Result',    v:data.passed?'PASS':'FAIL',                 bg:resultBg,   clr:resultClr},
    ].map(x=>`<div style="padding:12px 8px;text-align:center;border-right:1px solid #1e293b;background:${x.bg}">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:600">${x.l}</div>
      <div style="font-size:16px;font-weight:800;margin-top:4px;color:${x.clr}">${x.v}</div>
    </div>`).join('')}
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:48px">
    ${['Class Teacher','Exam Controller','Principal'].map(r=>`
      <div style="text-align:center">
        <div style="width:140px;height:40px;border-bottom:1px solid #1e293b;margin:0 auto"></div>
        <div style="font-size:11px;color:#64748b;margin-top:6px;font-weight:600">${r}</div>
      </div>`).join('')}
  </div>
  <div style="margin-top:28px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8">
    <span>Generated: ${fmt(new Date().toISOString())}</span>
    <span>SchoolOS · Official Report Card</span>
  </div>
  </body></html>`;
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('report-cards')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('report-cards')
export class ReportCardController {
  constructor(private readonly svc: ReportCardService) {}

  @Get(':examId/:studentId')
  @ApiOperation({ summary: 'Get report card data for a student' })
  @ApiQuery({ name: 'sessionId', required: true })
  getOne(
    @CurrentUser() u:               AuthenticatedUser,
    @Param('examId')    examId:     string,
    @Param('studentId') studentId:  string,
    @Query('sessionId') sessionId:  string,
  ) {
    return this.svc.getStudentReportCard(u.tenantId, examId, studentId, sessionId);
  }

  @Get(':examId/:studentId/pdf')
  @ApiOperation({ summary: 'Download report card as PDF / printable HTML' })
  @ApiQuery({ name: 'sessionId',  required: true })
  @ApiQuery({ name: 'schoolName', required: false })
  async getPdf(
    @CurrentUser() u:               AuthenticatedUser,
    @Param('examId')      examId:     string,
    @Param('studentId')   studentId:  string,
    @Query('sessionId')   sessionId:  string,
    @Query('schoolName')  schoolName: string | undefined,
    @Res() res: Response,
  ) {
    const data = await this.svc.getStudentReportCard(u.tenantId, examId, studentId, sessionId);
    const html = buildReportCardHtml(data, schoolName ?? 'School');

    // Try puppeteer for PDF — fall back to HTML for browser print
    let pdfBuffer: Buffer | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const puppeteer: any = require('puppeteer');
      const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
      const page    = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuffer = Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));
      await browser.close();
    } catch { /* puppeteer not installed — return HTML */ }

    if (pdfBuffer) {
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="report-card-${studentId}.pdf"` });
      res.send(pdfBuffer);
    } else {
      res.set({ 'Content-Type': 'text/html' });
      res.send(html);
    }
  }

  @Get(':examId/class/:classId')
  @ApiOperation({ summary: 'Get report cards for entire class' })
  @ApiQuery({ name: 'sessionId', required: true })
  getClass(
    @CurrentUser() u:               AuthenticatedUser,
    @Param('examId')    examId:     string,
    @Param('classId')   classId:    string,
    @Query('sessionId') sessionId:  string,
  ) {
    return this.svc.getClassReportCards(u.tenantId, examId, classId, sessionId);
  }
}
