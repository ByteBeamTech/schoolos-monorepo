import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { UsersService }  from '../users/users.service';
import { TokenService }  from '../identity/token.service';
import { AuditService }  from '../compliance/audit.service';
import { LoginDto, AuthResponseDto, RefreshTokenDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users:  UsersService,
    private readonly tokens: TokenService,
    private readonly audit:  AuditService,
  ) {}

  async login(
    dto:       LoginDto,
    tenantId:  string,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthResponseDto> {
    // BUG 2 NOTE: findByEmailWithPassword queries WHERE tenantId AND email.
    // The tenant must exist in the DB and the user must belong to that tenant.
    // If the seed has not been run, or ran against a different DB, this returns
    // null and we fall through to the timing-safe fake check + 401.
    const user = await this.users.findByEmailWithPassword(tenantId, dto.email);

    if (!user) {
      await this.fakePasswordCheck(dto.password);
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Contact your school administrator.',
      );
    }

    // Guard: passwordHash must exist — social/SSO accounts have no hash
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Password login is not enabled for this account. Use SSO to sign in.',
      );
    }

    const isValid = await this.users.validatePassword(
      dto.password,
      user.passwordHash,
    );

    if (!isValid) {
      await this.audit.log({
        tenantId, actorId: user.id, actorRole: user.role as any,
        action: 'LOGIN' as any, entityType: 'User', entityId: user.id,
        after: { success: false, reason: 'invalid_password' }, ipAddress, userAgent,
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    const tokenPair = await this.tokens.issueTokens({
      userId: user.id, tenantId: user.tenantId, role: user.role, email: user.email, isSuperadmin: user.role === 'SUPER_ADMIN',
    });

    // BUG 7 FIX: pass tenantId explicitly — auth routes are excluded from
    // TenantMiddleware so CLS has no tenantId at this point in the request.
    await this.users.updateLastLogin(user.id, user.tenantId);

    await this.audit.log({
      tenantId, actorId: user.id, actorRole: user.role as any,
      action: 'LOGIN' as any, entityType: 'User', entityId: user.id,
      after: { success: true }, ipAddress, userAgent,
    });

    this.logger.log(`Login: ${user.email} | tenant: ${tenantId}`);

    return {
      ...tokenPair,
      user: {
        id: user.id, email: user.email, firstName: user.firstName,
        lastName: user.lastName, role: user.role,
        tenantId: user.tenantId, avatarUrl: user.avatarUrl,
      },
      redirectPath: this.getRoleBasedRedirect(user.role),
    };
  }

  private getRoleBasedRedirect(role: string): string {
    const redirectMap: Record<string, string> = {
      SUPER_ADMIN:       '/dashboard',
      SCHOOL_OWNER:      '/dashboard',
      SCHOOL_ADMIN:      '/dashboard',
      PRINCIPAL:         '/dashboard',
      VICE_PRINCIPAL:    '/dashboard',
      ACCOUNTANT:        '/dashboard/billing',
      TEACHER:           '/dashboard/academics',
      CLASS_TEACHER:     '/dashboard/attendance',
      LIBRARIAN:         '/dashboard/library',
      NURSE:             '/dashboard/health',
      PARENT:            '/parent',
      STUDENT:           '/student',
      STAFF:             '/dashboard',
      HR_MANAGER:        '/dashboard/hr',
      RECEPTIONIST:      '/dashboard/reception',
      TRANSPORT_MANAGER: '/dashboard/transport',
    };
    return redirectMap[role] || '/dashboard';
  }

  async refresh(dto: RefreshTokenDto): Promise<Omit<AuthResponseDto, 'user'>> {
    return this.tokens.rotateRefreshToken(dto.refreshToken);
  }

  async logout(
    refreshToken: string,
    userId:       string,
    tenantId:     string,
    ipAddress:    string,
    userAgent:    string,
  ): Promise<void> {
    await this.tokens.revokeRefreshToken(refreshToken);
    await this.audit.log({
      tenantId, actorId: userId,
      action: 'LOGOUT' as any, entityType: 'User', entityId: userId,
      ipAddress, userAgent,
    });
    this.logger.log(`Logout: user ${userId} | tenant: ${tenantId}`);
  }

  private async fakePasswordCheck(password: string): Promise<void> {
    const fakeHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbAn.hAO2';
    const bcrypt = await import('bcryptjs');
    await bcrypt.compare(password, fakeHash);
  }
}
