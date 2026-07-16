// modules/saas-billing/payment/controllers/saas-webhook.controller.ts
//
// Deliberately separate from saas-payment.controller.ts: this route MUST
// live under the `webhooks/` prefix to ride the pre-existing
// `webhooks/(.*)` exclusion already configured for both TenantMiddleware
// and BranchContextMiddleware in app.module.ts. Those middlewares require
// tenant/branch context (x-tenant-id / x-branch-id headers) that a
// gateway-to-gateway webhook call will never send -- Razorpay doesn't know
// what a "tenant" is. Mixing this into a tenant-scoped controller (as an
// earlier version of this PR did) means the request 401s before it ever
// reaches WebhookHmacGuard.

import { Controller, Post, Req, UseGuards, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '../../../../core/auth/decorators/public.decorator';
import { WebhookHmacGuard, WebhookGateway } from '../../../../core/webhooks/webhook-hmac.guard';
import { SaasPaymentService } from '../services/saas-payment.service';

@ApiExcludeController() // gateway-to-gateway, not part of the public API surface
@Controller('webhooks/saas')
export class SaasWebhookController {
  constructor(private readonly payments: SaasPaymentService) {}

  // PR-3 fix: JwtGuard is registered globally via APP_GUARD (app.module.ts),
  // so every route requires a Bearer token by default. Razorpay's webhook
  // call will never send one -- it doesn't have a SchoolOS user session.
  // @Public() is this app's existing, established mechanism for exempting a
  // route from that global guard (JwtGuard checks for this exact metadata
  // key via Reflector -- see jwt.guard.ts). This does NOT leave the route
  // unauthenticated: WebhookHmacGuard below is the real auth boundary here,
  // verifying the gateway's HMAC signature instead of a user's JWT.
  @Public()
  @Post('razorpay')
  @HttpCode(200)
  @UseGuards(WebhookHmacGuard)
  @WebhookGateway('razorpay')
  async razorpayWebhook(@Req() req: Request) {
    const body  = req.body as any;
    const event = body?.event as string;

    // Razorpay batches many event types through one webhook URL -- only act
    // on the ones this service understands. Anything else is acknowledged
    // (200) and ignored, per Razorpay's own guidance: an unrecognized event
    // type is not a delivery failure, and returning non-200 just triggers
    // pointless retries.
    if (event === 'payment.captured' || event === 'order.paid') {
      const payment = body?.payload?.payment?.entity;
      if (!payment?.order_id || !payment?.id) {
        return { received: true, handled: false, reason: 'missing order_id/payment_id in payload' };
      }
      const result = await this.payments.verifyAndRecordPayment({
        gateway:          'RAZORPAY',
        gatewayOrderId:   payment.order_id,
        gatewayPaymentId: payment.id,
      });
      return { received: true, ...result };
    }

    if (event === 'payment.failed') {
      const payment = body?.payload?.payment?.entity;
      if (!payment?.order_id) {
        return { received: true, handled: false, reason: 'missing order_id in payload' };
      }
      const result = await this.payments.recordPaymentFailure({
        gatewayOrderId: payment.order_id,
        reason:         payment.error_description ?? 'Payment failed at gateway',
      });
      return { received: true, ...result };
    }

    return { received: true, handled: false, reason: `unhandled event type: ${event}` };
  }
}
