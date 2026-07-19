// modules/superadmin/services/platform-users.service.ts
//
// Administration > Users. Manages SchoolOS's own platform staff
// (SUPER_ADMIN / SAAS_OWNER / ACCOUNT_MANAGER), scoped to the
// 'schoolos-platform' tenant -- distinct from tenant (school) user
// management, which already exists elsewhere. SAAS_OWNER and
// ACCOUNT_MANAGER were added to the UserRole enum during SA-1A
// (referenced in real @Roles() guards on the Approvals workflow) but
// had no user-management flow at all until this -- this is what
// finally makes those roles assignable to a real person.
//
// Deliberately NOT touching dynamic/custom roles (Phase 3, explicitly
// deferred) -- role is restricted to the 3 existing fixed enum values
// this phase covers.

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '@infra/database/prisma.service';
import { QUEUE_NAMES } from '../../../infra/queue/queue.module';
import { RealtimeGateway } from '../../../core/realtime/realtime.gateway';

const BCRYPT_ROUNDS = 12;
const PLATFORM_STAFF_ROLES = ['SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER'] as const;
type PlatformStaffRole = (typeof PLATFORM_STAFF_ROLES)[number];

function isPlatformStaffRole(role: string): role is PlatformStaffRole {
  return (PLATFORM_STAFF_ROLES as readonly string[]).includes(role);
}

function generateTempPassword(): string {
  // 12 random bytes, base64url-ish, trimmed to a readable length -- a
  // one-time initial/reset password shown to the admin once, not
  // intended to be memorable (the person changes it on first login via
  // the mustChangePassword flag).
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12) + '!A1';
}

