import { Module } from '@nestjs/common';
import { ComplianceModule } from '../../core/compliance/compliance.module';
import { AnalyticsModule }
from './analytics/analytics.module';
import { FeePlansService }     from './plans/services/fee-plans.service';
import { FeePlansController }  from './plans/controllers/fee-plans.controller';
import { InvoiceService }      from './invoice/services/invoice.service';
import { InvoiceController }   from './invoice/controllers/invoice.controller';
import { PaymentService }      from './payment/services/payment.service';
import { PaymentController }   from './payment/controllers/payment.controller';
import { DiscountService }     from './discounts/services/discount.service';
import { DiscountController }  from './discounts/controllers/discount.controller';

import { ReconciliationService }    from './reconciliation/reconciliation.service';
import { ReceiptService }           from './receipt/receipt.service';
import { RefundService }            from './refund/refund.service';
import { LateFeeService }           from './late-fee/late-fee.service';
import { StandardDiscountService }  from './discounts/standard-discount.service';
import { GatewayFactory }           from './payment/gateway/gateway.factory';
import { StudentBillingAccessService } from './access/student-billing-access.service';
import { StorageModule }            from '../../infra/storage/storage.module';


@Module({
  imports: [ComplianceModule, StorageModule, AnalyticsModule,],
  providers: [FeePlansService, InvoiceService, PaymentService, DiscountService, ReconciliationService, ReceiptService, RefundService,
    LateFeeService, StandardDiscountService, GatewayFactory, StudentBillingAccessService],
  controllers: [FeePlansController, InvoiceController, PaymentController, DiscountController],
  exports: [FeePlansService, InvoiceService, PaymentService],
})
export class StudentBillingModule {}
