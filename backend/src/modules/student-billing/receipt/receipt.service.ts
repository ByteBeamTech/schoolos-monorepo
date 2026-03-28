// modules/student-billing/receipt/receipt.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService }  from '../../../infra/database/prisma.service';
import { StorageService } from '../../../infra/storage/storage.service';

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly storage:  StorageService,
  ) {}

  // ─── Generate receipt and upload to S3 ─────────────────────────────────────

  async generateAndUpload(
    tenantId:  string,
    invoiceId: string,
    paymentId: string,
  ): Promise<string> {
    // Receipt uses pdfUrl (not receiptUrl) per schema
    const existing = await this.prisma.receipt.findFirst({ where: { invoiceId, paymentId } });
    if (existing?.pdfUrl) return existing.pdfUrl;

    const [invoice, payment] = await Promise.all([
      this.prisma.invoice.findFirstOrThrow({
        where:   { id: invoiceId, tenantId },
        include: {
          student: { select: { firstName: true, lastName: true, rollNumber: true } },
          items:   true,
        },
      }),
      this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }),
    ]);

    const html = this.renderReceiptHtml({ invoice, payment });
    const pdf  = await this.htmlToPdf(html);

    const year         = new Date().getFullYear();
    const count        = await this.prisma.receipt.count({ where: { tenantId } });
    const receiptNumber = `RCP-${year}-${String(count + 1).padStart(5, '0')}`;
    const filename     = `${receiptNumber}.pdf`;

    let pdfUrl = '';
    try {
      pdfUrl = await this.storage.upload({
        tenantId,
        year,
        category:    'receipts',
        filename,
        body:        pdf,
        contentType: 'application/pdf',
      });
      this.logger.log(`Receipt uploaded: ${pdfUrl}`);
    } catch (err: any) {
      this.logger.error(`S3 upload failed: ${err.message} — saving without URL`);
    }

    if (existing) {
      await this.prisma.receipt.update({
        where: { id: existing.id },
        data:  { pdfUrl: pdfUrl || null },
      });
      return pdfUrl;
    }

    await this.prisma.receipt.create({
      data: {
        tenantId,
        invoiceId,
        paymentId,
        receiptNumber,
        amount:   payment.amount,
        currency: payment.currency,
        pdfUrl:   pdfUrl || null,
      },
    });

    return pdfUrl;
  }

  // ─── Get receipt download URL ───────────────────────────────────────────────

  async getReceiptUrl(tenantId: string, receiptId: string): Promise<string> {
    const receipt = await this.prisma.receipt.findFirstOrThrow({
      where: { id: receiptId, tenantId },
    });

    if (!receipt.pdfUrl) throw new NotFoundException('Receipt PDF not yet generated');

    // Correct method name from StorageService
    return this.storage.getSignedDownloadUrl(receipt.pdfUrl, 3600);
  }

  // ─── HTML receipt template ─────────────────────────────────────────────────

  private renderReceiptHtml({ invoice, payment }: any): string {
    const student  = invoice.student;
    const amount   = Number(payment.amount);
    const currency = String(payment.currency ?? 'INR');
    const paidAt   = new Date(payment.paidAt ?? payment.createdAt).toLocaleDateString('en-IN');

    const rows = (invoice.items ?? []).map((item: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${item.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${currency} ${Number(item.amount).toFixed(2)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; color: #333; margin: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .title { font-size: 22px; font-weight: bold; color: #1a1a1a; }
    .badge { background: #f0fdf4; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #f9fafb; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; }
    .total-row td { font-weight: bold; font-size: 15px; padding: 12px; background: #f9fafb; }
    .footer { margin-top: 40px; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Payment Receipt</div>
      <div style="color:#6b7280;margin-top:4px">Receipt #${invoice.invoiceNumber?.replace('INV', 'RCP')}</div>
    </div>
    <div style="text-align:right">
      <div class="badge">✓ PAID</div>
      <div style="color:#6b7280;margin-top:8px;font-size:12px">Date: ${paidAt}</div>
    </div>
  </div>

  <div style="display:flex;gap:48px;margin-bottom:24px">
    <div>
      <div style="font-size:11px;text-transform:uppercase;color:#9ca3af;margin-bottom:4px">Billed To</div>
      <div style="font-weight:600">${student?.firstName ?? ''} ${student?.lastName ?? ''}</div>
      <div style="color:#6b7280">Roll: ${student?.rollNumber ?? '—'}</div>
    </div>
    <div>
      <div style="font-size:11px;text-transform:uppercase;color:#9ca3af;margin-bottom:4px">Payment Method</div>
      <div style="font-weight:600">${String(payment.paymentMethod ?? payment.gateway ?? 'Online')}</div>
      <div style="color:#6b7280">${payment.gatewayPaymentId ?? ''}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
    </thead>
    <tbody>
      ${rows || `<tr><td style="padding:8px 12px">Fee payment</td><td style="padding:8px 12px;text-align:right">${currency} ${amount.toFixed(2)}</td></tr>`}
      <tr class="total-row">
        <td>Total Paid</td>
        <td style="text-align:right">${currency} ${amount.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    This is a computer-generated receipt and does not require a signature.<br/>
    Generated by SchoolOS · ${new Date().toISOString()}
  </div>
</body>
</html>`;
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    try {
      const puppeteer = await import('puppeteer');
      const browser   = await (puppeteer.default as any).launch({ args: ['--no-sandbox'] });
      const page      = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
      await browser.close();
      return Buffer.from(pdf);
    } catch {
      this.logger.warn('Puppeteer not available — saving HTML as receipt');
      return Buffer.from(html, 'utf8');
    }
  }
}
