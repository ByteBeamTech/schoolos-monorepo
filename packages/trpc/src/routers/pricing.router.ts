import { z } from 'zod';
import { router, superadminProcedure } from '../context/context';

export const pricingRouter = router({
  // Frontend expects an ARRAY, so we return an array directly
  listPlans: superadminProcedure
    .input(z.any().optional()) 
    .query(async ({ ctx }: any) => {
      const plans = await (ctx.prisma as any).pricingPlan.findMany({
        where: { isActive: true },
        orderBy: [{ tier: 'asc' }],
      });
      return plans; // ✅ Seedha array return karo
    }),

  createPlan: superadminProcedure
    .input(z.any())
    .mutation(async ({ ctx, input }: any) => {
      return (ctx.prisma as any).pricingPlan.create({ data: input });
    }),

  calculate: superadminProcedure
    .input(z.object({
        planId: z.string(),
        studentCount: z.number(),
        customPerStudentRate: z.number().optional(),
        customBaseFee: z.number().optional()
    }))
    .query(async ({ ctx, input }: any) => {
      const plan = await (ctx.prisma as any).pricingPlan.findUniqueOrThrow({
        where: { id: input.planId },
      });

      const baseFee = input.customBaseFee ?? Number(plan.baseFee ?? 0);
      const perStudentRate = input.customPerStudentRate ?? Number(plan.perStudentRate ?? 0);
      const total = baseFee + (input.studentCount * perStudentRate);

      return {
        planId: plan.id,
        planName: plan.name,
        total,
        currency: (plan as any).currency || 'INR', 
        breakdown: [
          { label: 'Base fee', amount: baseFee },
          { label: `Student charges`, amount: input.studentCount * perStudentRate },
        ],
      };
    }),
});
