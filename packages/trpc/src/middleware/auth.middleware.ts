import { TRPCError } from '@trpc/server'
import { t } from '../context/context'

export const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  return next({ ctx: { ...ctx, user: ctx.user } })
})

export const enforceSuperadmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user?.isSuperadmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Superadmin only' })
  return next({ ctx: { ...ctx, user: ctx.user } })
})

export const enforceTenant = t.middleware(({ ctx, next }) => {
  if (!ctx.user || !ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' })
  if (!ctx.user.isSuperadmin && ctx.user.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Cross-tenant access denied' })
  }
  return next({ ctx })
})
