import { Module } from '@nestjs/common';
import { PrismaModule } from '@infra/database/prisma.module';

import { SaasGatewayFactory }    from './gateway/saas-gateway.factory';
import { SaasPaymentService }    from './services/saas-payment.service';
import { SaasPaymentController } from './controllers/saas-payment.controller';
import { SaasWebhookController } from './controllers/saas-webhook.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SaasPaymentController, SaasWebhookController],
  providers: [SaasGatewayFactory, SaasPaymentService],
  exports: [SaasGatewayFactory, SaasPaymentService],
})
export class SaasPaymentModule {}
