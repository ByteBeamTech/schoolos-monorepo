import { randomUUID } from 'crypto'
import { z } from 'zod'
import { router, withPermission } from '../context/context'

export const billingRouter = router({
  invoices: router({
    list: withPermission('VIEW_INVOICES')
      .input(z.object({ studentId: z.string().uuid().optional(), status: z.string().optional(), page: z.number().default(1) }))
      .query(async () => ({ invoices: [], total: 0 })),

    get: withPermission('VIEW_INVOICES')
      .input(z.object({ invoiceId: z.string().uuid() }))
      .query(async () => null),

    create: withPermission('CREATE_INVOICE')
      .input(z.object({ studentId: z.string().uuid(), items: z.array(z.record(z.unknown())) }))
      .mutation(async () => ({ id: randomUUID() })),

    void: withPermission('VOID_INVOICE')
      .input(z.object({ invoiceId: z.string().uuid(), reason: z.string() }))
      .mutation(async () => ({ ok: true })),
  }),

  payments: router({
    list: withPermission('VIEW_PAYMENTS')
      .input(z.object({ invoiceId: z.string().uuid().optional() }))
      .query(async () => ({ payments: [] })),

    refund: withPermission('REFUND_PAYMENT')
      .input(z.object({ paymentId: z.string().uuid(), amount: z.number().positive(), reason: z.string() }))
      .mutation(async () => ({ refundId: randomUUID() })),
  }),

  discounts: router({
    approve: withPermission('APPROVE_DISCOUNT')
      .input(z.object({ discountId: z.string().uuid(), note: z.string() }))
      .mutation(async () => ({ ok: true })),
  }),
})
