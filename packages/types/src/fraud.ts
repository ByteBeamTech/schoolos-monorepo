export type FraudSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type FraudAlertStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE'

export interface FraudAlert {
  id: string
  tenantId: string
  ruleId: string
  severity: FraudSeverity
  description: string
  evidence: Record<string, unknown>
  status: FraudAlertStatus
  assignedTo: string | null
  resolvedAt: Date | null
  resolvedNote: string | null
  detectedAt: Date
}

export interface FraudRule {
  id: string
  name: string
  description: string
  trigger: string
  threshold: number
  windowMinutes: number
  severity: FraudSeverity
  enabled: boolean
  tenantScoped: boolean
}
