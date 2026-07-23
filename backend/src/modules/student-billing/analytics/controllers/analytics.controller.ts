import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';

import { AnalyticsService } from '../services/analytics.service';
import { StudentBillingAccessService } from '../../access/student-billing-access.service';

@Controller('billing/analytics')
@UseGuards(JwtGuard, RolesGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly access: StudentBillingAccessService,
  ) {}

  @Get()
  @Roles(
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'ACCOUNTANT',
  )
  getOverview(
    @CurrentUser() user: any,
  ) {
    return this.analytics.getOverview(
      user.tenantId,
      this.access.resolveAuthorizedBranchIds(user),
    );
  }
}