@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notifQueue: Queue,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async getPlatformTenantId(): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: 'schoolos-platform' } });
    if (!tenant) throw new BadRequestException('Platform tenant (schoolos-platform) not found.');
    return tenant.id;
  }

  private async auditLog(actorId: string, action: string, entityId: string, before: any, after: any) {
    const tenantId = await this.getPlatformTenantId();
    await this.prisma.auditLog.create({
      data: {
        tenantId, actorId,
        actorRole:  'SUPER_ADMIN' as any,
        action:     action as any,
        entityType: 'PlatformUser',
        entityId,
        before, after,
      },
    });
  }

  private async notifyEmail(to: string, templateId: string, data: Record<string, string>) {
    try {
      const tenantId = await this.getPlatformTenantId();
      await this.notifQueue.add('send', {
        tenantId, channel: 'EMAIL', to, templateId, data,
      }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    } catch (err) {
      // Deliberately non-fatal, matching support.service.ts's
      // notifySchool() pattern -- an email-queue failure shouldn't roll
      // back the actual user/password change that already happened.
    }
  }

  // ── List / detail ─────────────────────────────────────────────────────────

  async list(filters: { search?: string; role?: string; status?: string }) {
    const tenantId = await this.getPlatformTenantId();
    const where: any = { tenantId, role: { in: [...PLATFORM_STAFF_ROLES] } };

    if (filters.role && isPlatformStaffRole(filters.role)) where.role = filters.role;
    if (filters.status === 'ACTIVE')   { where.isActive = true;  where.isDeleted = false; }
    if (filters.status === 'DISABLED') { where.isActive = false; where.isDeleted = false; }
    if (filters.status === 'DELETED')  { where.isDeleted = true; }
    if (!filters.status) where.isDeleted = false; // default: hide soft-deleted

    if (filters.search) {
      where.OR = [
        { email:     { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName:  { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        isActive: true, isDeleted: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const tenantId = await this.getPlatformTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, role: { in: [...PLATFORM_STAFF_ROLES] } },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        isActive: true, isDeleted: true, lastLoginAt: true, createdAt: true, preferences: true,
      },
    });
    if (!user) throw new NotFoundException('Platform user not found.');
    return user;
  }

  // ── Create ───────────────────────────────────────────────────────────────

  async create(dto: { email: string; firstName: string; lastName: string; role: string }, actorId: string) {
    if (!isPlatformStaffRole(dto.role)) {
      throw new BadRequestException(`role must be one of: ${PLATFORM_STAFF_ROLES.join(', ')}`);
    }
    const tenantId = await this.getPlatformTenantId();

    const existing = await this.prisma.user.findFirst({ where: { tenantId, email: dto.email } });
    if (existing) throw new BadRequestException('A platform user with this email already exists.');

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email:     dto.email,
        firstName: dto.firstName,
        lastName:  dto.lastName,
        role:      dto.role as any,
        passwordHash,
        isActive:  true,
        // mustChangePassword lives in `preferences` JSON rather than a
        // new column -- avoids a second migration for a single boolean
        // flag; see force-password-change below and auth.service.ts's
        // login flow for where this would need to be read/enforced.
        preferences: { mustChangePassword: true },
      },
    });

    await this.auditLog(actorId, 'CREATE', user.id, null, { email: dto.email, role: dto.role });
    await this.notifyEmail(dto.email, 'PLATFORM_USER_CREATED', {
      firstName: dto.firstName, tempPassword, role: dto.role,
    });

    // Temp password returned once, directly in the response -- not
    // stored anywhere retrievable after this, matching how a real
    // "shown once" credential should behave.
    return { user: { id: user.id, email: user.email, role: user.role }, tempPassword };
  }

  // ── Edit ─────────────────────────────────────────────────────────────────

  async update(id: string, dto: { firstName?: string; lastName?: string; role?: string }, actorId: string) {
    const before = await this.getById(id);
    if (dto.role && !isPlatformStaffRole(dto.role)) {
      throw new BadRequestException(`role must be one of: ${PLATFORM_STAFF_ROLES.join(', ')}`);
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName ? { firstName: dto.firstName } : {}),
        ...(dto.lastName  ? { lastName:  dto.lastName  } : {}),
        ...(dto.role      ? { role:      dto.role as any } : {}),
      },
    });
    await this.auditLog(actorId, 'UPDATE', id, before, dto);
    return user;
  }

  // ── Status (enable / disable) ───────────────────────────────────────────

  async setStatus(id: string, isActive: boolean, actorId: string) {
    const before = await this.getById(id);
    const user = await this.prisma.user.update({ where: { id }, data: { isActive } });
    await this.auditLog(actorId, 'UPDATE', id, { isActive: before.isActive }, { isActive });
    if (!isActive) await this.revokeAllSessions(id, actorId); // disabling immediately kills active sessions too
    return user;
  }

  // ── Soft delete ──────────────────────────────────────────────────────────

  async softDelete(id: string, actorId: string) {
    const before = await this.getById(id);
    if (id === actorId) throw new BadRequestException('You cannot delete your own account.');
    const user = await this.prisma.user.update({
      where: { id },
      data: { isDeleted: true, isActive: false, deletedAt: new Date() },
    });
    await this.auditLog(actorId, 'DELETE', id, before, null);
    await this.revokeAllSessions(id, actorId);
    return user;
  }

  // ── Password management ─────────────────────────────────────────────────

  async resetPassword(id: string, actorId: string) {
    const target = await this.getById(id);
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        preferences: { ...(target.preferences as any ?? {}), mustChangePassword: true },
      },
    });
    await this.auditLog(actorId, 'PASSWORD_RESET_REQUEST', id, null, { resetBy: actorId });
    await this.notifyEmail(target.email, 'PLATFORM_USER_PASSWORD_RESET', {
      firstName: target.firstName, tempPassword,
    });
    await this.revokeAllSessions(id, actorId); // force re-login with the new password
    return { tempPassword };
  }

  async forcePasswordChange(id: string, actorId: string) {
    const target = await this.getById(id);
    await this.prisma.user.update({
      where: { id },
      data: { preferences: { ...(target.preferences as any ?? {}), mustChangePassword: true } },
    });
    await this.auditLog(actorId, 'UPDATE', id, null, { mustChangePassword: true });
    return { ok: true };
  }

  // ── Sessions ─────────────────────────────────────────────────────────────

  async listSessions(userId?: string) {
    const tenantId = await this.getPlatformTenantId();
    return this.prisma.session.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { tenantId, role: { in: [...PLATFORM_STAFF_ROLES] }, ...(userId ? { id: userId } : {}) },
      },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(sessionId: string, actorId: string) {
    const session = await this.prisma.session.update({
      where: { id: sessionId },
      data:  { revokedAt: new Date() },
    });
    await this.auditLog(actorId, 'SESSION_REVOKE', session.userId, null, { sessionId });
    return { ok: true };
  }

  async revokeAllSessions(userId: string, actorId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
    await this.auditLog(actorId, 'SESSION_REVOKE', userId, null, { scope: 'all' });
    return { ok: true };
  }

  // ── Login history ────────────────────────────────────────────────────────
  // Reads the existing AuditLog trail (already captures LOGIN, LOGOUT,
  // PASSWORD_CHANGE, PASSWORD_RESET_REQUEST via auth.service.ts) --
  // nothing new to track, just a filtered read scoped to platform staff.
  // NOTE: no LOGIN_FAILED action exists in the AuditAction enum today,
  // so failed-attempt history genuinely isn't available -- consistent
  // with there being no lockout/failed-attempt-tracking logic anywhere
  // in auth.service.ts either (see the "Lock/Unlock" scoping note in the
  // Settings/Administration conversation this came from).

  async loginHistory(filters: { userId?: string; search?: string; limit?: number }) {
    const tenantId = await this.getPlatformTenantId();

    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        action: { in: ['LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUEST'] as any[] },
        ...(filters.userId ? { actorId: filters.userId } : {}),
        ...(filters.search ? {
          actor: {
            OR: [
              { email:     { contains: filters.search, mode: 'insensitive' } },
              { firstName: { contains: filters.search, mode: 'insensitive' } },
            ],
          },
        } : {}),
      },
      include: { actor: { select: { email: true, firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 100,
    });
  }
}
