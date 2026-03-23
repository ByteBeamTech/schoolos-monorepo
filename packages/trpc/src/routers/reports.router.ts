import { randomUUID } from 'crypto'
import { z } from 'zod'
import { router, withPermission } from '../context/context'

export const reportsRouter = router({
  revenue: withPermission('VIEW_REPORTS')
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async () => ({ total: 0, breakdown: [] })),

  dues: router({
    summary: withPermission('VIEW_REPORTS').query(async () => ({ total: 0, byBucket: [] })),
    aging: withPermission('VIEW_REPORTS').query(async () => ([])),
    export: withPermission('EXPORT_REPORTS')
      .input(z.object({ format: z.enum(['XLSX', 'PDF']) }))
      .mutation(async () => ({ downloadUrl: '' })),
  }),
})
