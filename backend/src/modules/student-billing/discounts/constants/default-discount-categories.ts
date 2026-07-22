// Default DiscountCategory set provisioned for every branch.
//
// DiscountCategory is branch-managed CONFIGURATION (master data), not
// transactional data: rows are created when a branch is created (or backfilled
// for branches that predate this), never as a side effect of creating a
// discount. DiscountService.create() resolves against these rows and rejects
// if the requested code is absent -- it must never create one.
//
// `code` values are the contract with the API surface: they must stay in sync
// with the DiscountCategory enum in ../../dto/billing.dto.ts, which is what
// CreateDiscountDto validates the client's `category` field against. A code
// present in that enum but missing here would validate at the DTO layer and
// then fail resolution at the service layer -- so the two lists must match.
// (discount-category-provisioning.service.spec.ts asserts exactly this.)
//
// `name` is the human-readable label shown in UI. Schools may rename these
// per branch once category admin CRUD lands (FEE-2); these are only the
// starting defaults, which is why they live in a data file rather than
// inline in the provisioning service.

export interface DiscountCategoryTemplate {
  /** Stable identifier; matches the DiscountCategory enum in billing.dto.ts. */
  code: string;
  /** Human-readable default label; branch-editable later. */
  name: string;
}

export const DEFAULT_DISCOUNT_CATEGORIES: readonly DiscountCategoryTemplate[] = [
  { code: 'SIBLING',            name: 'Sibling Discount'   },
  { code: 'MERIT',              name: 'Merit Scholarship'  },
  { code: 'STAFF_CHILD',        name: 'Staff Child'        },
  { code: 'FINANCIAL_HARDSHIP', name: 'Financial Hardship' },
  { code: 'SCHOLARSHIP',        name: 'Scholarship'        },
  { code: 'CUSTOM',             name: 'Custom'             },
] as const;
