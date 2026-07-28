// ADR-LIB-001 §9 -- the load-bearing boundary of the whole domain:
// Library generates charge REQUESTS, never money. This service owns that
// boundary end to end: computing/recording the request (PENDING), the
// explicit act of releasing it to Student Billing (SENT_TO_BILLING, which
// is the only thing that ever emits LIBRARY_CHARGE_REQUESTED), and
// Library-side waiver (only reachable from PENDING -- once sent, a waiver
// has to go through Billing's own mechanism, which this service
// deliberately does not and cannot reach into).

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { ChargeReason, BillingStatus } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';
import { EVENTS } from '../../../core/events/events.constants';

export interface CreateChargeRequestParams {
  tenantId:             string;
  branchId:             string;
  issueId:              string;
  borrowerType:          'STUDENT' | 'STAFF';
  borrowerId:            string;
  borrowerNameSnapshot:  string;
  reason:                ChargeReason;
  computedAmount:        number;
  actorId:               string;
  actorRole?:            string;
}

@Injectable()
export class LibraryChargeRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  /**
   * Called from inside the caller's own transaction (returnBook() /
   * markLost() in library.service.ts) -- creates the PENDING record only.
   * Does NOT emit LIBRARY_CHARGE_REQUESTED; that only happens from
   * sendToBilling() below, deliberately a separate, explicit step (a
   * review window before a computed fine is actually released to
   * Billing -- see IMPLEMENTATION_STATE.md for why this reads PENDING as
   * a real, reachable state rather than a formality).
   * A non-positive computedAmount (e.g. fineRatePerDay configured to 0)
   * creates nothing -- there is no charge to request.
   */
  async createChargeRequest(tx: any, params: CreateChargeRequestParams) {
    if (!(params.computedAmount > 0)) return null;

    const created = await tx.libraryChargeRequest.create({
      data: {
        tenantId:             params.tenantId,
        branchId:             params.branchId,
        issueId:              params.issueId,
        borrowerType:         params.borrowerType,
        borrowerId:           params.borrowerId,
        borrowerNameSnapshot: params.borrowerNameSnapshot,
        reason:               params.reason,
        computedAmount:       params.computedAmount,
      },
    });

    await this.audit.logCreate(
      {
        tenantId: params.tenantId, actorId: params.actorId, actorRole: params.actorRole,
        entityType: 'LibraryChargeRequest', entityId: created.id,
        after: { issueId: created.issueId, reason: created.reason, computedAmount: Number(created.computedAmount) },
      },
      tx,
    );

    return created;
  }

  /**
   * The entire Library -> Student Billing contract fires from here, once,
   * per charge request -- deterministic uniqueKey (no per-call suffix)
   * matches this codebase's existing one-time-event convention
   * (saas-payment.service.ts's `saas-invoice-paid:${invoice.id}`), since
   * a charge request can only ever be sent once through normal flow (the
   * PENDING-only guard below prevents a second send).
   */
  async sendToBilling(tenantId: string, chargeRequestId: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx: any) => {
      const cr = await tx.libraryChargeRequest.findFirst({ where: { id: chargeRequestId, tenantId } });
      if (!cr) throw new NotFoundException('Charge request not found.');
      if (cr.billingStatus !== 'PENDING') {
        throw new BadRequestException(`Only a PENDING charge request can be sent to Billing (current status: ${cr.billingStatus}).`);
      }

      const updated = await tx.libraryChargeRequest.update({
        where: { id: cr.id },
        data:  { billingStatus: 'SENT_TO_BILLING', sentAt: new Date() },
      });

      await tx.eventOutbox.create({
        data: {
          uniqueKey: `library-charge-requested:${cr.id}`,
          type:      EVENTS.LIBRARY_CHARGE_REQUESTED,
          payload: {
            core: { tenantId },
            chargeRequestId: cr.id, branchId: cr.branchId, issueId: cr.issueId,
            borrowerType: cr.borrowerType, borrowerId: cr.borrowerId,
            reason: cr.reason, amount: Number(cr.computedAmount), currency: 'INR',
          },
        },
      });

      await this.audit.logUpdate(
        {
          tenantId, actorId: actor.id, actorRole: actor.role,
          entityType: 'LibraryChargeRequest', entityId: cr.id,
          before: { billingStatus: 'PENDING' }, after: { billingStatus: 'SENT_TO_BILLING' },
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * ADR §9 rule 5: waivable from Library only while PENDING. Once sent,
   * Library has no further authority over it -- the person asking must go
   * through Billing's own waiver/credit-note mechanism (out of reach and
   * out of scope from here by design, not an oversight).
   */
  async waive(tenantId: string, chargeRequestId: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx: any) => {
      const cr = await tx.libraryChargeRequest.findFirst({ where: { id: chargeRequestId, tenantId } });
      if (!cr) throw new NotFoundException('Charge request not found.');
      if (cr.billingStatus !== 'PENDING') {
        throw new BadRequestException(
          `This charge request has already been sent to Billing (status: ${cr.billingStatus}) -- ` +
          `it can only be waived through Billing's own waiver/credit-note flow now, not from Library.`,
        );
      }

      const updated = await tx.libraryChargeRequest.update({
        where: { id: cr.id },
        data:  { billingStatus: 'WAIVED', waivedAt: new Date(), waivedBy: actor.id },
      });

      await this.audit.logUpdate(
        {
          tenantId, actorId: actor.id, actorRole: actor.role,
          entityType: 'LibraryChargeRequest', entityId: cr.id,
          before: { billingStatus: 'PENDING' }, after: { billingStatus: 'WAIVED' },
        },
        tx,
      );

      return updated;
    });
  }

  async list(tenantId: string, filters: { branchId?: string; billingStatus?: string; issueId?: string } = {}) {
    let billingStatus: BillingStatus | undefined;
    if (filters.billingStatus !== undefined) {
      const valid: BillingStatus[] = ['PENDING', 'SENT_TO_BILLING', 'BILLED', 'WAIVED', 'CANCELLED'];
      if (!valid.includes(filters.billingStatus as BillingStatus)) {
        throw new BadRequestException(`Unsupported billingStatus: ${filters.billingStatus}`);
      }
      billingStatus = filters.billingStatus as BillingStatus;
    }

    return this.prisma.libraryChargeRequest.findMany({
      where:   { tenantId, branchId: filters.branchId, issueId: filters.issueId, billingStatus },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForBorrower(tenantId: string, borrowerType: 'STUDENT' | 'STAFF', borrowerId: string) {
    return this.prisma.libraryChargeRequest.findMany({
      where:   { tenantId, borrowerType, borrowerId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
