// modules/student-billing/refund/refund.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService }  from '../../../core/compliance/audit.service';
import { ConfigService } from '@nestjs/config';

export interface InitiateRefundDto {
  paymentId: string;
  amount:    number;
  reason:    string;
}

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly audit:   AuditService,
    private readonly config:  ConfigService,
  ) {}

  async initiate(tenantId: string, dto: InitiateRefundDto, actorId: string) {
    const payment = await this.prisma.payment.findFirst({
      where:   { id: dto.paymentId, tenantId },
      include: { invoice: true, refunds: true },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'SUCCESS') throw new BadRequestException('Only successful payments can be refunded');

    // Calculate already-refunded amount from Refund records (Payment has no refundedAmount field)
    const alreadyRefunded = payment.refunds
      .filter((r: any) => r.status === 'SUCCESS')
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0);

    const maxRefund = Number(payment.amount) - alreadyRefunded;
    if (dto.amount > maxRefund) {
      throw new BadRequestException(`Refund amount ${dto.amount} exceeds available ${maxRefund}`);
    }

    // Refund schema: id, tenantId, paymentId, amount, reason, status, gatewayRefundId, gateway, initiatedBy, processedAt
    // No currency or failureReason fields on Refund
    const refund = await this.prisma.refund.create({
      data: {
        tenantId,
        paymentId:   dto.paymentId,
        amount:      dto.amount,
        reason:      dto.reason,
        status:      'PENDING',
        gateway:     payment.gateway,  // required field — copy from payment
        initiatedBy: actorId,
      },
    });

    let gatewayRefundId = '';
    try {
      gatewayRefundId = await this.processGatewayRefund(payment, dto.amount);
    } catch (err: any) {
      // No failureReason field on Refund — use notes via reason update
      await this.prisma.refund.update({
        where: { id: refund.id },
        data:  { status: 'FAILED', reason: `${dto.reason} | FAILED: ${err.message}` },
      });
      throw new BadRequestException(`Gateway refund failed: ${err.message}`);
    }

    await this.prisma.refund.update({
      where: { id: refund.id },
      data:  { status: 'SUCCESS', gatewayRefundId, processedAt: new Date() },
    });

    // Update payment status based on refund totals
    const newTotalRefunded = alreadyRefunded + dto.amount;
    const isFullRefund     = newTotalRefunded >= Number(payment.amount);
    await this.prisma.payment.update({
      where: { id: dto.paymentId },
      data:  { status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
    });

    // Reopen invoice if fully refunded
    if (isFullRefund) {
      await this.prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          status:     'SENT',
          paidAmount: 0,
          dueAmount:  payment.invoice.totalAmount,
          paidAt:     null,
        },
      });
    }

    await this.audit.log({
      tenantId,
      actorId,
      actorRole:  'ACCOUNTANT' as any,
      action:     'REFUND_INITIATED' as any,
      entityType: 'Payment',
      entityId:   dto.paymentId,
      after:      { refundId: refund.id, amount: dto.amount, reason: dto.reason },
    });

    this.logger.log(`Refund processed: ${refund.id} amount=${dto.amount} gateway=${gatewayRefundId}`);
    return { refund: { ...refund, gatewayRefundId } };
  }

  private async processGatewayRefund(payment: any, amount: number): Promise<string> {
    switch (String(payment.gateway)) {
      case 'RAZORPAY': return this.razorpayRefund(payment.gatewayPaymentId, amount);
      case 'STRIPE':   return this.stripeRefund(payment.gatewayPaymentId, amount, String(payment.currency));
      case 'PAYPAL':   return this.paypalRefund(payment.gatewayPaymentId, amount, String(payment.currency));
      default:
        this.logger.warn(`Offline refund recorded for payment ${payment.id}`);
        return `MANUAL-REFUND-${Date.now()}`;
    }
  }

  private async razorpayRefund(paymentId: string, amount: number): Promise<string> {
    const keyId     = this.config.get<string>('RAZORPAY_STUDENT_KEY_ID', '');
    const keySecret = this.config.get<string>('RAZORPAY_STUDENT_KEY_SECRET', '');
    if (!keyId || keyId.includes('xxx')) return `rfnd_mock_${Date.now()}`;
    const Razorpay = require('razorpay');
    const rzp      = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const refund   = await rzp.payments.refund(paymentId, { amount: Math.round(amount * 100) });
    return refund.id;
  }

  private async stripeRefund(chargeId: string, amount: number, currency: string): Promise<string> {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY', '');
    if (!secretKey || secretKey.includes('xxx')) return `re_mock_${Date.now()}`;
    const Stripe = require('stripe');
    const stripe = new Stripe(secretKey);
    const refund = await stripe.refunds.create({ charge: chargeId, amount: Math.round(amount * 100), currency: currency.toLowerCase() });
    return refund.id;
  }

  private async paypalRefund(captureId: string, amount: number, currency: string): Promise<string> {
    const clientId     = this.config.get<string>('PAYPAL_CLIENT_ID', '');
    const clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET', '');
    if (!clientId || clientId.includes('xxx')) return `PAYPAL-REFUND-mock-${Date.now()}`;
    const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const { access_token } = await tokenRes.json() as any;
    const refundRes = await fetch(`https://api-m.paypal.com/v2/payments/captures/${captureId}/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: { value: amount.toFixed(2), currency_code: currency } }),
    });
    const refund = await refundRes.json() as any;
    return refund.id;
  }

  async listRefunds(tenantId: string, paymentId?: string) {
    return this.prisma.refund.findMany({
      where:   { tenantId, ...(paymentId ? { paymentId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }
}
