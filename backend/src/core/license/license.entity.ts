export class License {
  id: string
  tenantId: string
  key: string
  status: string
  maxStudents: number
  currentStudents: number
  features: string[]
  expiresAt: Date
  createdAt: Date
}
