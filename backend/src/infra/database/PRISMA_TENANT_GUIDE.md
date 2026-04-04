# PrismaService.forTenant() — Usage Guide

import { PrismaService } from '@infra/database/prisma.service';

The `forTenant(tenantId)` method auto-injects tenantId into every query:
- findMany, findFirst, findFirstOrThrow, count

## ❌ WRONG — Vulnerable to cross-tenant leak:
```typescript
const students = await this.prisma.student.findMany({
  where: { tenantId }, // Must remember this manually
});
```

## ✅ RIGHT — Safe, tenantId auto-injected:
```typescript
const db       = this.prisma.forTenant(tenantId);
const students = await db.student.findMany(); // tenantId auto-added
```

## Migration plan:
1. New services: ALWAYS use this.prisma.forTenant(tenantId)
2. Existing services: migrate during next refactor pass
3. Core modules (audit, sessions): keep using this.prisma directly
   (they intentionally query across tenants)
