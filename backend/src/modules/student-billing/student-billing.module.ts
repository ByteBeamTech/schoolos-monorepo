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
import { LateFeeController }        from './late-fee/late-fee.controller';
import { StandardDiscountService }  from './discounts/standard-discount.service';
import { GatewayFactory }           from './payment/gateway/gateway.factory';
import { StudentBillingAccessService } from './access/student-billing-access.service';
import { DiscountCategoryProvisioningService } from './discounts/services/discount-category-provisioning.service';
import { StorageModule }            from '../../infra/storage/storage.module';
import { LedgerService }            from './ledger/services/ledger.service';
import { FeeHeadService }           from './fee-heads/services/fee-head.service';
import { FeeHeadController }        from './fee-heads/controllers/fee-head.controller';
import { PaymentAllocationService } from './allocation/services/payment-allocation.service';
import { RulesService }             from './late-fee/rules/rules.service';
import { RulesController }          from './late-fee/rules/rules.controller';
import { BillingRuleService }       from './billing-rules/services/billing-rule.service';
import { FeePlanAssignmentService } from './plans/services/fee-plan-assignment.service';
import { BillingRuleController }    from './billing-rules/controllers/billing-rule.controller';
import { InvoiceBuilderService }    from './billing-run/services/invoice-builder.service';
import { BillingRunService }        from './billing-run/services/billing-run.service';
import { BillingRunController }     from './billing-run/controllers/billing-run.controller';
import { TransportChargeProvider }  from './billing-run/providers/transport-charge.provider';
import { MODULE_CHARGE_PROVIDERS }  from './billing-run/providers/module-charge-provider.interface';


@Module({
  imports: [ComplianceModule, StorageModule, AnalyticsModule,],
  providers: [FeePlansService, InvoiceService, PaymentService, DiscountService, ReconciliationService, ReceiptService, RefundService,
    LateFeeService, StandardDiscountService, GatewayFactory, StudentBillingAccessService, DiscountCategoryProvisioningService, LedgerService, FeeHeadService, PaymentAllocationService, RulesService, BillingRuleService, FeePlanAssignmentService,
    InvoiceBuilderService, BillingRunService, TransportChargeProvider,
    // Phase 4: Transport only, this phase's scope. Hostel/Activities
    // implement ModuleChargeProvider and are added to this same array
    // in their own future phase -- InvoiceBuilderService iterates
    // whatever is registered here, unaware of which specific modules
    // exist.
    { provide: MODULE_CHARGE_PROVIDERS, useFactory: (transport: TransportChargeProvider) => [transport], inject: [TransportChargeProvider] },
  ],
  controllers: [FeePlansController, InvoiceController, PaymentController, DiscountController, LateFeeController, FeeHeadController, RulesController, BillingRuleController, BillingRunController],
  // DiscountCategoryProvisioningService is exported so the branch-creation
  // paths (OnboardingService, SchoolManagementService) can provision a new
  // branch's default categories inside their own transaction, without
  // reimplementing the insert.
  exports: [FeePlansService, InvoiceService, PaymentService, DiscountCategoryProvisioningService],
})
export class StudentBillingModule {}
