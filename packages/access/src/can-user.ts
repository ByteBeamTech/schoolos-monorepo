import type { UserRole } from '@schoolos/types'
import type { Permission } from './permissions'
import { ROLE_PERMISSIONS } from './roles'

export interface AccessContext {
  userId: string
  tenantId: string
  role: UserRole
  isSuperadmin: boolean
}

export function canUser(
  user: AccessContext,
  permission: Permission,
  resourceTenantId?: string,
): boolean {
  if (user.isSuperadmin) return true

  if (resourceTenantId && user.tenantId !== resourceTenantId) {
    return false
  }

  const permissions = ROLE_PERMISSIONS[user.role] ?? []
  return permissions.includes(permission) || permissions.includes('SUPERADMIN_ALL')
}

export function assertCan(
  user: AccessContext,
  permission: Permission,
  resourceTenantId?: string,
): void {
  if (!canUser(user, permission, resourceTenantId)) {
    throw new Error(
      `User ${user.userId} (role=${user.role}, tenant=${user.tenantId}) ` +
      `does not have permission: ${permission}` +
      (resourceTenantId ? ` on tenant ${resourceTenantId}` : ''),
    )
  }
}

export function canUserAny(
  user: AccessContext,
  permissions: Permission[],
  resourceTenantId?: string,
): boolean {
  return permissions.some(p => canUser(user, p, resourceTenantId))
}

export function canUserAll(
  user: AccessContext,
  permissions: Permission[],
  resourceTenantId?: string,
): boolean {
  return permissions.every(p => canUser(user, p, resourceTenantId))
}
