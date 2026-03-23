import { randomUUID } from 'crypto'
import { z } from 'zod'
import { router, authedProcedure } from '../context/context'

export const notificationsRouter = router({
  deliveryLog: authedProcedure
    .input(z.object({ recipientId: z.string().uuid().optional(), channel: z.string().optional() }))
    .query(async () => ({ logs: [] })),

  resend: authedProcedure
    .input(z.object({ logId: z.string().uuid() }))
    .mutation(async () => ({ ok: true })),
})
