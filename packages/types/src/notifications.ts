export type NotificationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH'
export type DeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED'

export interface NotificationDeliveryLog {
  id: string
  tenantId: string
  recipientId: string
  channel: NotificationChannel
  templateId: string
  status: DeliveryStatus
  providerMessageId: string | null
  failureReason: string | null
  attemptedAt: Date
  deliveredAt: Date | null
}

export interface RecipientPreference {
  tenantId: string
  recipientId: string
  channel: NotificationChannel
  optedOut: boolean
  optedOutAt: Date | null
  reason: string | null
}
