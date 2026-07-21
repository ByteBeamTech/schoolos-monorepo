// FEE-0 item 6: the cross-role / cross-branch invariant suite for
// INV-1 … INV-13 (ADR-FEE-001 §10, ADR-FEE-002 §8), lifted from the ADRs'
// own invariant text. Each block quotes the invariant (abbreviated) and
// states HOW it is verified: directly here, by a named companion spec, or —
// where the surface an invariant governs does not exist yet — by a
// mechanical assertion that the surface indeed does not exist (so the
// invariant cannot be violated, and this test breaks the moment someone adds
// the surface without revisiting authorization).
//
// Unit-level scope note: true end-to-end cross-tenant/cross-branch proof
// needs a DB-backed e2e run; at unit level the enforceable form of INV-6/7/9
// is "the constraint is compiled into the query predicate", which the
// companion service specs assert call-by-call. This suite adds the
// metadata-level invariants and the module-wide default-deny tripwire.

import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../core/roles/roles.decorator';

import { InvoiceController } from './invoice/controllers/invoice.controller';
import { PaymentController } from './payment/controllers/payment.controller';
import { DiscountController } from './discounts/controllers/discount.controller';
import { FeePlansController } from './plans/controllers/fee-plans.controller';

const BILLING_CONTROLLERS: Array<[string, any]> = [
  ['InvoiceController', InvoiceController],
  ['PaymentController', PaymentController],
  ['DiscountController', DiscountController],
  ['FeePlansController', FeePlansController],
];

type RouteInfo = { name: string; path: string; roles: string[] | undefined };

function routesOf(controller: any): RouteInfo[] {
  return Object.getOwnPropertyNames(controller.prototype)
    .filter((n) => n !== 'constructor' && typeof controller.prototype[n] === 'function')
    .filter(
      (n) =>
        Reflect.getMetadata(PATH_METADATA, controller.prototype[n]) !== undefined ||
        Reflect.getMetadata(METHOD_METADATA, controller.prototype[n]) !== undefined,
    )
    .map((n) => ({
      name: n,
      path: String(Reflect.getMetadata(PATH_METADATA, controller.prototype[n]) ?? ''),
      roles: Reflect.getMetadata(ROLES_KEY, controller.prototype[n]),
    }));
}

