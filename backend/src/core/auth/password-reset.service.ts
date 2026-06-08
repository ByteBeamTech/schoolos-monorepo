import { Injectable, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService }  from '@nestjs/config';
import { PrismaService } from '@infra/database/prisma.service';
import { RedisService }   from '../../infra/cache/redis.service';
// BUG 5 FIX: Wrong import path. TokenService lives at ../identity/token.service, not ./token.service.
import { TokenService }   from '../identity/token.service';
import { AuditService }   from '../compliance/audit.service';
import * as bcrypt        from 'bcryptjs';
import * as nodemailer    from 'nodemailer';
import * as crypto        from 'crypto';

const OTP_TTL_SECONDS = 15 * 60;
const MAX_ATTEMPTS    = 5;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly redis:   RedisService,
    private readonly tokens:  TokenService,
    private readonly config:  ConfigService,
    private readonly audit:   AuditService,
  ) {}

  // ── Step 1: Request reset ─────────────────────────────────────────────────
  async requestReset(tenantId: string, email: string): Promise<void> {
    const normalised = email.toLowerCase().trim();

    // Rate limit: 1 request per 60s per email per tenant
    const rateKey = `schoolos:auth:reset_rate:${tenantId}:${normalised}`;
    const isSpamming = await this.redis.get(rateKey);
    if (isSpamming) return;

    const user = await this.prisma.user.findFirst({
      where:  { tenantId, email: normalised, deletedAt: null },
      select: { id: true, firstName: true },
    });

    if (!user) {
      // Timing-safe: always wait even if user not found, to prevent enumeration
      await new Promise(r => setTimeout(r, 400));
      return;
    }

    const otp     = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    const key = `schoolos:auth:reset:${tenantId}:${user.id}`;
    await this.redis.setJson(key, { otpHash, email: normalised }, OTP_TTL_SECONDS);
    await this.redis.set(rateKey, '1', 60);

    await this.sendResetEmail(user.firstName, normalised, otp, tenantId);
    this.logger.log(`OTP sent to ${normalised} | tenant: ${tenantId}`);
  }

  // ── Step 2: Reset Password ────────────────────────────────────────────────
  async resetPassword(tenantId: string, email: string, otp: string, newPassword: string) {
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    if (!strongPasswordRegex.test(newPassword)) {
      throw new BadRequestException(
        'Password must have uppercase, lowercase, number and special character.',
      );
    }

    const normalised = email.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where:  { tenantId, email: normalised, deletedAt: null },
      select: { id: true, role: true, email: true, tenantId: true },
    });

    if (!user) throw new BadRequestException('Invalid request.');

    const key          = `schoolos:auth:reset:${tenantId}:${user.id}`;
    const attemptsKey  = `schoolos:auth:reset_attempts:${tenantId}:${user.id}`;

    // Brute-force guard
    const attempts = await this.redis.get(attemptsKey) ?? '0';
    if (Number(attempts) >= MAX_ATTEMPTS) {
      throw new ForbiddenException('Too many attempts. Please wait 15 minutes.');
    }

    const stored = await this.redis.getJson<{ otpHash: string }>(key);
    if (!stored) throw new BadRequestException('Reset code has expired. Please request a new one.');

    const isValid = await bcrypt.compare(otp, stored.otpHash);

    if (!isValid) {
      await this.redis.incr(attemptsKey);
      await this.redis.expire(attemptsKey, OTP_TTL_SECONDS);
      throw new BadRequestException('Invalid reset code.');
    }

    // Success: clean up OTP and attempt counter atomically
    await Promise.all([
      this.redis.del(key),
      this.redis.del(attemptsKey),
    ]);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data:  { passwordHash, updatedAt: new Date() },
    });

    // BUG 6 FIX: was passing userId (wrong key) and 'PASSWORD_RESET_SUCCESS'
    // (not a valid AuditAction). Use actorId and 'UPDATE' as action.
    await this.audit.log({
      tenantId,
      actorId:    user.id,
      action:     'UPDATE' as any,
      entityType: 'User',
      entityId:   user.id,
      after:      { event: 'PASSWORD_RESET_SUCCESS' },
    });

    return this.tokens.issueTokens({
      userId:       user.id,
      tenantId:     user.tenantId,
      role:         user.role,
      email:        user.email,
      isSuperadmin: user.role === 'SUPER_ADMIN',
    });
  }

  // ── Email dispatch ────────────────────────────────────────────────────────
  private async sendResetEmail(
    firstName: string,
    email:     string,
    otp:       string,
    tenantId:  string,
  ): Promise<void> {
    const sgKey      = this.config.get<string>('SENDGRID_API_KEY');
    const fromEmail  = this.config.get<string>('EMAIL_FROM', 'noreply@schoolos.in');
    const appName    = this.config.get<string>('APP_NAME', 'SchoolOS');



    // REPLACE the entire transporter creation block with:
const transporter = nodemailer.createTransport({
  host: this.config.get<string>('SMTP_HOST'),
  port: parseInt(this.config.get<string>('SMTP_PORT', '587')),
  secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
  auth: {
    user: this.config.get<string>('SMTP_USER'),
    pass: this.config.get<string>('SMTP_PASSWORD'),
  },
});







    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background: #f4f7ff; padding: 20px;">
  <div style="max-width: 450px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); overflow: hidden;">
    <div style="background: #1e40af; padding: 20px; text-align: center; color: white; font-size: 24px; font-weight: bold;">
      ${appName}
    </div>
    <div style="padding: 30px; color: #333; line-height: 1.6;">
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>Use the 6-digit code below to reset your password. It expires in 15 minutes:</p>
      <div style="background: #f0f7ff; border: 1px dashed #1e40af; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af; margin: 20px 0;">
        ${otp}
      </div>
      <p style="font-size: 12px; color: #666;">If you did not request this, please ignore this email.</p>
    </div>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from:    `"${appName}" <${fromEmail}>`,
      to:      email,
      subject: `${appName} — Password Reset Code`,
      html,
    });
  }
}
