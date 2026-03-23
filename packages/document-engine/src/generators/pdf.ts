// PDF generator — Puppeteer (server) or window.print() (browser)
// No static type imports — both puppeteer and Window are resolved at runtime only

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function htmlToPdf(html: string): Promise<Buffer | null> {
  try {
    // Dynamic require avoids TS trying to resolve puppeteer types
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer: any = (() => { try { return require('puppeteer'); } catch { return null; } })();
    if (!puppeteer) return null;
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page    = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf     = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
    await browser.close();
    return Buffer.from(pdf);
  } catch {
    return null;
  }
}

export function printHtml(html: string): void {
  // Use any cast — avoids needing DOM lib in tsconfig
  const g = globalThis as any;
  if (!g.window) return;
  const w = g.window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  w.close();
}
