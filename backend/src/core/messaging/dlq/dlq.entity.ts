export class DlqEvent {
  id: string
  tenantId: string
  eventType: string
  queueName: string
  originalPayload: Record<string, unknown>
  failureReason: string
  retryCount: number
  status: 'FAILED' | 'REPLAYED' | 'DISCARDED'
  failedAt: Date
  replayedAt: Date | null
  discardedAt: Date | null
}
