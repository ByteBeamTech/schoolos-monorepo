import { Module }               from '@nestjs/common';
import { OnboardingService }    from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { PrismaModule }         from '../../infra/database/prisma.module';
import { RolesModule }          from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, RolesModule],
  providers:   [OnboardingService],
  controllers: [OnboardingController],
  exports:     [OnboardingService],
})
export class OnboardingModule {}
