import { z } from 'zod';

export const CreateLeadSchema = z.object({
  parentName: z.string().min(2, "Name is too short"),
  parentPhone: z.string().regex(/^[0-9]{10}$/, "Invalid 10-digit Indian mobile number"),
  parentEmail: z.string().email().optional().nullable(),
  studentName: z.string().optional().nullable(),
  gradeInterestedIn: z.string().min(1, "Grade is required"),
  expectedEnrollYear: z.number().int(),
  
  // Marketing & Referral Logic
  sourceId: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  referredById: z.string().optional().nullable(),
  
  // Staff Ward Logic
  isStaffWard: z.boolean().default(false),
  staffParentId: z.string().optional().nullable()
});

export type CreateLeadDTO = z.infer<typeof CreateLeadSchema>;
