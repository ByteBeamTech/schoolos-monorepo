import { randomUUID } from 'crypto'
import { router } from '../context/context'
import { studentsRouter }      from './students.router'
import { billingRouter }       from './billing.router'
import { notificationsRouter } from './notifications.router'
import { reportsRouter }       from './reports.router'
import { superadminRouter }    from './superadmin.router'
// 1. PEHLE IMPORT KARO:
import { pricingRouter }       from './pricing.router'

export const appRouter = router({
  students:      studentsRouter,
  billing:       billingRouter,
  notifications: notificationsRouter,
  reports:       reportsRouter,
  superadmin:    superadminRouter,
  // 2. PHIR REGISTER KARO:
  pricing:       pricingRouter, 
})

export type AppRouter = typeof appRouter
