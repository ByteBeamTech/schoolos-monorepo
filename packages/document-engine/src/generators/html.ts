// HTML template renderer — used before PDF generation

export function renderHtml(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value ?? '');
  }
  return result;
}

export const htmlWrapper = (title: string, body: string, styles?: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 40px; }
    h1 { font-size: 24px; font-weight: 800; }
    h2 { font-size: 18px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    th { background: #f8fafc; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }
    .text-sm { font-size: 12px; }
    .text-muted { color: #64748b; }
    ${styles ?? ''}
  </style>
</head>
<body>${body}</body>
</html>`;
