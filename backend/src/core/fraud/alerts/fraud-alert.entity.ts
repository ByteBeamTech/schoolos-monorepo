export class FraudAlert {
  id: string
  tenantId: string
  ruleId: string
  severity: string
  description: string
  evidence: Record<string, unknown>
  status: string
  assignedTo: string | null
  resolvedAt: Date | null
  resolvedNote: string | null
  detectedAt: Date
}
