# SchoolOS — Phase 1 & Phase 2 Manual Steps

These changes require developer judgment before applying. Each section explains
what to do, why it cannot be automated, and the exact code to add.

---

## FIX 1 — Four unguarded controllers (CRITICAL before enabling global JwtGuard)

### 1a. Delete the duplicate AdmissionTransitionsController

The file `backend/src/admissions/admission-transitions.controller.ts` is a
duplicate of `backend/src/modules/admissions/controllers/admission-transitions.controller.ts`.
Both register `@Controller("admissions")` — one will silently shadow the other.

```bash
# Confirm they are identical, then delete the root-level copy
diff backend/src/admissions/admission-transitions.controller.ts \
     backend/src/modules/admissions/controllers/admission-transitions.controller.ts
rm backend/src/admissions/admission-transitions.controller.ts
# Remove it from its module imports too
```

### 1b. Delete NotificationTestingController in production

`backend/src/modules/notifications/testing/notification-testing.controller.ts`
has no auth guard. Anyone can POST to `/notification-testing/otp` and trigger
real OTP emails.

**Option A (recommended):** Delete the file and remove it from its module.
**Option B:** Guard it with an environment check:

```typescript
import { Controller, Post, UseGuards } from "@nestjs/common";
import { JwtGuard }   from "../../core/auth/guards/jwt.guard";
import { RolesGuard } from "../../core/roles/roles.guard";
import { Roles }      from "../../core/roles/roles.decorator";

@Controller("notification-testing")
@UseGuards(JwtGuard, RolesGuard)
export class NotificationTestingController {
  // ...existing methods with @Roles("SUPERADMIN") added
}
```

### 1c. Add auth guard to LeadController

`backend/src/modules/crm/controllers/lead.controller.ts` — currently takes
tenantId from a raw, unauthenticated header. Any caller can read or create
CRM leads for any school.

```typescript
import { Controller, Post, Get, Body, Headers, UseGuards } from "@nestjs/common";
import { JwtGuard }          from "../../../core/auth/guards/jwt.guard";
import { RolesGuard }        from "../../../core/roles/roles.guard";
import { Roles }             from "../../../core/roles/roles.decorator";
import { CurrentUser }       from "../../../core/auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../../core/auth/guards/jwt.strategy";

@Controller("crm")
@UseGuards(JwtGuard, RolesGuard)
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Get("leads")
  @Roles("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT")
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.leadService.findAllLeads(user.tenantId);
  }

  @Post("leads")
  @Roles("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT")
  async create(@Body() body: any, @CurrentUser() user: AuthenticatedUser) {
    return this.leadService.createLead(body, user.tenantId, user.branchId);
  }
}
```

### 1d. Modules/admissions/admission-transitions.controller.ts

This controller has no `@UseGuards` at class level but calls `req.user.tenantId`
internally — meaning if JwtGuard is not global, `req.user` is undefined and
the `@Post(":id/transition")` endpoint throws a runtime error. Add the guard:

```typescript
import { UseGuards } from "@nestjs/common";
import { JwtGuard }   from "../../core/auth/guards/jwt.guard";
import { RolesGuard } from "../../core/roles/roles.guard";

@Controller("admissions")
@UseGuards(JwtGuard, RolesGuard)   // ← ADD
export class AdmissionTransitionsController {
```

---

## FIX 2 — app.module.ts: Register global APP_GUARDs

**Only apply this after FIX 1 is complete and committed.**

**File:** `backend/src/app.module.ts`

```typescript
// 1. Add to imports at the top of the file:
import { APP_GUARD } from "@nestjs/core";          // ← @nestjs/core, NOT @nestjs/common
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { JwtGuard }   from "./core/auth/guards/jwt.guard";
import { RolesGuard } from "./core/roles/roles.guard";

// 2. Add providers array inside @Module({ ... }) after the imports array:
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
```

---

