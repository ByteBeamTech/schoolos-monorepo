/*
  FEE-1 (IMM-017/018): idempotency for payment recording.

  Adds a UNIQUE constraint on (tenantId, invoiceId, gatewayPaymentId).

  gatewayPaymentId carries a payment's external identity: the gateway's payment
  id for online payments, and a stable reference for offline ones -- either the
  cashier's cheque / receipt-book / bank reference, or, when none is supplied, a
  value derived deterministically from the payment's own business content.
  Recording the same logical payment twice therefore violates this constraint
  instead of silently crediting the invoice twice, and PaymentService turns the
  violation into the idempotent retry path: it returns the payment that was
  already recorded.

  This replaces an `OFFLINE-${Date.now()}` fallback, which made every submission
  unique and so made duplicates undetectable by construction.

  NULLs: Postgres does not treat NULLs as equal in a unique index, so many rows
  may hold NULL gatewayPaymentId. That is required -- an online payment has no
  gateway payment id between initiation and verification, and several such
  pending payments may coexist on one invoice.

  FORWARD-SAFETY:
    - Adding a unique index FAILS if duplicate non-NULL triples already exist.
      Verify before applying:

        SELECT "tenantId", "invoiceId", "gatewayPaymentId", COUNT(*)
        FROM "Payment"
        WHERE "gatewayPaymentId" IS NOT NULL
        GROUP BY 1, 2, 3
        HAVING COUNT(*) > 1;

      Zero rows must be returned. If any appear, they are genuine duplicate
      payment records and need a business decision (which to keep, whether the
      invoice was over-credited) before the constraint can be added -- that is
      a data-correction question, not something this migration should resolve.
    - No data is read, written or deleted; no column is added or removed.
    - Reversible: dropping the index is always safe.
*/

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_invoiceId_gatewayPaymentId_key" ON "Payment"("tenantId", "invoiceId", "gatewayPaymentId");
