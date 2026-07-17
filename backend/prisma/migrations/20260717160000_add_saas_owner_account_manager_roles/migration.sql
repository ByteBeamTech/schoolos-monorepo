-- SA-1: add SAAS_OWNER and ACCOUNT_MANAGER to UserRole.
--
-- These roles were already referenced in @Roles() decorators
-- (feature-flags.controller.ts) before this migration -- no real User
-- row could ever hold them since they didn't exist in the enum,
-- confirmed via schema-wide grep during the SA-1 Phase 1 audit. This
-- migration only adds the two missing enum values; it does not assign
-- them to any existing user, does not change any other column or
-- constraint, and is purely additive (safe, non-breaking for all
-- existing rows/queries using the pre-existing UserRole values).
--
-- Postgres requires each ADD VALUE in its own statement outside the
-- transaction that first uses it -- Prisma's migration runner handles
-- this correctly by running each statement separately.

ALTER TYPE "UserRole" ADD VALUE 'SAAS_OWNER';
ALTER TYPE "UserRole" ADD VALUE 'ACCOUNT_MANAGER';

