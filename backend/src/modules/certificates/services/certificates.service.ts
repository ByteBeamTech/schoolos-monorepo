import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma.service';
import { IssueCertificateDto } from '../dto/certificates.dto';

const CERT_LABELS: Record<string, string> = {
  TRANSFER:    'Transfer Certificate',
  BONAFIDE:    'Bonafide Certificate',
  CHARACTER:   'Character Certificate',
  ACHIEVEMENT: 'Achievement Certificate',
  MIGRATION:   'Migration Certificate',
  CONDUCT:     'Conduct Certificate',
};

@Injectable()
export class CertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  private certNumber(type: string, seq: number): string {
    const year   = new Date().getFullYear();
    const prefix = { TRANSFER:'TC', BONAFIDE:'BF', CHARACTER:'CC', ACHIEVEMENT:'AC', MIGRATION:'MG', CONDUCT:'CD' }[type] ?? 'CERT';
    return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
  }

  async issue(tenantId: string, dto: IssueCertificateDto, actorId: string) {
    const student = await this.prisma.student.findFirst({
      where:   { id: dto.studentId, tenantId },
      include: { section: { include: { class: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');

    const seq        = await this.prisma.notification.count({ where: { tenantId, templateId: { startsWith: 'CERT_' } } }) + 1;
    const certNumber = this.certNumber(dto.type, seq);
    const payload    = {
      certNumber,
      type:        dto.type,
      certLabel:   CERT_LABELS[dto.type],
      studentId:   dto.studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      admissionNo: student.admissionNumber,
      className:   student.section?.class?.name ?? '—',
      section:     student.section?.name ?? '—',
      reason:      dto.reason ?? '',
      notes:       dto.notes  ?? '',
      issuedBy:    actorId,
      issuedAt:    new Date().toISOString(),
    };

    const record = await this.prisma.notification.create({
      data: {
        tenantId,
        channel:     'EMAIL' as any,
        status:      'SENT'  as any,
        templateId:  `CERT_${dto.type}`,
        subject:     `${CERT_LABELS[dto.type]} — ${certNumber}`,
        body:        JSON.stringify(payload),
        recipientId: dto.studentId,
      },
    });

    return { id: record.id, ...payload, certNumber, createdAt: record.createdAt };
  }

  async list(tenantId: string, studentId?: string) {
    const records = await this.prisma.notification.findMany({
      where: {
        tenantId,
        templateId:  { startsWith: 'CERT_' },
        ...(studentId && { recipientId: studentId }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r: any) => {
      const body = JSON.parse(r.body ?? '{}');
      return { id: r.id, ...body, createdAt: r.createdAt };
    });
  }

  // Generate printable HTML for a certificate
  generateHtml(cert: any): string {
    const date = new Date(cert.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    return `<html><head><title>${cert.certNumber}</title>
<style>
  body{font-family:Georgia,serif;padding:60px;max-width:720px;margin:0 auto;color:#1e293b}
  .header{text-align:center;border-bottom:3px double #1e293b;padding-bottom:20px;margin-bottom:30px}
  h1{font-size:28px;margin:0;letter-spacing:2px}
  h2{font-size:16px;color:#64748b;margin:8px 0 0;font-weight:normal}
  .cert-no{font-size:12px;color:#94a3b8;margin-top:6px}
  .title{text-align:center;font-size:22px;font-weight:bold;text-decoration:underline;margin:20px 0;letter-spacing:1px}
  .body{font-size:15px;line-height:2.2;text-align:justify}
  .sig{margin-top:60px;display:flex;justify-content:space-between}
  .sig div{text-align:center;font-size:13px}
  .sig .line{border-top:1px solid #1e293b;width:160px;margin:0 auto 6px}
</style></head><body>
<div class="header">
  <h1>School Name</h1><h2>Affiliated · Recognized · Accredited</h2>
  <div class="cert-no">Cert No: ${cert.certNumber}</div>
</div>
<div class="title">${cert.certLabel?.toUpperCase()}</div>
<div class="body">
  <p>This is to certify that <strong>${cert.studentName}</strong> (Admission No: <strong>${cert.admissionNo}</strong>),
  a student of <strong>Class ${cert.className} – ${cert.section}</strong>, has been a bonafide student of this institution.</p>
  ${cert.reason ? `<p><strong>Purpose:</strong> ${cert.reason}</p>` : ''}
  <p>This certificate is issued upon request and is valid for official use.</p>
  <p>Date of Issue: <strong>${date}</strong></p>
</div>
<div class="sig">
  <div><div class="line"></div>Class Teacher</div>
  <div><div class="line"></div>Principal</div>
  <div><div class="line"></div>School Seal</div>
</div></body></html>`;
  }
}
