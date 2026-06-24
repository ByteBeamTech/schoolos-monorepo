import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { CrmDashboardService } from '../services/crm-dashboard.service';

@Controller('crm/dashboard')
@UseGuards(JwtGuard, RolesGuard)
export class CrmDashboardController {
  constructor(private readonly service: CrmDashboardService) {}

  @Get('summary')
  @Roles('RECEPTIONIST', 'SCHOOL_OWNER','SCHOOL_ADMIN', 'PRINCIPAL')
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.service.getSummary(user, branchId);
  }
}
