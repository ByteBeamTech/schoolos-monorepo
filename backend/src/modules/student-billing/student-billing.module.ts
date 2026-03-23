import { Module } from '@nestjs/common';
import { ComplianceModule } from '../../core/compliance/compliance.module';

import { FeePlansService }     from './plans/services/fee-plans.service';
import { FeePlansController }  from './plans/controllers/fee-plans.controller';
import { InvoiceService }      from './invoice/services/invoice.service';
import { InvoiceController }   from './invoice/controllers/invoice.controller';
import { PaymentService }      from './payment/services/payment.service';
import { PaymentController }   from './payment/controllers/payment.controller';
import { DiscountService }     from './discounts/services/discount.service';
import { DiscountController }  from './discounts/controllers/discount.controller';

@Module({
  imports: [ComplianceModule],
  providers: [FeePlansService, InvoiceService, PaymentService, DiscountService],
  controllers: [FeePlansController, InvoiceController, PaymentController, DiscountController],
  exports: [FeePlansService, InvoiceService, PaymentService],
})
export class StudentBillingModule {}
