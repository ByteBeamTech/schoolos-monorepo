// FEE-1: guards the Receipt ownership rule at the schema and migration level.
//
// The rule: exactly one receipt per PAYMENT, many receipts per invoice.
// PaymentService.generateReceipt()'s behaviour is covered by its own spec;
// these tests pin the two things a runtime spec cannot see -- what the schema
// declares, and what the migration actually does to the database.

import * as fs from 'fs';
import * as path from 'path';

const SCHEMA_FILE = path.resolve(
  __dirname,
  '../../../prisma/schema/student-billing/payments.prisma',
);
const INVOICE_SCHEMA_FILE = path.resolve(
  __dirname,
  '../../../prisma/schema/student-billing/invoices.prisma',
);
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../prisma/migrations');
const MIGRATION_NAME = '20260722020000_receipt_unique_per_payment';

function receiptModel(): string {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const match = schema.match(/model Receipt \{([\s\S]*?)\n\}/);
  if (!match) throw new Error('Receipt model not found in payments.prisma');
  return match[1];
}

describe('Receipt schema: one receipt per payment (FEE-1)', () => {
  it('paymentId is @unique — the receipt ownership key (IMPLEMENTATION_HANDOFF.md §10)', () => {
    expect(receiptModel()).toMatch(/^\s*paymentId\s+String\s+@unique\s*$/m);
    // If this fails: paymentId @unique is what makes a receipt belong to
    // exactly one payment, and what makes generateReceipt()'s findUnique
    // idempotency lookup valid. It must not be removed.
  });

  it('invoiceId is NOT unique — many receipts may belong to one invoice', () => {
    const model = receiptModel();
    expect(model).toMatch(/^\s*invoiceId\s+String\s*$/m);
    expect(model).not.toMatch(/^\s*invoiceId\s+String\s+@unique/m);
    // If this fails: a unique invoiceId allows only one receipt per invoice,
    // which makes any second payment on that invoice unreceiptable. That was
    // the bug this commit fixed.
  });

  it('invoiceId keeps an index, replacing the lookup path the dropped unique index provided', () => {
    expect(receiptModel()).toMatch(/@@index\(\[invoiceId\]\)/);
  });

  // BOTH sides of a Prisma relation declare its arity. Dropping @unique on the
  // defining side without widening the back-relation is a schema validation
  // error (P1012), and it is invisible from the Receipt model alone -- which
  // is exactly how it was missed the first time. Assert the other side too.
  it('Invoice declares a LIST back-relation, matching the non-unique invoiceId', () => {
    const invoiceSchema = fs.readFileSync(INVOICE_SCHEMA_FILE, 'utf8');
    const model = invoiceSchema.match(/model Invoice \{([\s\S]*?)\n\}/);
    if (!model) throw new Error('Invoice model not found in invoices.prisma');

    expect(model[1]).toMatch(/^\s*receipts\s+Receipt\[\]\s*$/m);
    // The old one-to-one form must be gone, or prisma validate fails.
    expect(model[1]).not.toMatch(/^\s*receipt\s+Receipt\?/m);
  });
});

describe('Receipt migration is forward-safe (FEE-1)', () => {
  const sql = fs.readFileSync(
    path.join(MIGRATIONS_DIR, MIGRATION_NAME, 'migration.sql'),
    'utf8',
  );

  it('drops exactly the unique index that existed, by its real name', () => {
    // Created as "Receipt_invoiceId_key" in
    // 20260414073052_add_transport_relations. Dropping a differently-named
    // index would silently no-op or fail.
    expect(sql).toMatch(/DROP INDEX "Receipt_invoiceId_key"/);
  });

  it('creates a non-unique replacement index on invoiceId', () => {
    expect(sql).toMatch(/CREATE INDEX "Receipt_invoiceId_idx" ON "Receipt"\("invoiceId"\)/);
    expect(sql).not.toMatch(/CREATE UNIQUE INDEX "Receipt_invoiceId/);
  });

  it('does not drop the paymentId unique index', () => {
    expect(sql).not.toMatch(/DROP INDEX "Receipt_paymentId_key"/);
  });

  it('performs no destructive or data-mutating operation', () => {
    // Relaxing a constraint and adding an index cannot fail on existing rows.
    // Anything below would make that claim untrue.
    for (const forbidden of [
      /DROP TABLE/i,
      /DROP COLUMN/i,
      /\bDELETE\s+FROM\b/i,
      /\bTRUNCATE\b/i,
      /\bUPDATE\s+"?Receipt"?\s+SET\b/i,
      /ALTER COLUMN .* SET NOT NULL/i,
    ]) {
      expect(sql).not.toMatch(forbidden);
    }
  });

  it('is the only migration touching the Receipt invoiceId index, so ordering is unambiguous', () => {
    const touching = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((d) => fs.statSync(path.join(MIGRATIONS_DIR, d)).isDirectory())
      .filter((d) => {
        const f = path.join(MIGRATIONS_DIR, d, 'migration.sql');
        if (!fs.existsSync(f)) return false;
        return /Receipt_invoiceId_(key|idx)/.test(fs.readFileSync(f, 'utf8'));
      })
      .sort();

    // The original creation, plus this one. A third would mean the constraint
    // was re-added somewhere and this migration's effect is not final.
    expect(touching).toEqual([
      '20260414073052_add_transport_relations',
      MIGRATION_NAME,
    ]);
  });
});
