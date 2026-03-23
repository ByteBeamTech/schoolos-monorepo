import { htmlWrapper } from '../generators/html';
import { formatDate }   from '../helpers';

const CERT_TITLES: Record<string, string> = {
  TRANSFER:    'Transfer Certificate',
  BONAFIDE:    'Bonafide Certificate',
  CHARACTER:   'Character Certificate',
  ACHIEVEMENT: 'Achievement Certificate',
  MIGRATION:   'Migration Certificate',
  CONDUCT:     'Conduct Certificate',
};

export function certificateTemplate(data: {
  certNumber: string; type: string; schoolName: string;
  studentName: string; admissionNo: string; className: string;
  section: string; reason?: string; issuedAt: string;
}): string {
  const title = CERT_TITLES[data.type] ?? 'Certificate';
  return htmlWrapper(title, `
    <div style="text-align:center;border-bottom:3px double #1e293b;padding-bottom:20px;margin-bottom:30px">
      <h1>${data.schoolName}</h1>
      <div class="text-muted text-sm" style="margin-top:4px">Affiliated · Recognized · Accredited</div>
      <div class="text-sm" style="margin-top:6px">Cert No: ${data.certNumber}</div>
    </div>
    <h2 style="text-align:center;text-decoration:underline;margin-bottom:30px;letter-spacing:1px">${title.toUpperCase()}</h2>
    <p style="font-size:15px;line-height:2">
      This is to certify that <strong>${data.studentName}</strong> (Admission No: <strong>${data.admissionNo}</strong>),
      a student of <strong>Class ${data.className} – ${data.section}</strong>, has been a bonafide student of this institution.
      ${data.reason ? `<br/><br/><strong>Purpose:</strong> ${data.reason}` : ''}
      <br/><br/>This certificate is issued upon request and is valid for official use.
      <br/><br/>Date of Issue: <strong>${formatDate(data.issuedAt)}</strong>
    </p>
    <div style="display:flex;justify-content:space-between;margin-top:60px">
      <div style="text-align:center"><div style="border-top:1px solid #1e293b;width:140px;margin:0 auto 6px"></div>Class Teacher</div>
      <div style="text-align:center"><div style="border-top:1px solid #1e293b;width:140px;margin:0 auto 6px"></div>Principal</div>
      <div style="text-align:center"><div style="border-top:1px solid #1e293b;width:140px;margin:0 auto 6px"></div>School Seal</div>
    </div>
  `);
}
