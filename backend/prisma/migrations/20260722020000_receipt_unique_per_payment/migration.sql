/*
  FEE-1: one receipt per PAYMENT, not one per invoice.

  `Receipt.invoiceId` carried a UNIQUE constraint (index
  "Receipt_invoiceId_key", created in 20260414073052_add_transport_relations).
  That constraint encoded the wrong ownership rule: it allowed only one receipt
  per invoice, so any second payment against the same invoice -- an instalment
  or a partial payment -- could not be receipted.

  `Receipt.paymentId` remains UNIQUE. That is the correct invariant and is
  preserved deliberately (IMPLEMENTATION_HANDOFF.md §10): exactly one receipt
  per payment, many receipts per invoice.

  The dropped unique index also served the "all receipts for this invoice"
  lookup, so a plain (non-unique) index replaces it rather than leaving that
  query path unindexed.

  FORWARD-SAFETY:
    - Dropping a uniqueness constraint can never fail on existing rows: every
      dataset that satisfied the stricter constraint also satisfies the absence
      of it. This direction is always safe, on any data volume.
    - Creating a non-unique index cannot fail on duplicate values.
    - No data is read, written, or deleted; no column is added or removed.
    - No backfill is required.

  REVERSIBILITY: re-adding the unique constraint later would fail if any
  invoice had accumulated more than one receipt by then -- which is precisely
  the state this migration exists to allow. That is intended and one-way. A
  revert is only safe before multi-payment invoices exist.
*/

-- DropIndex
DROP INDEX "Receipt_invoiceId_key";

-- CreateIndex
CREATE INDEX "Receipt_invoiceId_idx" ON "Receipt"("invoiceId");
