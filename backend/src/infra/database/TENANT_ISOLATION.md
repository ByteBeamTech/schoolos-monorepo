# Tenant Isolation Pattern

## Two correct patterns — both safe:

### Pattern A: Explicit tenantId in every query (current approach in most services)
```typescript
return this.prisma.student.findMany({ where: { tenantId, ...otherFilters } });
```

### Pattern B: forTenant() middleware (auto-injects tenantId)
```typescript
const db = this.prisma.forTenant(tenantId);
return db.student.findMany({ where: { ...otherFilters } }); // tenantId auto-added
```

## Rule for new services:
All NEW services must use Pattern B (forTenant) — it's safer because
a developer cannot accidentally forget to add tenantId.

## Migration status:
- ✅ PrismaService.forTenant() — implemented
- ⚠️  Existing services — use Pattern A (explicit tenantId, correct but manual)
- ✅  New services (library, transport, communication, accounting, admissions)
      — use Pattern A for now, migrate to Pattern B in next refactor pass

## Critical: Models WITHOUT tenantId (intentionally cross-tenant):
- Session, OAuthAccount — user-scoped not tenant-scoped
- AuditLog — use prisma directly (needs cross-tenant reads)
- PricingPlan — global, not per-tenant
