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

@Global()
@Module({
  providers: [
    LicenseService,
    LicenseExpiryJob,
    LicenseBuilder,
    SubscriptionActivatedListener,
  ],
  exports: [
    LicenseService,
    LicenseBuilder,
  ],
})
export class LicenseModule {}
