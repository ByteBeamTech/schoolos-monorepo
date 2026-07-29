import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { TransportPricingService } from '../services/transport-pricing.service';

// Read-only resolution endpoint — Accountant included alongside the usual
// Fleet roles since this is the Finance-facing side of Transport (Ch.9),
// unlike the write-heavy Fleet/Route/Trip endpoints elsewhere in this module.
const CHARGE_VIEW_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TRANSPORT_MANAGER', 'ACCOUNTANT'];

@Controller('transport/pricing')
@UseGuards(JwtGuard, RolesGuard)
export class TransportPricingController {
  constructor(private readonly service: TransportPricingService) {}

  /** ADR-005: the resolution contract Finance is meant to eventually consume instead of legacy transport internals (see the service's doc comment for migration status). */
  @Get('students/:studentId/charges')
  @Roles(...CHARGE_VIEW_ROLES)
  resolveChargesForStudent(@CurrentUser() user: AuthenticatedUser, @Param('studentId') studentId: string) {
    return this.service.resolveChargesForStudent(user.tenantId, studentId);
  }
}
