import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { TransportStopPricingService } from '../services/transport-stop-pricing.service';
import { CreateStopPricingDto, EndStopPricingDto } from '../dto/transport-stop-pricing.dto';

const FLEET_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TRANSPORT_MANAGER'];

@Controller('transport/routes/:routeId/stops/:routeStopId/pricing')
@UseGuards(JwtGuard, RolesGuard)
export class TransportStopPricingController {
  constructor(private readonly service: TransportStopPricingService) {}

  @Get()
  @Roles(...FLEET_ROLES)
  list(@CurrentUser() user: AuthenticatedUser, @Param('routeStopId') routeStopId: string) {
    return this.service.list(user, routeStopId);
  }

  @Post()
  @Roles(...FLEET_ROLES)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('routeStopId') routeStopId: string,
    @Body() dto: CreateStopPricingDto,
  ) {
    return this.service.create(user, routeStopId, dto);
  }

  @Patch(':pricingId/end')
  @Roles(...FLEET_ROLES)
  end(
    @CurrentUser() user: AuthenticatedUser,
    @Param('routeStopId') routeStopId: string,
    @Param('pricingId') pricingId: string,
    @Body() dto: EndStopPricingDto,
  ) {
    return this.service.end(user, routeStopId, pricingId, dto);
  }
}
