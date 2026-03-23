import { randomUUID } from 'crypto'
import { z } from 'zod'
import { router, withPermission, authedProcedure } from '../context/context'

export const studentsRouter = router({
  list: withPermission('VIEW_STUDENTS')
    .input(z.object({ page: z.number().default(1), limit: z.number().max(100).default(20), search: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return { students: [], total: 0, page: input.page, limit: input.limit }
    }),

  get: withPermission('VIEW_STUDENTS')
    .input(z.object({ studentId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return null
    }),

  create: withPermission('CREATE_STUDENT')
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      classId: z.string().uuid(),
      dateOfBirth: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      return { id: randomUUID(), ...input }
    }),

  update: withPermission('EDIT_STUDENT')
    .input(z.object({ studentId: z.string().uuid(), data: z.record(z.unknown()) }))
    .mutation(async ({ input }) => ({ ok: true })),

  deactivate: withPermission('DELETE_STUDENT')
    .input(z.object({ studentId: z.string().uuid(), reason: z.string() }))
    .mutation(async ({ input }) => ({ ok: true })),
})
