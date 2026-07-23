import { Module } from '@nestjs/common';

import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { StudentBillingAccessService } from '../access/student-billing-access.service';

@Module({
  controllers: [
    AnalyticsController,
  ],
  providers: [
    AnalyticsService,
    // AnalyticsModule is a standalone Nest module (imported into
    // StudentBillingModule), so it needs its own registration of this
    // service rather than reaching into the parent module's providers.
    // Safe to duplicate: StudentBillingAccessService is stateless and
    // depends only on PrismaService, which is @Global().
    StudentBillingAccessService,
  ],
  exports: [
    AnalyticsService,
  ],
})
export class AnalyticsModule {}
