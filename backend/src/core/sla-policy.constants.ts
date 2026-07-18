// core/sla-policy.constants.ts
//
// Default SLA response/resolution times in minutes, per ticket priority.
// Previously lived as a hardcoded const inside support.service.ts --
// extracted here so it's the single source of truth for the *default*
// values, shared by:
//   - support.service.ts (falls back to this if no PlatformConfig
//     override has been saved yet)
//   - the new SLA Settings UI's GET route (shows these as the starting
//     point / "reset to defaults" values)
// The actual configurable value lives in PlatformConfig under the key
// PLATFORM_CONFIG_KEYS.SLA_POLICY, not here -- this file only holds the
// factory defaults.

export interface SlaPolicyMap {
  CRITICAL: { responseMin: number; resolutionMin: number };
  HIGH:     { responseMin: number; resolutionMin: number };
  MEDIUM:   { responseMin: number; resolutionMin: number };
  LOW:      { responseMin: number; resolutionMin: number };
}

export const DEFAULT_SLA_POLICY: SlaPolicyMap = {
  CRITICAL: { responseMin:  60,   resolutionMin:  240  },  // 1h response, 4h resolve
  HIGH:     { responseMin:  240,  resolutionMin:  480  },  // 4h response, 8h resolve
  MEDIUM:   { responseMin:  480,  resolutionMin:  1440 },  // 8h response, 24h resolve
  LOW:      { responseMin:  1440, resolutionMin:  4320 },  // 24h response, 72h resolve
};

export const PLATFORM_CONFIG_KEYS = {
  SLA_POLICY: 'sla_policy',
} as const;
