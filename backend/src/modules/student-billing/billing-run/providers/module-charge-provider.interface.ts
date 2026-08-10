// backend/src/modules/student-billing/billing-run/providers/module-charge-provider.interface.ts
//
// Phase 4 (frozen). Transport implements this now; Hostel/Activities are
// out of this phase's scope -- this contract is what they'll implement
// later, not implemented for them here.

import { Prisma } from '@prisma/client';

export interface ModuleCharge {
  feeHeadId: string;
  amount: number;
  description: string;
}

export interface ModuleChargeProvider {
  /**
   * Returns [] if the student has no charge from this module this
   * period -- never throws for "nothing to charge," only for a genuine
   * failure to determine the charge (e.g. the module's own required
   * FeeHead is missing for this tenant/branch).
   */
  getCharges(
    tenantId: string,
    branchId: string,
    studentId: string,
    periodMonth: number,
    periodYear: number,
    tx: Prisma.TransactionClient,
  ): Promise<ModuleCharge[]>;
}

export const MODULE_CHARGE_PROVIDERS = 'MODULE_CHARGE_PROVIDERS';