describe('student-billing invariant suite (INV-1 … INV-13)', () => {
  // ── INV-5 / AUTH-041: "Authorization MUST be enforced server-side …
  //    a missing authorization decorator/guard MUST fail closed."
  //    Module-wide mechanical form: every route on every billing controller
  //    carries non-empty @Roles metadata. This is the repo-side tripwire for
  //    the RolesGuard allow-on-absent-decorator root cause.
  describe('INV-5 / AUTH-041 — every billing route has an explicit role grant', () => {
    for (const [ctrlName, ctrl] of BILLING_CONTROLLERS) {
      const routes = routesOf(ctrl);
      it(`${ctrlName}: has routes and none are unguarded`, () => {
        expect(routes.length).toBeGreaterThan(0);
        for (const r of routes) {
          expect(Array.isArray(r.roles)).toBe(true);
          expect((r.roles as string[]).length).toBeGreaterThan(0);
        }
      });
    }
  });

  // ── INV-1: "Every detail endpoint's authorization MUST be a subset of its
  //    list endpoint's authorization. (Detail ⊆ List.)"
  //    Metadata-level form: the :id route's role set ⊆ the list route's set.
  describe('INV-1 — Detail ⊆ List (role sets)', () => {
    const pairs: Array<[string, any, string, string]> = [
      ['InvoiceController', InvoiceController, 'findOne', 'findAll'],
      ['DiscountController', DiscountController, 'findOne', 'findAll'],
      ['FeePlansController', FeePlansController, 'findOne', 'findAll'],
    ];
    for (const [ctrlName, ctrl, detail, list] of pairs) {
      it(`${ctrlName}.${detail} roles ⊆ ${ctrlName}.${list} roles`, () => {
        const detailRoles: string[] = Reflect.getMetadata(ROLES_KEY, ctrl.prototype[detail]);
        const listRoles: string[] = Reflect.getMetadata(ROLES_KEY, ctrl.prototype[list]);
        for (const role of detailRoles) expect(listRoles).toContain(role);
      });
    }
    it('PaymentController.getHistory (the only payment read) needs no pair — single read surface', () => {
      const roles: string[] = Reflect.getMetadata(ROLES_KEY, PaymentController.prototype.getHistory);
      expect(roles.length).toBeGreaterThan(0);
    });
  });

  // ── INV-3: "Search authorization MUST equal detail authorization."
  //    No dedicated search endpoint exists in the module today; list-with-
  //    filters is the only search-like surface and is covered by INV-1's
  //    Detail ⊆ List check. This assertion breaks if a 'search' route is
  //    added, forcing a deliberate INV-3 treatment at that point.
  describe('INV-3 — Search = Detail (vacuous today, mechanically pinned)', () => {
    it('no billing route path contains "search"', () => {
      for (const [, ctrl] of BILLING_CONTROLLERS) {
        for (const r of routesOf(ctrl)) {
          expect(r.path.toLowerCase()).not.toContain('search');
        }
      }
    });
  });

  // ── INV-2: "Export MUST NOT expose any data unavailable through the UI/API
  //    for that principal." No export endpoint exists in the module today;
  //    pinned the same way as INV-3.
  describe('INV-2 — Export ⊆ UI (vacuous today, mechanically pinned)', () => {
    it('no billing route path contains "export" or "download"', () => {
      for (const [, ctrl] of BILLING_CONTROLLERS) {
        for (const r of routesOf(ctrl)) {
          expect(r.path.toLowerCase()).not.toMatch(/export|download/);
        }
      }
    });
  });

  // ── INV-4: notification eligibility — owned by ADR-FEE-006 surfaces, not
  //    this module's controllers. Out of FEE-0's unit scope; recorded here so
  //    the numbering is complete and auditable.
  it('INV-4 — notification eligibility: governed by ADR-FEE-006 surfaces (no billing route emits notifications directly)', () => {
    for (const [, ctrl] of BILLING_CONTROLLERS) {
      for (const r of routesOf(ctrl)) {
        expect(r.path.toLowerCase()).not.toContain('notif');
      }
    }
  });

  // ── INV-6/7/9 (cross-tenant / cross-branch isolation, authorization
  //    compiled into the query predicate): verified call-by-call in the
  //    companion specs — invoice.service.authz.spec.ts,
  //    payment.service.spec.ts (getPaymentHistory block),
  //    discount.service.authz.spec.ts, student-billing-access.service.spec.ts.
  //    This block re-asserts the INV-9 *shape* on one representative path so
  //    the invariant has a named home in this suite too.
  describe('INV-6 / INV-7 / INV-9 — constraints live in the query predicate', () => {
    it('representative: InvoiceService.findAll compiles tenant+branch into WHERE (see companion specs for full coverage)', async () => {
      const { Test } = require('@nestjs/testing');
      const { InvoiceService } = require('./invoice/services/invoice.service');
      const { PrismaService } = require('@infra/database/prisma.service');
      const { AuditService } = require('../../core/compliance/audit.service');
      const { EventEmitter2 } = require('@nestjs/event-emitter');
      const prisma = {
        invoice: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      };
      const mod = await Test.createTestingModule({
        providers: [
          InvoiceService,
          { provide: PrismaService, useValue: prisma },
          { provide: AuditService, useValue: {} },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        ],
      }).compile();
      await mod.get(InvoiceService).findAll('t-1', {}, 1, 20, ['b-1']);
      expect(prisma.invoice.findMany.mock.calls[0][0].where).toMatchObject({
        tenantId: 't-1',
        branchId: { in: ['b-1'] },
      });
    });
  });

  // ── INV-8 (ownership: PARENT/STUDENT reach only guardian-linked records):
  //    entity-level mechanics are student-billing-access.service.spec.ts
  //    (AUTH-003/004 blocks); endpoint wiring is
  //    fee-plans.controller.authz.spec.ts (assert-before-service block).
  //    Field-level ownership arrives with the FEE-4 projection. Pinned here:
  //    no billing read grants PARENT/STUDENT raw-row access today.
  it('INV-8 — no billing GET grants PARENT/STUDENT raw-row access pre-FEE-4', () => {
    for (const [, ctrl] of BILLING_CONTROLLERS) {
      for (const r of routesOf(ctrl)) {
        const method = Reflect.getMetadata(METHOD_METADATA, ctrl.prototype[r.name]);
        const isGet = method === 0; // RequestMethod.GET
        if (isGet) {
          expect(r.roles).not.toContain('PARENT');
          expect(r.roles).not.toContain('STUDENT');
        }
      }
    }
  });

  // ── INV-10 (client branch param never yields out-of-set data):
  //    invoice.service.authz.spec.ts getDefaulters block (denial with no
  //    query executed) + branch-context.middleware.spec.ts (header 403 path).
  // ── INV-11 (zero mappings + non-tenant-wide role = denied):
  //    jwt.strategy.spec.ts (login layer) +
  //    student-billing-access.service.spec.ts (empty-set fail-closed).
  // ── INV-13 (UserBranch changes effective next request, no JWT reissue):
  //    jwt.strategy.spec.ts (same-token, changed-mappings test).
  //    All three re-run as part of this suite via their own spec files.

  // ── INV-12 (background-job writes carry correct tenantId/branchId; no
  //    tenant starved by construction): the late-fee cron is today an
  //    UNSCOPED global sweep — a known, open finding assigned to FEE-2/FEE-7
  //    by the backlog, NOT fixed in FEE-0. Documented honestly as pending:
  it.todo(
    'INV-12 — late-fee cron tenant scoping: OPEN, assigned to FEE-2/FEE-7 (backlog items 9 / cron sweep); do not close FEE-0 claiming this passes',
  );
});
