/**
 * pdf.service.ts
 *
 * Lightweight PDF generation using pdf-lib (pure JS, no Chromium binary).
 *
 * For simple structured documents (certificates, receipts, fee invoices):
 *   → Use pdf-lib (this service)
 *
 * For complex HTML-to-PDF (report cards with CSS formatting):
 *   → Use a dedicated microservice with Puppeteer OR use
 *     html-pdf-node as a separate optional worker process.
 *   → Never put Puppeteer in the main NestJS app bundle.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';

export interface InvoicePdfData {
  invoiceNumber: string;
  studentName:   string;
  admissionNo:   string;
  schoolName:    string;
  items:         { name: string; amount: number }[];
  totalAmount:   number;
  dueDate:       string;
  issuedAt:      string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
    const doc  = await PDFDocument.create();
    const page = doc.addPage(PageSizes.A4);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();
    const margin = 60;

    // Header bar
    page.drawRectangle({
      x: 0, y: height - 80, width, height: 80,
      color: rgb(0.1, 0.25, 0.67),
    });

    // School name in header
    page.drawText(data.schoolName, {
      x: margin, y: height - 50,
      font: bold, size: 18, color: rgb(1, 1, 1),
    });
    page.drawText('FEE INVOICE', {
      x: width - margin - 100, y: height - 50,
      font: bold, size: 14, color: rgb(0.8, 0.9, 1),
    });

    // Invoice metadata
    let y = height - 120;
    const drawRow = (label: string, value: string, yPos: number) => {
      page.drawText(label + ':', { x: margin,       y: yPos, font: bold, size: 10, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(value,       { x: margin + 130, y: yPos, font,       size: 10, color: rgb(0.1, 0.1, 0.1) });
    };

    drawRow('Invoice Number', data.invoiceNumber, y); y -= 20;
    drawRow('Student Name',   data.studentName,   y); y -= 20;
    drawRow('Admission No.',  data.admissionNo,    y); y -= 20;
    drawRow('Issued Date',    data.issuedAt,       y); y -= 20;
    drawRow('Due Date',       data.dueDate,        y); y -= 30;

    // Line items table header
    page.drawRectangle({ x: margin, y: y - 6, width: width - 2 * margin, height: 22, color: rgb(0.95, 0.95, 0.95) });
    page.drawText('Fee Item',   { x: margin + 8, y: y + 4, font: bold, size: 10, color: rgb(0.2, 0.2, 0.2) });
    page.drawText('Amount (₹)', { x: width - margin - 80, y: y + 4, font: bold, size: 10, color: rgb(0.2, 0.2, 0.2) });
    y -= 28;

    // Line items
    for (const item of data.items) {
      page.drawText(item.name, { x: margin + 8, y, font, size: 10, color: rgb(0.15, 0.15, 0.15) });
      page.drawText(item.amount.toLocaleString('en-IN'), {
        x: width - margin - 80, y, font, size: 10, color: rgb(0.15, 0.15, 0.15),
      });
      y -= 20;
    }

    // Total line
    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 20;
    page.drawText('TOTAL', { x: margin + 8, y, font: bold, size: 12, color: rgb(0.1, 0.25, 0.67) });
    page.drawText('₹' + data.totalAmount.toLocaleString('en-IN'), {
      x: width - margin - 80, y, font: bold, size: 12, color: rgb(0.1, 0.25, 0.67),
    });

    // Footer
    page.drawText('Thank you for your payment.', {
      x: margin, y: 40, font, size: 9, color: rgb(0.5, 0.5, 0.5),
    });

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  async generateCertificatePdf(params: {
    type: string; studentName: string; schoolName: string;
    date: string; principalName: string;
  }): Promise<Buffer> {
    const doc  = await PDFDocument.create();
    const page = doc.addPage(PageSizes.A4);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const { width, height } = page.getSize();
    const cx = width / 2;

    // Decorative border
    page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: rgb(0.1, 0.25, 0.67), borderWidth: 2 });
    page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: rgb(0.7, 0.8, 0.95), borderWidth: 0.5 });

    page.drawText(params.schoolName, { x: cx - 120, y: height - 100, font: bold, size: 18, color: rgb(0.1, 0.25, 0.67) });
    page.drawText(params.type + ' CERTIFICATE', { x: cx - 100, y: height - 145, font: bold, size: 16, color: rgb(0.2, 0.2, 0.2) });
    page.drawText('This is to certify that', { x: cx - 75, y: height - 220, font, size: 12, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(params.studentName, { x: cx - (params.studentName.length * 5), y: height - 260, font: bold, size: 20, color: rgb(0.1, 0.1, 0.1) });
    page.drawLine({ start: { x: cx - 120, y: height - 268 }, end: { x: cx + 120, y: height - 268 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(`is a bonafide student of this institution.`, { x: cx - 140, y: height - 300, font, size: 12, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(`Date: ${params.date}`, { x: 80, y: 100, font, size: 10, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(params.principalName, { x: width - 180, y: 100, font: bold, size: 10, color: rgb(0.2, 0.2, 0.2) });
    page.drawText('Principal', { x: width - 160, y: 82, font, size: 9, color: rgb(0.5, 0.5, 0.5) });

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }
}
