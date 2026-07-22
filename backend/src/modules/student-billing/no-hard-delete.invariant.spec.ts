// FEE-1: no-hard-delete regression tripwire (ADR-FEE-003 IMM-009 / IMM-010).
//
// Financial records are never hard-deleted, and never soft-deleted via a
// `deletedAt`-style flag either -- ADR-FEE-003 requires real terminal states
// (CANCELLED, FAILED, REFUNDED, ...) instead. Today the codebase has never
// violated this: no DELETE route, no delete() call, no deletedAt column
// anywhere in student-billing. That makes this a CLEAN BASELINE to protect,
// not a bug to fix.
//
// These tests read the actual schema and source files rather than asserting on
// behavior, because the risk being guarded is someone ADDING a delete path
// later -- a runtime test can only cover code that already exists. The failure
// message is deliberately explicit about the rule, so whoever trips it
// understands it is an architectural decision (requiring an ADR revision to
// change) rather than a lint annoyance to silence.

import * as fs from 'fs';
import * as path from 'path';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';

import { InvoiceController } from './invoice/controllers/invoice.controller';
import { PaymentController } from './payment/controllers/payment.controller';
import { DiscountController } from './discounts/controllers/discount.controller';
import { FeePlansController } from './plans/controllers/fee-plans.controller';

const MODULE_DIR = __dirname;
const SCHEMA_DIR = path.resolve(
  __dirname,
  '../../../prisma/schema/student-billing',
);

/**
 * Financial records governed by IMM-009/010. Sequence tables
 * (InvoiceSequence / ReceiptSequence) are counters, not financial records, so
 * they are deliberately out of scope. DiscountCategory is branch-managed
 * configuration rather than a financial fact, but is included because
 * deleting a category referenced by issued discounts would break historical
 * records -- FEE-2's category administration must deactivate, not delete.
 */
const PROTECTED_MODELS = [
  'Invoice',
  'InvoiceItem',
  'Payment',
  'Receipt',
  'Discount',
  'DiscountApproval',
  'DiscountCategory',
  'LateFee',
  'Refund',
  'FeePlan',
  'FeeItem',
  'FeeAssignment',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Strip // and /* *\/ comments so prose about deletion is not flagged. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('student-billing: no hard delete, no soft delete (IMM-009 / IMM-010)', () => {
  const sourceFiles = walk(MODULE_DIR);

  it('finds source files to scan (guards against a silently empty sweep)', () => {
    expect(sourceFiles.length).toBeGreaterThan(10);
  });

  it('no financial Prisma model declares a deletedAt-style soft-delete column', () => {
    const offenders: string[] = [];

    for (const file of fs.readdirSync(SCHEMA_DIR)) {
      if (!file.endsWith('.prisma')) continue;
      const content = fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8');
      // Match a field declaration, not a comment or an index reference.
      const match = content.match(/^\s*(deletedAt|isDeleted|is_deleted)\s+\w/gm);
      if (match) offenders.push(`${file}: ${match.join(', ').trim()}`);
    }

    expect(offenders).toEqual([]);
    // If this fails: ADR-FEE-003 IMM-010 forbids soft-delete flags on
    // financial models. Use a real terminal state (CANCELLED / FAILED /
    // REFUNDED / ...) instead. Changing this needs an ADR revision.
  });

  it('no service or controller calls delete()/deleteMany() on a financial model', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles) {
      const src = stripComments(fs.readFileSync(file, 'utf8'));
      for (const model of PROTECTED_MODELS) {
        // prisma.invoice.delete(...) / tx.invoice.deleteMany(...) — the
        // Prisma delegate is the model name with a lowercased first letter.
        const delegate = model.charAt(0).toLowerCase() + model.slice(1);
        const pattern = new RegExp(
          `\\.${delegate}\\s*\\.\\s*(delete|deleteMany)\\s*\\(`,
        );
        if (pattern.test(src)) {
          offenders.push(`${path.relative(MODULE_DIR, file)} -> ${delegate}.delete*`);
        }
      }
    }

    expect(offenders).toEqual([]);
    // If this fails: ADR-FEE-003 IMM-009 forbids hard-deleting financial
    // records. Transition to a terminal state instead. Changing this needs an
    // ADR revision, not a workaround here.
  });

  it('no billing controller exposes an HTTP DELETE route', () => {
    const controllers: Array<[string, any]> = [
      ['InvoiceController', InvoiceController],
      ['PaymentController', PaymentController],
      ['DiscountController', DiscountController],
      ['FeePlansController', FeePlansController],
    ];

    const offenders: string[] = [];

    for (const [name, ctrl] of controllers) {
      for (const handler of Object.getOwnPropertyNames(ctrl.prototype)) {
        if (handler === 'constructor') continue;
        const fn = ctrl.prototype[handler];
        if (typeof fn !== 'function') continue;
        if (Reflect.getMetadata(PATH_METADATA, fn) === undefined) continue;
        if (Reflect.getMetadata(METHOD_METADATA, fn) === RequestMethod.DELETE) {
          offenders.push(`${name}.${handler}`);
        }
      }
    }

    expect(offenders).toEqual([]);
    // If this fails: financial records have no delete endpoint by design
    // (IMM-009). Cancellation goes through an explicit state transition --
    // e.g. PATCH /billing/invoices/:id/cancel -- which is auditable and
    // reversible, unlike a DELETE.
  });
});
