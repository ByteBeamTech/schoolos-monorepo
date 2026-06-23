// modules/student-billing/receipt/receipt.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { StorageService } from '../../../infra/storage/storage.service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'; // 👈 Puppeteer की जगह ये यूज़ कर रहे हैं

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

    // ✅ Principal Move: HTML को सीधे PDF में बदलना मुश्किल है pdf-lib से, 
    // इसलिए हम एक प्रोफेशनल PDF Document ड्रॉ करेंगे।
    const pdfBuffer = await this.generatePdfBuffer({ invoice, payment });

    const year         = new Date().getFullYear();
    const count        = await this.prisma.receipt.count({ where: { tenantId } });
    const receiptNumber = `RCP-${year}-${String(count + 1).padStart(5, '0')}`;
    const filename      = `${receiptNumber}.pdf`;

    let pdfUrl = '';
    try {
      pdfUrl = await this.storage.upload({
        tenantId,
        year,
        category:    'receipts',
        filename,
        body:        pdfBuffer,
        contentType: 'application/pdf',
      });
      this.logger.log(`Receipt uploaded: ${pdfUrl}`);
    } catch (err: any) {
      this.logger.error(`S3 upload failed: ${err.message}`);
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
	branchId: invoice!.branchId,
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

  // ─── PDF Generation Logic (Using pdf-lib) ──────────────────────────────────

  private async generatePdfBuffer({ invoice, payment }: any): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const student = invoice.student;
    const amount = Number(payment.amount).toFixed(2);
    const currency = String(payment.currency ?? 'INR');
    const date = new Date(payment.paidAt ?? payment.createdAt).toLocaleDateString('en-IN');

    // Header
    page.drawText('PAYMENT RECEIPT', { x: 50, y: height - 50, size: 20, font: boldFont });
    page.drawText(`Receipt #: ${invoice.invoiceNumber?.replace('INV', 'RCP')}`, { x: 50, y: height - 75, size: 12, font });
    page.drawText(`Date: ${date}`, { x: 450, y: height - 50, size: 12, font });

    // Status Badge
    page.drawRectangle({ x: 450, y: height - 80, width: 60, height: 20, color: rgb(0.9, 0.98, 0.94) });
    page.drawText('PAID', { x: 465, y: height - 74, size: 10, font: boldFont, color: rgb(0.08, 0.4, 0.2) });

    // Billing Info
    page.drawText('BILLED TO:', { x: 50, y: height - 120, size: 10, font: boldFont, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(`${student?.firstName} ${student?.lastName}`, { x: 50, y: height - 135, size: 12, font });
    page.drawText(`Roll: ${student?.rollNumber ?? '—'}`, { x: 50, y: height - 150, size: 10, font });

    // Table Content
    page.drawRectangle({ x: 50, y: height - 200, width: 500, height: 25, color: rgb(0.97, 0.98, 0.98) });
    page.drawText('Description', { x: 60, y: height - 193, size: 10, font: boldFont });
    page.drawText('Amount', { x: 480, y: height - 193, size: 10, font: boldFont });

    // Row
    page.drawText('School Fee Payment', { x: 60, y: height - 230, size: 12, font });
    page.drawText(`${currency} ${amount}`, { x: 480, y: height - 230, size: 12, font });

    // Footer
    page.drawText('This is a computer-generated receipt.', { x: width / 2 - 100, y: 50, size: 10, font, color: rgb(0.6, 0.6, 0.6) });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  async getReceiptUrl(tenantId: string, receiptId: string): Promise<string> {
    const receipt = await this.prisma.receipt.findFirstOrThrow({
      where: { id: receiptId, tenantId },
    });
    if (!receipt.pdfUrl) throw new NotFoundException('Receipt PDF not yet generated');
    return this.storage.getSignedDownloadUrl(receipt.pdfUrl, 3600);
  }
}
