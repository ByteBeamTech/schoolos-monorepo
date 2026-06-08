export class BillingAnalyticsDto {
  totalInvoiced!: number;
  totalCollected!: number;
  outstanding!: number;
  collectionRate!: number;

  lateFeeApplied!: number;
  lateFeeCollected!: number;
  lateFeeWaived!: number;
  lateFeeOutstanding!: number;

  discountsGiven!: number;
  refundsIssued!: number;

  overdueInvoices!: number;
}