## FIX 3 — academics.dto.ts + academics.service.ts: branchId

Check prisma schema first: `backend/prisma/schema/academics/academics.prisma`
- `branchId String`  → required → `@IsNotEmpty()`, `branchId!: string`
- `branchId String?` → optional → `@IsOptional()`, `branchId?: string`

```typescript
// academics.dto.ts — add to CreateClassDto after sessionId:
@ApiProperty({ description: "Branch ID" })
@IsString() @IsNotEmpty()
branchId!: string;

// academics.service.ts — add BadRequestException to imports, then in createClass():
if (!dto.branchId) throw new BadRequestException("branchId is required.");
const cls = await this.prisma.class.create({
  data: {
    tenantId,
    branchId:     dto.branchId,   // ← ADD
    sessionId:    dto.sessionId,
    name:         dto.name,
    displayOrder: dto.displayOrder ?? 0,
  } as any,
});
```

---

## FIX 4 — ecosystem.config.js + separate worker entry point

### Why cluster mode is unsafe for this codebase (confirmed by audit)
- `BiometricAttendanceService` — `private devices = new Map()` in-process
- `OutboxWorker` — `@Cron(EVERY_5_SECONDS)` + in-memory `tenantBuckets` Map
- `SupportCronService` — `@Cron` every 30 minutes
All three fire on every cluster instance: duplicate cron runs, split device state.

### Step 1 — Create a separate worker entry point

```typescript
// backend/src/worker.ts  ← new file
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";

async function bootstrapWorker() {
  // createApplicationContext = no HTTP server, no middleware, no guards
  // BullMQ processors and @Cron jobs start automatically
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ["error", "warn", "log"],
  });
  console.log("SchoolOS workers running");
}

bootstrapWorker().catch(console.error);
```

### Step 2 — Create WorkerModule importing ONLY infrastructure + worker services

```typescript
// backend/src/worker.module.ts  ← new file
import { Module }               from "@nestjs/common";
import { ConfigModule }         from "@nestjs/config";
import { EventEmitterModule }   from "@nestjs/event-emitter";
import { ScheduleModule }       from "@nestjs/schedule";
import { PrismaModule }         from "./infra/database/prisma.module";
import { RedisModule }          from "./infra/cache/redis.module";
import { QueueModule }          from "./infra/queue/queue.module";
import { OutboxWorker }         from "./infra/queue/workers/outbox.worker";
import { BillingCycleWorker }   from "./infra/queue/workers/billing-cycle.worker";
import { NotificationWorker }   from "./infra/queue/workers/notification.worker";
import { DunningWorker }        from "./infra/queue/workers/dunning.worker";
import { SupportCronService }   from "./modules/support/support-cron.service";
import { SupportService }       from "./modules/support/services/support.service";
import { validate }             from "./core/config/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    PrismaModule,
    RedisModule,
    QueueModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),   // @Cron fires here, NOT in AppModule
  ],
  providers: [
    OutboxWorker, BillingCycleWorker, NotificationWorker,
    DunningWorker, SupportCronService, SupportService,
  ],
})
export class WorkerModule {}
```

### Step 3 — Remove ScheduleModule.forRoot() from AppModule

In `backend/src/app.module.ts`, remove the `ScheduleModule.forRoot()` import
and the `@nestjs/schedule` import line. This ensures @Cron decorators only
fire in the worker process.

### Step 4 — Add worker build target to package.json

```json
// backend/package.json — add to scripts:
"build:worker": "tsc -p tsconfig.build.json && echo worker built"
```

### Step 5 — Update ecosystem.config.js

