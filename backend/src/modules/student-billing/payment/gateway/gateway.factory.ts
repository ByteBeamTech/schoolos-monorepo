// modules/student-billing/payment/gateway/gateway.factory.ts
// GatewayFactory.forTenant() — resolves the correct payment gateway adapter
// based on the tenant's configured gateway (from TenantSubscription).

import { Injectable }    from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@infra/database/prisma.service';

export interface GatewayCreateOrderResult {
  gatewayOrderId: string;
  gatewayKeyId?:  string;
  amount:         number;
  currency:       string;
  raw:            any;
}

export interface GatewayAdapter {
  createOrder(amount: number, currency: string, reference: string): Promise<GatewayCreateOrderResult>;
  verifyPayment(orderId: string, paymentId: string, signature: string): Promise<boolean>;
  refund(paymentId: string, amount: number): Promise<string>;
}

// ─── Razorpay ─────────────────────────────────────────────────────────────────

export class RazorpayAdapter implements GatewayAdapter {
  constructor(private readonly keyId: string, private readonly keySecret: string) {}

  async createOrder(amount: number, currency: string, reference: string): Promise<GatewayCreateOrderResult> {
    if (!this.keyId || this.keyId.includes('xxx')) {
      return { gatewayOrderId: `order_mock_${Date.now()}`, gatewayKeyId: 'CONFIGURE_KEY', amount, currency, raw: {} };
    }
    const Razorpay = require('razorpay');
    const rzp      = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    const order    = await rzp.orders.create({ amount: Math.round(amount * 100), currency, receipt: reference });
    return { gatewayOrderId: order.id, gatewayKeyId: this.keyId, amount, currency, raw: order };
  }

  async verifyPayment(orderId: string, paymentId: string, signature: string): Promise<boolean> {
    const crypto   = await import('crypto');
    const expected = crypto.createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`).digest('hex');
    return expected === signature;
  }

  async refund(paymentId: string, amount: number): Promise<string> {
    if (!this.keyId || this.keyId.includes('xxx')) return `rfnd_mock_${Date.now()}`;
    const Razorpay = require('razorpay');
    const rzp      = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    const refund   = await rzp.payments.refund(paymentId, { amount: Math.round(amount * 100) });
    return refund.id;
  }
}

// ─── Stripe ───────────────────────────────────────────────────────────────────

export class StripeAdapter implements GatewayAdapter {
  constructor(private readonly secretKey: string, private readonly publishableKey: string) {}

  async createOrder(amount: number, currency: string, reference: string): Promise<GatewayCreateOrderResult> {
    if (!this.secretKey || this.secretKey.includes('xxx')) {
      return { gatewayOrderId: `pi_mock_${Date.now()}`, gatewayKeyId: this.publishableKey, amount, currency, raw: {} };
    }
    const Stripe  = require('stripe');
    const stripe  = new Stripe(this.secretKey);
    const intent  = await stripe.paymentIntents.create({
      amount:   Math.round(amount * 100),
      currency: currency.toLowerCase(),
      metadata: { reference },
    });
    return { gatewayOrderId: intent.id, gatewayKeyId: this.publishableKey, amount, currency, raw: intent };
  }

  async verifyPayment(paymentIntentId: string, _paymentId: string, _signature: string): Promise<boolean> {
    if (!this.secretKey || this.secretKey.includes('xxx')) return true;
    const Stripe = require('stripe');
    const stripe = new Stripe(this.secretKey);
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return intent.status === 'succeeded';
  }

  async refund(chargeId: string, amount: number): Promise<string> {
    if (!this.secretKey || this.secretKey.includes('xxx')) return `re_mock_${Date.now()}`;
    const Stripe  = require('stripe');
    const stripe  = new Stripe(this.secretKey);
    const refund  = await stripe.refunds.create({ charge: chargeId, amount: Math.round(amount * 100) });
    return refund.id;
  }
}

// ─── PayPal ───────────────────────────────────────────────────────────────────

export class PayPalAdapter implements GatewayAdapter {
  constructor(
    private readonly clientId:     string,
    private readonly clientSecret: string,
    private readonly sandbox:      boolean = false,
  ) {}

  private get baseUrl() {
    return this.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  }

  private async getToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const data = await res.json() as any;
    return data.access_token;
  }

  async createOrder(amount: number, currency: string, reference: string): Promise<GatewayCreateOrderResult> {
    if (!this.clientId || this.clientId.includes('xxx')) {
      return { gatewayOrderId: `PAYPAL-ORDER-mock-${Date.now()}`, amount, currency, raw: {} };
    }
    const token = await this.getToken();
    const res   = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ reference_id: reference, amount: { currency_code: currency, value: amount.toFixed(2) } }],
      }),
    });
    const order = await res.json() as any;
    return { gatewayOrderId: order.id, amount, currency, raw: order };
  }

  async verifyPayment(orderId: string, _paymentId: string, _signature: string): Promise<boolean> {
    if (!this.clientId || this.clientId.includes('xxx')) return true;
    const token  = await this.getToken();
    const res    = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const order = await res.json() as any;
    return order.status === 'COMPLETED';
  }

  async refund(captureId: string, amount: number): Promise<string> {
    if (!this.clientId || this.clientId.includes('xxx')) return `PAYPAL-REFUND-mock-${Date.now()}`;
    const token  = await this.getToken();
    const res    = await fetch(`${this.baseUrl}/v2/payments/captures/${captureId}/refund`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ amount: { value: amount.toFixed(2) } }),
    });
    const refund = await res.json() as any;
    return refund.id;
  }
}

// ─── GatewayFactory ───────────────────────────────────────────────────────────

@Injectable()
export class GatewayFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async forTenant(tenantId: string): Promise<GatewayAdapter> {
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
    });

    const gateway = subscription?.gateway ?? 'RAZORPAY';
    return this.forGateway(gateway as string);
  }

  forGateway(gateway: string): GatewayAdapter {
    switch (gateway) {
      case 'STRIPE':
        return new StripeAdapter(
          this.config.get<string>('STRIPE_SECRET_KEY', 'sk_test_xxx'),
          this.config.get<string>('STRIPE_PUBLISHABLE_KEY', 'pk_test_xxx'),
        );
      case 'PAYPAL':
        return new PayPalAdapter(
          this.config.get<string>('PAYPAL_CLIENT_ID', 'xxx'),
          this.config.get<string>('PAYPAL_CLIENT_SECRET', 'xxx'),
          this.config.get<string>('NODE_ENV') !== 'production',
        );
      case 'RAZORPAY':
      default:
        return new RazorpayAdapter(
          this.config.get<string>('RAZORPAY_STUDENT_KEY_ID', 'rzp_test_xxx'),
          this.config.get<string>('RAZORPAY_STUDENT_KEY_SECRET', 'xxx'),
        );
    }
  }
}
