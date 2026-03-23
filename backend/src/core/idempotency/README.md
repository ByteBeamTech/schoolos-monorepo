# core/idempotency

Prevents duplicate operations — double charges, duplicate bulk imports,
repeated webhook processing.

## How it works

Every payment request and bulk operation includes an `Idempotency-Key` header.
The idempotency store (Redis) checks if this key was already processed.
If yes: return the original response. If no: process and store result.

## TTL

Payment keys: 24 hours
Bulk operation keys: 1 hour
Webhook keys: 7 days

## Usage

Apply @Idempotent() decorator to any controller method that must not run twice:

  @Post('/payments')
  @Idempotent({ ttl: 86400 })
  async createPayment(@IdempotencyKey() key: string, @Body() dto: CreatePaymentDto) { }

## Modules that MUST use this

  student-billing/payment/collection
  student-billing/refunds
  saas-billing/gateways (all 3)
  bulk/operations
  integrations/webhooks
