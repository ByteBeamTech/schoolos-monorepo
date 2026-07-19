// modules/superadmin/services/platform-invitations.service.ts
//
// Administration > Invitations. Email-based alternative to
// PlatformUsersService.create()'s direct "hand over a temp password"
// path -- invite flow: send a link, the person sets their own password.

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '@infra/database/prisma.service';
import { QUEUE_NAMES } from '../../../infra/queue/queue.module';

const BCRYPT_ROUNDS = 12;
const PLATFORM_STAFF_ROLES = ['SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER'] as const;
type PlatformStaffRole = (typeof PLATFORM_STAFF_ROLES)[number];

function isPlatformStaffRole(role: string): role is PlatformStaffRole {
  return (PLATFORM_STAFF_ROLES as readonly string[]).includes(role);
}

const INVITE_EXPIRY_DAYS = 7;

@Injectable()
export class PlatformInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notifQueue: Queue,
  ) {}

  private async getPlatformTenantId(): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: 'schoolos-platform' } });
    if (!tenant) throw new BadRequestException('Platform tenant (schoolos-platform) not found.');
    return tenant.id;
  }

  private async notifyEmail(to: string, templateId: string, data: Record<string, string>) {
    try {
      const tenantId = await this.getPlatformTenantId();
      await this.notifQueue.add('send', {
        tenantId, channel: 'EMAIL', to, templateId, data,
      }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    } catch (err) { /* non-fatal, same rationale as platform-users.service.ts */ }
  }

  private async auditLog(actorId: string | null, action: string, entityId: string, after: any) {
    const tenantId = await this.getPlatformTenantId();
    await this.prisma.auditLog.create({
      data: {
        tenantId, actorId,
        actorRole:  actorId ? ('SUPER_ADMIN' as any) : null,
        action:     action as any,
        entityType: 'PlatformInvitation',
        entityId, after,
      },
    });
  }

  // ── List / create / resend / cancel (admin-facing) ──────────────────────

  async list(status?: string) {
    return this.prisma.platformInvitation.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: { email: string; role: string; department?: string }, actorId: string) {
    if (!isPlatformStaffRole(dto.role)) {
      throw new BadRequestException(`role must be one of: ${PLATFORM_STAFF_ROLES.join(', ')}`);
    }
    const tenantId = await this.getPlatformTenantId();

    const existingUser = await this.prisma.user.findFirst({ where: { tenantId, email: dto.email } });
    if (existingUser) throw new BadRequestException('A platform user with this email already exists.');

    const existingPending = await this.prisma.platformInvitation.findFirst({
      where: { email: dto.email, status: 'PENDING' },
    });
    if (existingPending) throw new BadRequestException('A pending invitation for this email already exists.');

    const token = crypto.randomBytes(24).toString('base64url');
    const invite = await this.prisma.platformInvitation.create({
      data: {
        email:      dto.email,
        role:       dto.role as any,
        department: dto.department,
        token,
        status:     'PENDING',
        invitedBy:  actorId,
        expiresAt:  new Date(Date.now() + INVITE_EXPIRY_DAYS * 86400000),
      },
    });

    await this.auditLog(actorId, 'CREATE', invite.id, { email: dto.email, role: dto.role });
    await this.notifyEmail(dto.email, 'PLATFORM_INVITE', {
      role: dto.role, token, expiresInDays: String(INVITE_EXPIRY_DAYS),
    });

    return invite;
  }

  async resend(id: string, actorId: string) {
    const invite = await this.prisma.platformInvitation.findUnique({ where: { id } });
    if (!invite || invite.status !== 'PENDING') throw new BadRequestException('Invitation not found or no longer pending.');

    const token = crypto.randomBytes(24).toString('base64url');
    const updated = await this.prisma.platformInvitation.update({
      where: { id },
      data:  { token, expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * 86400000) },
    });

    await this.notifyEmail(invite.email, 'PLATFORM_INVITE', {
      role: invite.role, token, expiresInDays: String(INVITE_EXPIRY_DAYS),
    });
    await this.auditLog(actorId, 'UPDATE', id, { resent: true });
    return updated;
  }

  async cancel(id: string, actorId: string) {
    const invite = await this.prisma.platformInvitation.findUnique({ where: { id } });
    if (!invite || invite.status !== 'PENDING') throw new BadRequestException('Invitation not found or no longer pending.');
    const updated = await this.prisma.platformInvitation.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.auditLog(actorId, 'UPDATE', id, { status: 'CANCELLED' });
    return updated;
  }

  // ── Accept (public, token-based -- no superadmin auth, this IS the auth) ──

  async getByToken(token: string) {
    const invite = await this.prisma.platformInvitation.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException('Invitation not found.');
    if (invite.status !== 'PENDING') throw new BadRequestException('This invitation is no longer valid.');
    if (invite.expiresAt < new Date()) {
      await this.prisma.platformInvitation.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('This invitation has expired.');
    }
    return { email: invite.email, role: invite.role, department: invite.department };
  }

  async accept(token: string, dto: { firstName: string; lastName: string; password: string }) {
    const invite = await this.prisma.platformInvitation.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException('Invitation not found.');
    if (invite.status !== 'PENDING') throw new BadRequestException('This invitation is no longer valid.');
    if (invite.expiresAt < new Date()) throw new BadRequestException('This invitation has expired.');
    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    const tenantId = await this.getPlatformTenantId();
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const [user] = await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          tenantId,
          email:     invite.email,
          firstName: dto.firstName,
          lastName:  dto.lastName,
          role:      invite.role,
          passwordHash,
          isActive:  true,
          isEmailVerified: true, // accepting via the emailed link is itself the verification
        },
      }),
      this.prisma.platformInvitation.update({
        where: { id: invite.id },
        data:  { status: 'ACCEPTED', acceptedAt: new Date() },
      }),
    ]);

    await this.auditLog(user.id, 'CREATE', user.id, { via: 'invitation', invitationId: invite.id });
    return { id: user.id, email: user.email, role: user.role };
  }
}
