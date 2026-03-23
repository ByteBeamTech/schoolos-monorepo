export * from './user'
export * from './tenant'
export * from './billing'
export * from './events'
export * from './notifications'
export * from './fraud'
export * from './license'

export const ADMISSION_STATUSES = [
  'INQUIRY', 'APPLIED', 'SCREENING', 'WAITLISTED',
  'ENROLLED', 'REJECTED', 'WITHDRAWN',
] as const
export type AdmissionStatus = (typeof ADMISSION_STATUSES)[number]

export const ADMISSION_SOURCES = [
  'GOOGLE', 'REFERRAL', 'WALK_IN', 'SOCIAL_MEDIA', 'DIRECT', 'EVENT', 'OTHER',
] as const
export type AdmissionSource = (typeof ADMISSION_SOURCES)[number]
