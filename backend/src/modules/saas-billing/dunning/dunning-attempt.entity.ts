export class DunningAttempt {
  id: string
  tenantId: string
  invoiceId: string
  stage: string
  attemptNumber: number
  gatewayError: string | null
  scheduledAt: Date
  executedAt: Date | null
  resolvedAt: Date | null
}
