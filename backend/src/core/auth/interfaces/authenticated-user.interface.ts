// /apps/schoolos/backend/src/core/auth/interfaces/authenticated-user.interface.ts

/**
 * 🧱 THE CANONICAL IDENTITY CONTRACT (IMMUTABLE ENTERPRISE STANDARD)
 * Strictly enforces write-protected token payloads across all domains globally.
 */
export interface AuthenticatedUser {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId?: string;
  readonly roles: readonly string[]; // Enforces immutable role arrays mapping

  readonly email?: string;

  // 🌍 Optional JWT/OpenID interoperability primitives
  readonly sub?: string;
}
