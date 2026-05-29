import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@infra/database/prisma.service';

export interface AuthenticatedUser {
  id:       string;
  tenantId: string;
  role:     string;
  branchId?: string;
  email:    string;
  jti:      string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config:                        ConfigService,
    private readonly prisma:       PrismaService,
  ) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where:  { id: payload.sub, tenantId: payload.tenantId, isActive: true, deletedAt: null },
    
    select: {
  id: true,
  tenantId: true,
  role: true,
  email: true,
  staff: {
    select: {
      profile: {
        select: {
          branchId: true,
        },
      },
    },
  },
},  
    });

    if (!user) {
      throw new UnauthorizedException('User not found or account deactivated.');
    }

   return {
  id: user.id,
  tenantId: user.tenantId,
  branchId: user.staff?.profile?.branchId || 'primary',
  role: user.role,
  email: user.email,
  jti: payload.jti,
}; 
  }
}
