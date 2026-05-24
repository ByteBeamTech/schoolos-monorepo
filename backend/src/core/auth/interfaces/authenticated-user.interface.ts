// /apps/schoolos/backend/src/core/auth/interfaces/authenticated-user.interface.ts

import { UserRole } from '@prisma/client';

/**
 * Canonical identity contract — mirrors EXACTLY what JwtStrategy.validate()
 * returns onto request.user.  Do NOT add fields here without also updating
 * JwtStrategy; they will always be undefined at runtime.
 */
export interface AuthenticatedUser {
  /** Prisma User.id (cuid) */
  readonly id:        string;
  /** Tenant the user belongs to */
  readonly tenantId:  string;
  /**
   * Strongly-typed role from the UserRole Prisma enum.
   * Guards and decorators can compare against UserRole.SCHOOL_ADMIN etc.
   * without string literals.
   */
  readonly role:      UserRole;
  readonly email:     string;
  /** JWT token ID — used for revocation checks */
  readonly jti:       string;
  /**
   * Branch scope — populated from JWT payload when the token was issued
   * with a branch context (school-admin, teacher, etc.).
   * OPTIONAL: super-admins and system workers may not have one.
   */
  readonly branchId?: string;
}
