import { htmlWrapper } from '../generators/html';
import { formatDate } from '../helpers';

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return '#059669';
  if (grade === 'B+' || grade === 'B') return '#2563eb';
  if (grade === 'C')                   return '#d97706';
  return '#dc2626';
}

function gradeBg(grade: string): string {
  if (grade === 'A+' || grade === 'A') return '#d1fae5';
  if (grade === 'B+' || grade === 'B') return '#dbeafe';
  if (grade === 'C')                   return '#fef3c7';
  return '#fee2e2';
}

export interface ReportCardSubject {
  name:         string;
  maxMarks:     number;
  passMarks:    number;
  obtained:     number | null;
  isAbsent:     boolean;
  grade:        string;
}

export interface ReportCardData {
  // School
  schoolName:      string;
  schoolAddress?:  string;
  schoolPhone?:    string;
  schoolLogo?:     string;   // base64 or URL

  // Student
  studentName:     string;
  admissionNo:     string;
  rollNumber?:     string;
  className:       string;
  section:         string;
  fatherName?:     string;
  motherName?:     string;
  dob?:            string;

  // Exam
  examName:        string;
  sessionName:     string;
  issuedAt:        string;

  // Results
  subjects:        ReportCardSubject[];
  totalMax:        number;
  totalObtained:   number;
  percentage:      number;
  grade:           string;
  rank:            number;
  totalStudents:   number;
  passed:          boolean;

  // Optional attendance line
  attendancePercentage?: number;
}

