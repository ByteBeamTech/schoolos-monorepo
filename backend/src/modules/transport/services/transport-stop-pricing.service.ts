import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { buildReadScope } from '@modules/crm/services/branch-scope.util';
import { TransportSettingsService } from './transport-settings.service';
import { CreateStopPricingDto, EndStopPricingDto } from '../dto/transport-stop-pricing.dto';

/**
 * SAD Ch.4/Ch.15 ADR-002: Pricing belongs to RouteStop, not Route or Stop —
 * the same physical Stop may price differently on different Routes.
 * ADR-006: effective dating for historical accuracy and future revisions.
 *
 * "Pricing overlap prevention" (SAD Ch.8 API validation): creating a new
 * price closes out the previous open-ended one at the new row's
 * effectiveFrom, rather than allowing two open-ended active prices to
 * coexist for the same RouteStop.
 */
@Injectable()
export class TransportStopPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: TransportSettingsService,
  ) {}

  /** Loads the RouteStop's parent Route within the caller's tenant/branch scope, or throws. */
  private async loadRouteStop(user: AuthenticatedUser, routeStopId: string) {
    // tenantId is filtered here unconditionally — this is not optional. A
    // findUnique-by-id-alone would let any authenticated caller load any
    // tenant's RouteStop by ID; branch scoping alone doesn't cover
    // tenant-wide roles (SCHOOL_ADMIN/SCHOOL_OWNER/SUPER_ADMIN), who have no
    // branchId restriction but must still never cross tenant boundaries.
    const routeStop = await this.prisma.routeStop.findFirst({
      where: { id: routeStopId, tenantId: user.tenantId },
      include: { route: true },
    });
    if (!routeStop) throw new NotFoundException('RouteStop not found');

    const scope = buildReadScope(user);
    if (scope.where.branchId && routeStop.route.branchId !== scope.where.branchId) {
      throw new NotFoundException('RouteStop not found');
    }
    return routeStop;
  }

  async list(user: AuthenticatedUser, routeStopId: string) {
    await this.loadRouteStop(user, routeStopId);
    return this.prisma.transportStopPricing.findMany({
      where: { routeStopId },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async create(user: AuthenticatedUser, routeStopId: string, dto: CreateStopPricingDto) {
    const routeStop = await this.loadRouteStop(user, routeStopId);
    const tenantId = routeStop.tenantId;
    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();

    const currentOpenEnded = await this.prisma.transportStopPricing.findFirst({
      where: { routeStopId, isActive: true, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });

    // AF-002 Fee Revision Policy (Phase 0.5) — a revision (there's already an
    // active price) must respect the branch's minimum-notice window. The
    // very first price for a stop isn't a "revision", so it's exempt.
    if (currentOpenEnded && routeStop.route.branchId) {
      const branchSettings = await this.settings.getOrCreate(
        tenantId,
        routeStop.route.branchId,
        this.toSettingsCaller(user),
      );
      const minNoticeMs = branchSettings.feeRevisionMinNoticeDays * 24 * 60 * 60 * 1000;
      if (effectiveFrom.getTime() < Date.now() + minNoticeMs) {
        throw new BadRequestException(
          `This branch's Fee Revision Policy requires at least ${branchSettings.feeRevisionMinNoticeDays} ` +
            `day(s) notice before a price change takes effect.`,
        );
      }
    }

    if (currentOpenEnded && currentOpenEnded.effectiveFrom >= effectiveFrom) {
      throw new BadRequestException('New pricing must take effect after the currently active pricing started');
    }

    const results = await this.prisma.$transaction([
      ...(currentOpenEnded
        ? [
            this.prisma.transportStopPricing.update({
              where: { id: currentOpenEnded.id },
              data: { effectiveTo: effectiveFrom },
            }),
          ]
        : []),
      this.prisma.transportStopPricing.create({
        data: {
          tenantId,
          routeStopId,
          feeAmount: dto.feeAmount,
          currency: dto.currency,
          effectiveFrom,
        },
      }),
    ]);
    // create() is always the last op in the array, whether or not the
    // conditional update ran before it.
    const created = results[results.length - 1];

    await this.audit.logCreate({
      tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'TransportStopPricing',
      entityId: created.id,
      after: { routeStopId, feeAmount: dto.feeAmount, effectiveFrom },
    });

    return created;
  }

  /** Ends a still-open pricing row without creating a replacement. */
  async end(user: AuthenticatedUser, routeStopId: string, pricingId: string, dto: EndStopPricingDto) {
    const routeStop = await this.loadRouteStop(user, routeStopId);
    const before = await this.prisma.transportStopPricing.findFirst({
      where: { id: pricingId, routeStopId },
    });
    if (!before) throw new NotFoundException('Pricing not found');
    if (before.effectiveTo) {
      throw new BadRequestException('This pricing has already ended');
    }

    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : new Date();
    if (effectiveTo <= before.effectiveFrom) {
      throw new BadRequestException('effectiveTo must be after effectiveFrom');
    }

    const after = await this.prisma.transportStopPricing.update({
      where: { id: pricingId },
      data: { effectiveTo },
    });

    await this.audit.logUpdate({
      tenantId: routeStop.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'TransportStopPricing',
      entityId: pricingId,
      before: { effectiveTo: before.effectiveTo },
      after: { effectiveTo: after.effectiveTo },
    });

    return after;
  }

  /**
   * SAD Ch.9 Fee Preview: "Before pricing changes: Students affected,
   * Revenue impact, Effective date, Validation errors." Read-only — mirrors
   * create()'s validation checks but collects problems into
   * `validationErrors` instead of throwing, since a preview's whole point is
   * to show the caller what *would* go wrong before they commit.
   */
  async previewPriceChange(user: AuthenticatedUser, routeStopId: string, dto: CreateStopPricingDto) {
    const routeStop = await this.loadRouteStop(user, routeStopId);
    const tenantId = routeStop.tenantId;
    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    const validationErrors: string[] = [];

    const currentOpenEnded = await this.prisma.transportStopPricing.findFirst({
      where: { routeStopId, isActive: true, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (currentOpenEnded && routeStop.route.branchId) {
      const branchSettings = await this.settings.getOrCreate(
        tenantId,
        routeStop.route.branchId,
        this.toSettingsCaller(user),
      );
      const minNoticeMs = branchSettings.feeRevisionMinNoticeDays * 24 * 60 * 60 * 1000;
      if (effectiveFrom.getTime() < Date.now() + minNoticeMs) {
        validationErrors.push(
          `This branch's Fee Revision Policy requires at least ${branchSettings.feeRevisionMinNoticeDays} ` +
            `day(s) notice before a price change takes effect.`,
        );
      }
    }

    if (currentOpenEnded && currentOpenEnded.effectiveFrom >= effectiveFrom) {
      validationErrors.push('New pricing must take effect after the currently active pricing started');
    }

    const affectedStudentCount = await this.prisma.studentTransportAssignment.count({
      where: { pickupRouteStopId: routeStopId, status: 'ACTIVE' },
    });

    const currentFee = currentOpenEnded ? Number(currentOpenEnded.feeAmount) : null;
    const newFee = dto.feeAmount;
    const currentRevenue = (currentFee ?? 0) * affectedStudentCount;
    const projectedRevenue = newFee * affectedStudentCount;

    return {
      routeStopId,
      affectedStudentCount,
      currentFee,
      newFee,
      currentRevenue,
      projectedRevenue,
      revenueDelta: projectedRevenue - currentRevenue,
      effectiveFrom,
      validationErrors,
    };
  }

  /** TransportSettingsService (Phase 0.5) expects branchIds as a required array (from core/auth/guards/jwt.strategy.ts's AuthenticatedUser); this file's AuthenticatedUser (interfaces/ variant, matching the rest of Phase 1-6) has it optional. Normalize rather than assume — see the "two AuthenticatedUser interfaces" note on the Phase 1 commit. */
  private toSettingsCaller(user: AuthenticatedUser) {
    return { id: user.id, role: user.role, branchId: user.branchId, branchIds: user.branchIds ?? [] };
  }
}