```javascript
module.exports = {
  apps: [
    {
      name:      "schoolos-backend",
      cwd:       "./backend",
      script:    "node",
      args:      "dist/main",
      instances: 1,         // NOT 2 — in-memory state present
      exec_mode: "fork",    // NOT cluster
      env:       { NODE_ENV: "production", PORT: 8000 },
    },
    {
      name:      "schoolos-workers",
      cwd:       "./backend",
      script:    "node",
      args:      "dist/worker",   // separate entry, no HTTP server
      instances: 1,
      exec_mode: "fork",
      env:       { NODE_ENV: "production" },
    },
    {
      name:   "schoolos-frontend",
      cwd:    "./frontend",
      script: "node",
      args:   "node_modules/.bin/next start -p 3000",
      env:    { NODE_ENV: "production", PORT: 3000 },
    },
    {
      name:   "schoolos-superadmin",
      cwd:    "./superadmin",
      script: "node",
      args:   "node_modules/.bin/next start -p 3001",
      env:    { NODE_ENV: "production", PORT: 3001 },
    },
  ],
};
```

---

## FIX 5 — /health/live and /health/ready endpoints

**Note:** `@nestjs/terminus` is NOT installed. The health controller below
uses only existing dependencies: `PrismaService` and `RedisService` (both
already in the codebase). `RedisService.isHealthy()` already exists.
`ServiceUnavailableException` is from `@nestjs/common`.

```typescript
// backend/src/core/health/health.controller.ts  ← new file
import {
  Controller, Get,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiTags }       from "@nestjs/swagger";
import { PrismaService } from "@infra/database/prisma.service";
import { RedisService }  from "@infra/cache/redis.service";
import { Public }        from "../auth/decorators/public.decorator";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
  ) {}

  /** Liveness: process is up. No I/O — responds in < 1ms. */
  @Get("live")
  @Public()
  liveness() {
    return { status: "ok", ts: new Date().toISOString() };
  }

  /** Readiness: DB + Redis are reachable. Used by CD pipeline. */
  @Get("ready")
  @Public()
  async readiness() {
    const checks: Record<string, "ok" | "unavailable"> = {
      database: "unavailable",
      redis:    "unavailable",
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch { /* PrismaService already logs the error */ }

    // RedisService.isHealthy() already exists — pings and returns boolean
    checks.redis = (await this.redis.isHealthy()) ? "ok" : "unavailable";

    const degraded = Object.values(checks).some(v => v !== "ok");
    if (degraded) {
      // 503 — CD pipeline curl check treats non-200 as failure → rollback
      throw new ServiceUnavailableException({ status: "degraded", checks });
    }

    return { status: "ok", checks };
  }
}
```

Register in `AppModule`:
```typescript
// In backend/src/core/health/ create health.module.ts:
@Module({
  controllers: [HealthController],
})
export class HealthModule {}

// Then import HealthModule in app.module.ts imports array
```

---

## GitHub Secrets (Settings → Secrets and variables → Actions)

| Secret               | Description                                        |
|----------------------|----------------------------------------------------|
| `DATABASE_URL`       | Production Postgres connection string              |
| `NEXT_PUBLIC_API_URL`| e.g. `https://api.schoolos.in/api/v1`              |
| `DEPLOY_HOST`        | Server IP or hostname                              |
| `DEPLOY_USER`        | SSH username                                       |
| `DEPLOY_SSH_KEY`     | Full PEM private key contents                      |
| `HEALTH_CHECK_URL`   | e.g. `https://api.schoolos.in` (no trailing slash) |

## Branch Protection (Settings → Branches → Add rule → main)

- ✅ Require status checks: Backend, Prisma schema, Frontend, Superadmin
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings

## Post-deploy verification

```bash
cd backend

# 1. Types compile
pnpm typecheck

# 2. Tests pass
pnpm test --passWithNoTests

# 3. No unguarded controllers remain
grep -rL "@UseGuards" src --include="*.controller.ts" | grep -v spec

# 4. APP_GUARD import is from @nestjs/core
grep "APP_GUARD" src/app.module.ts | grep "@nestjs/core"

# 5. All public routes have @Public()
grep -rn "@Public()" src --include="*.ts" | grep -v spec
```
