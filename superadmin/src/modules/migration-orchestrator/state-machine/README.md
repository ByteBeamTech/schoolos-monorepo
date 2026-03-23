# Migration State Machine

Tracks each tenant's migration state independently.
50 Indian schools can be at SUCCESS while 10 US schools are at FAILED.
Each tenant has its own state record.

## States

PENDING     → Migration queued, not started
RUNNING     → Migration executing on this tenant's DB
SUCCESS     → Migration complete, verified
FAILED      → Migration errored, tenant still on old schema
ROLLBACK    → Rollback in progress
ROLLED_BACK → Tenant restored to previous schema version
SKIPPED     → Tenant excluded from this migration (e.g. trial accounts)

## Transitions

PENDING     → RUNNING     (orchestrator picks up job)
RUNNING     → SUCCESS     (migration applied cleanly)
RUNNING     → FAILED      (error during migration)
FAILED      → ROLLBACK    (admin triggers rollback)
FAILED      → RUNNING     (admin retries)
ROLLBACK    → ROLLED_BACK (rollback complete)
ROLLBACK    → FAILED      (rollback also failed — critical alert)

## Per-tenant tracking

Each row in migration_state table:
  tenant_id
  migration_version
  state (enum above)
  started_at
  completed_at
  error_message
  rollback_version
  attempts (max 3 before auto-rollback)