export function reportCardTemplate(data: ReportCardData): string {
  const subjectRows = data.subjects.map(s => {
    const status = s.isAbsent ? 'AB' : Number(s.obtained ?? 0) >= s.passMarks ? 'P' : 'F';
    const statusColor = status === 'AB' ? '#d97706' : status === 'P' ? '#059669' : '#dc2626';
    const obtainedDisplay = s.isAbsent
      ? '<span style="color:#d97706;font-weight:600">ABSENT</span>'
      : `<span style="font-weight:700">${s.obtained ?? '—'}</span>`;

    return `
      <tr>
        <td style="font-weight:500">${s.name}</td>
        <td class="text-center">${s.maxMarks}</td>
        <td class="text-center" style="color:#64748b">${s.passMarks}</td>
        <td class="text-center">${obtainedDisplay}</td>
        <td class="text-center">
          <span style="background:${gradeBg(s.grade)};color:${gradeColor(s.grade)};
            padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">
            ${s.grade}
          </span>
        </td>
        <td class="text-center">
          <span style="color:${statusColor};font-weight:600;font-size:11px">${status}</span>
        </td>
      </tr>
    `;
  }).join('');

  const resultColor  = data.passed ? '#059669' : '#dc2626';
  const resultBg     = data.passed ? '#d1fae5' : '#fee2e2';
  const resultLabel  = data.passed ? 'PASS' : 'FAIL';

  const logoHtml = data.schoolLogo
    ? `<img src="${data.schoolLogo}" style="width:64px;height:64px;object-fit:contain" alt="logo" />`
    : `<div style="width:64px;height:64px;background:#1e293b;border-radius:50%;display:flex;align-items:center;
         justify-content:center;color:white;font-size:22px;font-weight:800">
         ${data.schoolName.charAt(0)}
       </div>`;

  return htmlWrapper(`Report Card — ${data.studentName}`, `
    <!-- Header -->
    <div style="display:flex;align-items:center;gap:20px;border-bottom:3px solid #1e293b;padding-bottom:20px;margin-bottom:24px">
      ${logoHtml}
      <div style="flex:1;text-align:center">
        <h1 style="font-size:22px;letter-spacing:0.5px">${data.schoolName}</h1>
        ${data.schoolAddress ? `<div class="text-muted text-sm" style="margin-top:2px">${data.schoolAddress}</div>` : ''}
        ${data.schoolPhone   ? `<div class="text-muted text-sm">${data.schoolPhone}</div>` : ''}
        <div style="margin-top:8px;font-size:17px;font-weight:800;letter-spacing:2px;text-transform:uppercase;
          border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:4px 0">
          REPORT CARD
        </div>
        <div class="text-muted text-sm" style="margin-top:4px">${data.examName} · ${data.sessionName}</div>
      </div>
    </div>

    <!-- Student Info Grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;margin-bottom:20px;
      border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      ${[
        ['Student Name',   data.studentName],
        ['Admission No.',  data.admissionNo],
        ['Roll Number',    data.rollNumber ?? '—'],
        ['Class',          `${data.className} — ${data.section}`],
        ['Father\'s Name', data.fatherName ?? '—'],
        ['Date of Birth',  data.dob ? formatDate(data.dob) : '—'],
      ].map(([label, val]) => `
        <div style="padding:10px 14px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">${label}</div>
          <div style="font-size:13px;font-weight:600;color:#1e293b;margin-top:2px">${val}</div>
        </div>
      `).join('')}
    </div>

    <!-- Marks Table -->
    <table style="margin-bottom:20px">
      <thead>
        <tr>
          <th>Subject</th>
          <th class="text-center">Max Marks</th>
          <th class="text-center">Pass Marks</th>
          <th class="text-center">Marks Obtained</th>
          <th class="text-center">Grade</th>
          <th class="text-center">Status</th>
        </tr>
      </thead>
      <tbody>${subjectRows}</tbody>
    </table>

    <!-- Summary Bar -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0;
      border:2px solid #1e293b;border-radius:8px;overflow:hidden;margin-bottom:24px">
      ${[
        { label: 'Total Marks',  value: `${data.totalObtained} / ${data.totalMax}` },
        { label: 'Percentage',   value: `${data.percentage}%` },
        { label: 'Grade',        value: data.grade, color: gradeColor(data.grade), bg: gradeBg(data.grade) },
        { label: 'Rank',         value: `${data.rank} / ${data.totalStudents}` },
        { label: 'Result',       value: resultLabel, color: resultColor, bg: resultBg },
      ].map(({ label, value, color, bg }) => `
        <div style="padding:12px 8px;text-align:center;border-right:1px solid #1e293b;
          ${bg ? `background:${bg}` : 'background:#f8fafc'}">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600">${label}</div>
          <div style="font-size:16px;font-weight:800;margin-top:4px;${color ? `color:${color}` : 'color:#1e293b'}">${value}</div>
        </div>
      `).join('')}
    </div>

    ${data.attendancePercentage !== undefined ? `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;
      padding:10px 16px;margin-bottom:24px;display:flex;align-items:center;gap:8px">
      <span style="font-size:12px;color:#64748b;font-weight:600">ATTENDANCE</span>
      <div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${Math.min(data.attendancePercentage, 100)}%;
          background:${data.attendancePercentage >= 75 ? '#059669' : '#dc2626'};border-radius:3px"></div>
      </div>
      <span style="font-size:13px;font-weight:700;
        color:${data.attendancePercentage >= 75 ? '#059669' : '#dc2626'}">
        ${data.attendancePercentage}%
      </span>
    </div>
    ` : ''}

    <!-- Signature Block -->
    <div style="display:flex;justify-content:space-between;margin-top:48px">
      ${['Class Teacher', 'Examination Controller', 'Principal'].map(role => `
        <div style="text-align:center">
          <div style="width:140px;height:40px;border-bottom:1px solid #1e293b;margin:0 auto"></div>
          <div style="font-size:11px;color:#64748b;margin-top:6px;font-weight:600">${role}</div>
        </div>
      `).join('')}
    </div>

    <!-- Footer -->
    <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;
      display:flex;justify-content:space-between;font-size:10px;color:#94a3b8">
      <span>Generated: ${formatDate(data.issuedAt)}</span>
      <span>This is a computer-generated document</span>
      <span>SchoolOS · Official Report Card</span>
    </div>
  `, `
    tr:nth-child(even) td { background: #fafafa; }
    @media print {
      body { padding: 16px; }
      @page { margin: 1cm; }
    }
  `);
}
