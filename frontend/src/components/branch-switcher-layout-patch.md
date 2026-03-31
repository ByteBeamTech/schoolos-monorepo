# Patch for dashboard-layout.tsx

## Step 1: Import BranchSwitcher
Add to imports:
```tsx
import { BranchSwitcher } from "@/components/branch-switcher";
```

## Step 2: Add BranchSwitcher in sidebar, above the NAV groups
Find this block in dashboard-layout.tsx:
```tsx
{/* Sidebar nav */}
{filterNavByRole(user?.role).map(group => (
```

Add the BranchSwitcher ABOVE this map call, conditionally for SUPER_ADMIN:
```tsx
{/* Branch Switcher — SUPER_ADMIN only */}
{user?.role === "SUPER_ADMIN" && (
  <BranchSwitcher />
)}

{filterNavByRole(user?.role).map(group => (
```

## Step 3: Setup API interceptor in layout.tsx (root dashboard layout)
In `src/app/dashboard/layout.tsx`, add:
```tsx
"use client";
import { useEffect } from "react";
import { apiClient } from "@/lib/api";
import { setupBranchInterceptor } from "@/lib/api-branch-interceptor";

// Call once on mount
useEffect(() => {
  setupBranchInterceptor(apiClient);
}, []);
```

## Step 4: Backend — read x-branch-id header in guards
In NestJS, add to your tenant guard or a shared decorator:
```typescript
@Injectable()
export class BranchGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    // Override branchId from header if SUPER_ADMIN
    const headerBranchId = req.headers['x-branch-id'];
    if (req.user.role === 'SUPER_ADMIN' && headerBranchId) {
      req.activeBranchId = headerBranchId;
    } else {
      req.activeBranchId = req.user.branchId; // from JWT for other roles
    }
    return true;
  }
}
```

Then in controllers, use `req.activeBranchId` for all DB queries.
