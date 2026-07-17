// core/license/license.module.ts
//
// NOTE (PR-1 cleanup): this file previously contained LocalizationModule's code
// (copy-paste error) — LicenseModule never actually existed as an importable
// module, and was therefore never registered in AppModule. See PR-1 notes:
// LicenseService/LicenseExpiryJob were dead code, not wired into any request path.
//
// This registers LicenseService correctly. It is intentionally NOT yet imported
// into app.module.ts — turning enforcement on live is a separate, explicit
// decision (see PR-1 notes), not a side effect of this cleanup.
//
 import { Global, Module } from '@nestjs/common';

import { LicenseService } from './license.service';
import { LicenseExpiryJob } from './license-expiry.job';
import { LicenseBuilder } from './license-builder.service';
import { SubscriptionActivatedListener } from './subscription-activated.listener';
import { EntitlementResolver } from './entitlement-resolver.service';

// PR-5A: EntitlementResolver added -- the read-side half of COMM-007,
// extracted out of LicenseService (see entitlement-resolver.service.ts for
// the full rationale). Exported so PR-5B can inject it into
// Students/Branches/Attendance/Fees/Inventory/Communications/AI modules.
// LicenseService itself stays exported too -- license-expiry.job.ts and
// backfill-licenses.ts still use its data-access methods directly, and it
// now also carries deprecated backward-compat wrappers that delegate to
// EntitlementResolver.
//
// LicenseService <-> EntitlementResolver is intentionally circular
// (EntitlementResolver needs LicenseService.getActiveLicense for data
// access; LicenseService needs EntitlementResolver for its deprecated
// wrappers) -- both classes use forwardRef() at the constructor-injection
// level to break the cycle. No module-level forwardRef needed since both
// live in this one module.

@Global()
@Module({
  providers: [
    LicenseService,
    LicenseExpiryJob,
    LicenseBuilder,
    SubscriptionActivatedListener,
    EntitlementResolver,
  ],
  exports: [
    LicenseService,
    LicenseBuilder,
    EntitlementResolver,
  ],
})
export class LicenseModule {}
