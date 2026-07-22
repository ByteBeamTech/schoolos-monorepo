import { Module }               from '@nestjs/common';
import { OnboardingService }    from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { PrismaModule }         from '../../infra/database/prisma.module';
import { RolesModule }          from '../../core/roles/roles.module';
import { StudentBillingModule } from '../student-billing/student-billing.module';

@Module({
  // StudentBillingModule exports DiscountCategoryProvisioningService, which
  // provisions a new branch's default finance configuration inside the
  // onboarding transaction. No cycle: student-billing imports neither module.
  imports:     [PrismaModule, RolesModule, StudentBillingModule],
  providers:   [OnboardingService],
  controllers: [OnboardingController],
  exports:     [OnboardingService],
})
export class OnboardingModule {}
