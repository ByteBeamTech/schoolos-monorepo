import { Module } from '@nestjs/common';
import { ComplianceModule } from '@core/compliance/compliance.module';

import { LeadController } from './controllers/lead.controller';
import { FollowUpController } from './controllers/follow-up.controller';
import { InteractionController } from './controllers/interaction.controller';
import { CrmDashboardController } from './controllers/crm-dashboard.controller';

import { LeadService } from './services/lead.service';
import { FollowUpService } from './services/follow-up.service';
import { InteractionService } from './services/interaction.service';
import { CrmDashboardService } from './services/crm-dashboard.service';

@Module({
  imports: [ComplianceModule],
  controllers: [
    LeadController,
    FollowUpController,
    InteractionController,
    CrmDashboardController,
  ],
  providers: [
    LeadService,
    FollowUpService,
    InteractionService,
    CrmDashboardService,
  ],
  exports: [LeadService, FollowUpService, InteractionService],
})
export class CrmModule {}
