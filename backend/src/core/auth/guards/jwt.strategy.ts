import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@infra/database/prisma.service';

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
  branchId?: string;
  /**
   * Every branch the user has access to (active mappings only).
   * Populated for SCHOOL_ADMIN / SUPER_ADMIN / multi-branch staff.
   */
  branchIds: string[];
  email: string;
  jti: string;
}

/**
 * Roles that are allowed to operate WITHOUT a default branch (tenant-wide scope).
 * The branch context for these users is resolved per-request, either:
 *   - from the `x-branch-id` header (validated against branchIds), or
 *   - left undefined (services then filter only by tenantId).
 */
const TENANT_WIDE_ROLES = new Set(['SCHOOL_ADMIN', 'SUPER_ADMIN']);

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        role: true,
        email: true,
        branchMappings: {
          where: { isActive: true },
          select: { branchId: true, isDefault: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or account deactivated.');
    }

    const branchIds = (user.branchMappings ?? []).map((m) => m.branchId);
    const defaultBranchId =
      (user.branchMappings ?? []).find((m) => m.isDefault)?.branchId ??
      branchIds[0];

    // Tenant-wide roles do not require a branch; everyone else must have one.
    if (!defaultBranchId && !TENANT_WIDE_ROLES.has(user.role)) {
      throw new UnauthorizedException('No branch assigned to user.');
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      branchId: defaultBranchId, // may be overridden by BranchContextMiddleware
      branchIds,
      role: user.role,
      email: user.email,
      jti: payload.jti,
    };
  }
}

export { TENANT_WIDE_ROLES };
