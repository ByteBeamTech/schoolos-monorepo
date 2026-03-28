// core/feature-flags/module-flag.guard.ts
// Usage: @UseModuleFlag('MODULE_LIBRARY') on any controller or route
// Automatically returns 403 if the module is disabled for the requesting tenant.

import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException, SetMetadata,
} from '@nestjs/common';
import { Reflector }          from '@nestjs/core';
import { FeatureFlagService } from './feature-flags.service';

export const MODULE_FLAG_KEY = 'moduleFlag';
export const UseModuleFlag   = (flagName: string) => SetMetadata(MODULE_FLAG_KEY, flagName);

@Injectable()
export class ModuleFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags:     FeatureFlagService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const flagName = this.reflector.getAllAndOverride<string>(MODULE_FLAG_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // No flag set on this route — allow through
    if (!flagName) return true;

    const request = ctx.switchToHttp().getRequest();
    const user     = request.user;

    if (!user?.tenantId) return false;

    const enabled = await this.flags.isEnabled(flagName, {
      tenantId:  user.tenantId,
      userId:    user.id,
      role:      user.role,
      planTier:  request.tenantPlanTier,
    });

    if (!enabled) {
      throw new ForbiddenException(
        `Module not available on your current plan. Contact your administrator to upgrade.`
      );
    }

    return true;
  }
}

// ─── Feature flag guard (for individual features within modules) ───────────────
export const FEATURE_FLAG_KEY = 'featureFlag';
export const UseFeatureFlag   = (flagName: string) => SetMetadata(FEATURE_FLAG_KEY, flagName);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags:     FeatureFlagService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const flagName = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!flagName) return true;

    const request = ctx.switchToHttp().getRequest();
    const user     = request.user;
    if (!user?.tenantId) return false;

    const enabled = await this.flags.isEnabled(flagName, {
      tenantId: user.tenantId,
      userId:   user.id,
      role:     user.role,
      planTier: request.tenantPlanTier,
    });

    if (!enabled) {
      throw new ForbiddenException(`Feature '${flagName}' is not enabled for your account.`);
    }

    return true;
  }
}

