// core/webhooks/webhook-hmac.guard.ts
// Phase 1 — Webhook HMAC verification for Razorpay, Stripe, PayPal
//
// Attach with @UseGuards(WebhookHmacGuard) on webhook endpoints.
// Set the gateway via @SetMetadata('webhook_gateway', 'razorpay') etc.

import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, Logger, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

export type WebhookGateway = 'razorpay' | 'stripe' | 'paypal';
export const WEBHOOK_GATEWAY_KEY = 'webhook_gateway';
export const WebhookGateway = (gateway: WebhookGateway) =>
  SetMetadata(WEBHOOK_GATEWAY_KEY, gateway);

@Injectable()
export class WebhookHmacGuard implements CanActivate {
  private readonly logger = new Logger(WebhookHmacGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config:    ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const gateway = this.reflector.get<WebhookGateway>(
      WEBHOOK_GATEWAY_KEY,
      context.getHandler(),
    );
    if (!gateway) {
      this.logger.warn('WebhookHmacGuard used without @WebhookGateway() decorator');
      return false;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const rawBody: Buffer = (req as any).rawBody;

    if (!rawBody) {
      throw new UnauthorizedException(
        'Raw body not available. Ensure rawBody middleware is enabled for webhook routes.',
      );
    }

    switch (gateway) {
      case 'razorpay': return this.verifyRazorpay(req, rawBody);
      case 'stripe':   return this.verifyStripe(req, rawBody);
      case 'paypal':   return this.verifyPaypal(req, rawBody);
      default:
        throw new UnauthorizedException(`Unknown webhook gateway: ${gateway}`);
    }
  }

  // ─── Razorpay ────────────────────────────────────────────────────────────────
  // Header: x-razorpay-signature
  // HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)

  private verifyRazorpay(req: Request, rawBody: Buffer): boolean {
    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature) throw new UnauthorizedException('Missing x-razorpay-signature header');

    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) throw new UnauthorizedException('RAZORPAY_WEBHOOK_SECRET not configured');

    const expected = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (!this.safeCompare(expected, signature)) {
      this.logger.warn('Razorpay webhook HMAC verification failed');
      throw new UnauthorizedException('Invalid Razorpay webhook signature');
    }
    return true;
  }

  // ─── Stripe ──────────────────────────────────────────────────────────────────
  // Header: stripe-signature (t=timestamp,v1=signature)
  // HMAC-SHA256(`${timestamp}.${rawBody}`, STRIPE_WEBHOOK_SECRET)
  // Timestamp tolerance: 300s

  private verifyStripe(req: Request, rawBody: Buffer): boolean {
    const sigHeader = req.headers['stripe-signature'] as string;
    if (!sigHeader) throw new UnauthorizedException('Missing stripe-signature header');

    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new UnauthorizedException('STRIPE_WEBHOOK_SECRET not configured');

    const parts     = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
    const timestamp = parts['t'];
    const v1sig     = parts['v1'];

    if (!timestamp || !v1sig) {
      throw new UnauthorizedException('Malformed stripe-signature header');
    }

    // Replay attack protection: reject if timestamp > 5 minutes old
    const tolerance = 300;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > tolerance) {
      throw new UnauthorizedException('Stripe webhook timestamp outside tolerance window');
    }

    const payload  = `${timestamp}.${rawBody.toString('utf8')}`;
    const expected = createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    if (!this.safeCompare(expected, v1sig)) {
      this.logger.warn('Stripe webhook HMAC verification failed');
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }
    return true;
  }

  // ─── PayPal ──────────────────────────────────────────────────────────────────
  // PayPal uses a certificate-based verification in production.
  // For webhook simulation / sandbox: PAYPAL-TRANSMISSION-SIG header
  // contains HMAC-SHA256(transmissionId + '|' + timestamp + '|' + webhookId + '|' + crc32(rawBody))
  // Simplified: verify via PAYPAL_WEBHOOK_ID matching + basic sig check

  private verifyPaypal(req: Request, rawBody: Buffer): boolean {
    const transmissionId  = req.headers['paypal-transmission-id'] as string;
    const transmissionSig = req.headers['paypal-transmission-sig'] as string;
    const timestamp       = req.headers['paypal-transmission-time'] as string;

    if (!transmissionId || !transmissionSig || !timestamp) {
      throw new UnauthorizedException('Missing PayPal webhook headers');
    }

    const webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');
    const secret    = this.config.get<string>('PAYPAL_WEBHOOK_SECRET');

    if (!webhookId || !secret) {
      throw new UnauthorizedException('PAYPAL_WEBHOOK_ID or PAYPAL_WEBHOOK_SECRET not configured');
    }

    // CRC32 of raw body
    const crc = this.crc32(rawBody).toString();
    const message = `${transmissionId}|${timestamp}|${webhookId}|${crc}`;

    const expected = createHmac('sha256', secret)
      .update(message)
      .digest('base64');

    if (!this.safeCompare(expected, transmissionSig)) {
      this.logger.warn('PayPal webhook HMAC verification failed');
      throw new UnauthorizedException('Invalid PayPal webhook signature');
    }
    return true;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private safeCompare(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);
      if (bufA.length !== bufB.length) return false;
      return timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }

  private crc32(buf: Buffer): number {
    const table = this.makeCrc32Table();
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private makeCrc32Table(): number[] {
    const table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
    return table;
  }
}
