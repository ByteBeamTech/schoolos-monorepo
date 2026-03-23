# migration-orchestrator

Manages Prisma schema migrations across all tenant databases.

## Problem
In multi-tenancy, running `prisma migrate deploy` once affects all tenants.
If a migration fails halfway through 300 schools, some are on v12 and some on v11.
This module prevents and recovers from that scenario.

## Strategy

1. strategies/canary     — Deploy to 1 tenant first, monitor for 30 mins
2. strategies/rolling    — Deploy to 10% of tenants every 15 mins
3. strategies/blue-green — Spin up new DB version, switch traffic atomically
4. strategies/emergency  — Immediate full deploy (break-glass only)

## Rollback

rollback/ stores the previous migration state per tenant.
If any tenant fails, rollback/ can restore it independently.

## Audit

Every migration run logs to audit/:
  - Which tenants received the migration
  - Start time, end time, duration
  - Success / failure per tenant
  - Rollback events
