// modules/saas-billing/payment/gateway/saas-gateway.factory.ts
//
// SaasGatewayFactory — resolves the correct payment gateway adapter for
// SaaS subscription billing (ByteBeam charging a Tenant).
//
// PR-3 / ARCH-002 (Rule of Three) note: this is a deliberate copy of
// student-billing/payment/gateway/gateway.factory.ts's adapter pattern, NOT
// a shared import. Rule of Three says the 1st occurrence gets built, the
// 2nd gets copied and adapted, and only the 3rd triggers extraction into a
// shared package. This is the 2nd occurrence. It is also NOT the same
// credentials or money flow: student-billing is Parent -> School; this is
// School(Tenant) -> ByteBeam. Sharing env vars between the two would mean a
// misconfigured key charges the wrong party, so the env var names are
// deliberately distinct (RAZORPAY_SAAS_* vs RAZORPAY_STUDENT_*).
//
// TenantSubscription.gateway is typed as PaymentGatewayProvider, which only
// has STRIPE | RAZORPAY | CASH (no PayPal for SaaS billing, unlike
// student-billing) — CASH is not a real gateway call, it's the offline/
// manual-invoice path, handled separately in SaasPaymentService, not here.

import { Injectable }    from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@infra/database/prisma.service';

export interface SaasGatewayCreateOrderResult {
  gatewayOrderId: string;
  gatewayKeyId?:  string;
  amount:         number;
  currency:       string;
  raw:            any;
}

export interface SaasGatewayAdapter {
  createOrder(amount: number, currency: string, reference: string): Promise<SaasGatewayCreateOrderResult>;
  verifyPayment(orderId: string, paymentId: string, signature: string): Promise<boolean>;
}

// ─── Razorpay ─────────────────────────────────────────────────────────────────

export class SaasRazorpayAdapter implements SaasGatewayAdapter {
  constructor(private readonly keyId: string, private readonly keySecret: string) {}

  private get isMockMode(): boolean {
    return !this.keyId || this.keyId.includes('xxx');
  }

  async createOrder(amount: number, currency: string, reference: string): Promise<SaasGatewayCreateOrderResult> {
    if (this.isMockMode) {
      return { gatewayOrderId: `order_mock_${Date.now()}`, gatewayKeyId: 'CONFIGURE_KEY', amount, currency, raw: {} };
    }
    const Razorpay = require('razorpay');
    const rzp      = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    const order    = await rzp.orders.create({ amount: Math.round(amount * 100), currency, receipt: reference });
    return { gatewayOrderId: order.id, gatewayKeyId: this.keyId, amount, currency, raw: order };
  }

  async verifyPayment(orderId: string, paymentId: string, signature: string): Promise<boolean> {
    if (this.isMockMode) return true; // dev/mock mode -- see gateway.factory.ts's equivalent for the pattern
    const crypto   = await import('crypto');
    const expected = crypto.createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`).digest('hex');
    return expected === signature;
  }
}

// ─── Stripe ───────────────────────────────────────────────────────────────────

export class SaasStripeAdapter implements SaasGatewayAdapter {
  constructor(private readonly secretKey: string, private readonly publishableKey: string) {}

  private get isMockMode(): boolean {
    return !this.secretKey || this.secretKey.includes('xxx');
  }

  async createOrder(amount: number, currency: string, reference: string): Promise<SaasGatewayCreateOrderResult> {
    if (this.isMockMode) {
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
    if (this.isMockMode) return true;
    const Stripe = require('stripe');
    const stripe = new Stripe(this.secretKey);
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return intent.status === 'succeeded';
  }
}

// ─── SaasGatewayFactory ─────────────────────────────────────────────────────────

@Injectable()
export class SaasGatewayFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async forTenant(tenantId: string): Promise<SaasGatewayAdapter> {
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId_isCurrent: { tenantId, isCurrent: true } },
    });
    const gateway = subscription?.gateway ?? 'RAZORPAY';
    return this.forGateway(gateway as string);
  }

  forGateway(gateway: string): SaasGatewayAdapter {
    switch (gateway) {
      case 'STRIPE':
        return new SaasStripeAdapter(
          this.config.get<string>('STRIPE_SAAS_SECRET_KEY', 'sk_test_xxx'),
          this.config.get<string>('STRIPE_SAAS_PUBLISHABLE_KEY', 'pk_test_xxx'),
        );
      case 'RAZORPAY':
      default:
        return new SaasRazorpayAdapter(
          this.config.get<string>('RAZORPAY_SAAS_KEY_ID', 'rzp_test_xxx'),
          this.config.get<string>('RAZORPAY_SAAS_KEY_SECRET', 'xxx'),
        );
    }
  }
}
