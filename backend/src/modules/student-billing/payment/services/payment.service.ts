import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENTS } from '../../../../core/events/events.constants';
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService }  from '@nestjs/config';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService }   from '../../../../core/compliance/audit.service';
import { InitiatePaymentDto, VerifyRazorpayPaymentDto, RecordOfflinePaymentDto } from '../../dto/billing.dto';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly audit:   AuditService,
    private readonly config:  ConfigService,
    private readonly emitter: EventEmitter2,
  ) {}

  async initiateRazorpay(tenantId: string, dto: InitiatePaymentDto, actorId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: dto.invoiceId, tenantId } });
    if (!invoice) throw new NotFoundException(`Invoice not found: ${dto.invoiceId}`);
    if (invoice.status === 'PAID') throw new BadRequestException('Invoice already paid.');

    const keyId     = this.config.get<string>('RAZORPAY_STUDENT_KEY_ID', '');
    const keySecret = this.config.get<string>('RAZORPAY_STUDENT_KEY_SECRET', '');
    let razorpayOrder: any;

    if (keyId && keySecret && !keyId.includes('xxxxxxxxxx')) {
      const Razorpay  = require('razorpay');
      const rzp       = new Razorpay({ key_id: keyId, key_secret: keySecret });
      razorpayOrder   = await rzp.orders.create({ amount: dto.amount * 100, currency: String(invoice.currency), receipt: invoice.invoiceNumber });
    } else {
      razorpayOrder = { id: `order_dev_${Date.now()}`, amount: dto.amount * 100, currency: String(invoice.currency), status: 'created' };
      this.logger.warn('Razorpay not configured — mock order');
    }

    const payment = await this.prisma.payment.create({
      data: { tenantId, invoiceId: dto.invoiceId, gateway: 'RAZORPAY', gatewayOrderId: razorpayOrder.id, amount: dto.amount, currency: invoice.currency, status: 'PENDING', payerName: dto.payerName ?? null, payerEmail: dto.payerEmail ?? null, payerPhone: dto.payerPhone ?? null },
    });

    await this.audit.logPayment({ tenantId, actorId, entityType: 'Payment', entityId: payment.id, paymentStatus: 'initiated', after: { invoiceId: dto.invoiceId, amount: dto.amount } });
    return { paymentId: payment.id, razorpayOrderId: razorpayOrder.id, razorpayKeyId: keyId.includes('xxxxxxxxxx') ? 'CONFIGURE_RAZORPAY_KEYS' : keyId, amount: dto.amount * 100, currency: String(invoice.currency) };
  }

  async verifyRazorpay(tenantId: string, dto: VerifyRazorpayPaymentDto, actorId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { tenantId, gatewayOrderId: dto.razorpayOrderId }, include: { invoice: true } });
    if (!payment) throw new NotFoundException('Payment not found.');

    const keySecret = this.config.get<string>('RAZORPAY_STUDENT_KEY_SECRET', '');
    if (keySecret && !keySecret.includes('xxxxxxxxxx')) {
      const expected = crypto.createHmac('sha256', keySecret).update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`).digest('hex');
      if (expected !== dto.razorpaySignature) {
        await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: 'Invalid signature' } });
        throw new BadRequestException('Payment verification failed.');
      }
    }

    const updated = await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'SUCCESS', gatewayPaymentId: dto.razorpayPaymentId, gatewaySignature: dto.razorpaySignature, paidAt: new Date() } });
    await this.updateInvoice(tenantId, payment.invoiceId, Number(payment.amount));
    const receipt = await this.generateReceipt(tenantId, payment.invoiceId, payment.id);
    await this.audit.logPayment({ tenantId, actorId, entityType: 'Payment', entityId: payment.id, paymentStatus: 'success', after: { gatewayPaymentId: dto.razorpayPaymentId } });
    this.emitter.emit(EVENTS.PAYMENT_SUCCESS, {
      tenantId, studentId: payment.invoice.studentId,
      invoiceId: payment.invoiceId, paymentId: payment.id,
      amount: Number(payment.amount), currency: String(payment.invoice.currency), method: 'ONLINE',
    });
    return { payment: updated, receipt };
  }

  async recordOffline(tenantId: string, dto: RecordOfflinePaymentDto, actorId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: dto.invoiceId, tenantId } });
    if (!invoice) throw new NotFoundException(`Invoice not found: ${dto.invoiceId}`);
    if (invoice.status === 'PAID') throw new BadRequestException('Invoice already paid.');
    if (dto.amount > Number(invoice.dueAmount)) throw new BadRequestException(`Amount exceeds due: ₹${invoice.dueAmount}`);

    const payment = await this.prisma.payment.create({
      data: { tenantId, invoiceId: dto.invoiceId, gateway: 'RAZORPAY', amount: dto.amount, currency: invoice.currency, status: 'SUCCESS', paymentMethod: dto.paymentMethod, gatewayPaymentId: dto.referenceNumber ?? `OFFLINE-${Date.now()}`, paidAt: new Date() },
    });

    await this.updateInvoice(tenantId, dto.invoiceId, dto.amount);
    const receipt = await this.generateReceipt(tenantId, dto.invoiceId, payment.id);
    await this.audit.logPayment({ tenantId, actorId, entityType: 'Payment', entityId: payment.id, paymentStatus: 'success', after: { method: dto.paymentMethod, amount: dto.amount } });
    this.logger.log(`Offline payment: ₹${dto.amount} ${dto.paymentMethod} | tenant: ${tenantId}`);
    this.emitter.emit(EVENTS.PAYMENT_SUCCESS, {
      tenantId, studentId: invoice.studentId,
      invoiceId: dto.invoiceId, paymentId: payment.id,
      amount: dto.amount, currency: String(invoice.currency), method: dto.paymentMethod ?? 'OFFLINE',
    });
    return { payment, receipt };
  }

  private async updateInvoice(tenantId: string, invoiceId: string, amount: number) {
    const inv = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!inv) return;
    const newPaid = Number(inv.paidAmount) + amount;
    const newDue  = Number(inv.totalAmount) - newPaid;
    const status  = newDue <= 0 ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : inv.status;
    await this.prisma.invoice.update({ where: { id: invoiceId }, data: { paidAmount: newPaid, dueAmount: Math.max(0, newDue), status: status as any, paidAt: newDue <= 0 ? new Date() : null } });
  }

  private async generateReceipt(tenantId: string, invoiceId: string, paymentId: string) {
    const existing = await this.prisma.receipt.findFirst({ where: { invoiceId } });
    if (existing) return existing;
    const year   = new Date().getFullYear();
    const count  = await this.prisma.receipt.count({ where: { tenantId } });
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    return this.prisma.receipt.create({ data: { tenantId, invoiceId, paymentId, receiptNumber: `RCP-${year}-${String(count + 1).padStart(5, '0')}`, amount: payment?.amount ?? 0, currency: payment?.currency ?? 'INR' } });
  }

  async getPaymentHistory(tenantId: string, invoiceId: string) {
    await this.prisma.invoice.findFirstOrThrow({ where: { id: invoiceId, tenantId } });
    return this.prisma.payment.findMany({ where: { tenantId, invoiceId }, orderBy: { createdAt: 'desc' } });
  }
}
