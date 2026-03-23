import { initTRPC, TRPCError } from '@trpc/server'
import { randomUUID } from 'crypto'
import type { AuthUser } from '@schoolos/auth'
import type { Permission } from '@schoolos/access'
import { canUser } from '@schoolos/access'

export interface Context {
  user: AuthUser | null
  tenantId: string | null
  requestId: string
}

export async function createContext(): Promise<Context> {
  return { user: null, tenantId: null, requestId: randomUUID() }
}

export const t = initTRPC.context<Context>().create()

export const router    = t.router
export const procedure = t.procedure

export const authedProcedure = procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, user: ctx.user } })
})

export const withPermission = (permission: Permission) =>
  authedProcedure.use(({ ctx, next }) => {
    if (!canUser(ctx.user!, permission, ctx.tenantId ?? undefined)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `Missing permission: ${permission}` })
    }
    return next({ ctx })
  })

export const superadminProcedure = procedure.use(({ ctx, next }) => {
  if (!ctx.user?.isSuperadmin) throw new TRPCError({ code: 'FORBIDDEN' })
  return next({ ctx: { ...ctx, user: ctx.user } })
})
