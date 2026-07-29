import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';

export interface ResolvedTransportCharge {
  assignmentId: string;
  studentId: string;
  routeId: string;
  routeName: string;
  pickupRouteStopId: string;
  pickupStopName: string;
  feeAmount: number;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

/**
 * SAD Ch.9 / ADR-005: TransportPricingService resolves applicable transport
 * charges. "Reason: Keeps Invoice Generator independent from transport
 * internals" — this is the stable contract Finance is meant to consume
 * instead of reaching into StudentTransportAssignment/TransportStopPricing
 * directly.
 *
 * IMPORTANT — migration status (per the agreed incremental strategy): this
 * service is NOT wired into InvoiceService yet.
 * student-billing/invoice/services/invoice.service.ts still resolves the
 * legacy TransportAssignment/TransportRoute.feeAmount path directly (ADR-004
 * violation, acknowledged legacy debt). That migration is deliberately a
 * separate, later phase — "InvoiceService will continue using the legacy
 * implementation until the TransportPricingService is production-ready. Only
 * after the new pricing service has been validated will Finance be migrated
 * to the abstraction." This phase only builds and exposes the resolution
 * service standalone.
 */
@Injectable()
export class TransportPricingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ch.9 Pricing Resolution Flow: Student -> StudentTransportAssignment ->
   * PickupRouteStop -> TransportPricingService -> Applicable Charge.
   * Returns one entry per ACTIVE assignment as of `asOfDate` (normally one,
   * but AF-002's allowMultipleActiveAssignments can make it more than one).
   * Assignments with no currently-active pricing on their pickup stop are
   * silently skipped, not errored — an unpriced stop is a data-quality gap
   * for Transport to fix, not a reason to fail invoice generation.
   */
  async resolveChargesForStudent(
    tenantId: string,
    studentId: string,
    asOfDate: Date = new Date(),
  ): Promise<ResolvedTransportCharge[]> {
    const assignments = await this.prisma.studentTransportAssignment.findMany({
      where: {
        tenantId,
        studentId,
        status: 'ACTIVE',
        effectiveFrom: { lte: asOfDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOfDate } }],
      },
      include: {
        route: true,
        pickupRouteStop: { include: { stop: true } },
      },
    });

    const charges: ResolvedTransportCharge[] = [];
    for (const assignment of assignments) {
      const pricing = await this.prisma.transportStopPricing.findFirst({
        where: {
          routeStopId: assignment.pickupRouteStopId,
          isActive: true,
          effectiveFrom: { lte: asOfDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOfDate } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (!pricing) continue; // no active price on this stop — nothing to charge yet

      charges.push({
        assignmentId: assignment.id,
        studentId: assignment.studentId,
        routeId: assignment.routeId,
        routeName: assignment.route.name,
        pickupRouteStopId: assignment.pickupRouteStopId,
        pickupStopName: assignment.pickupRouteStop.stop.name,
        feeAmount: Number(pricing.feeAmount),
        currency: pricing.currency,
        effectiveFrom: pricing.effectiveFrom,
        effectiveTo: pricing.effectiveTo,
      });
    }

    return charges;
  }

  /** Convenience for the common single-assignment case; returns null rather than throwing when there's no billable charge. */
  async resolvePrimaryChargeForStudent(
    tenantId: string,
    studentId: string,
    asOfDate?: Date,
  ): Promise<ResolvedTransportCharge | null> {
    const charges = await this.resolveChargesForStudent(tenantId, studentId, asOfDate);
    return charges[0] ?? null;
  }
}
