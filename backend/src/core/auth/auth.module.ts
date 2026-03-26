import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { IdentityModule }   from '../identity/identity.module';
import { UsersModule }      from '../users/users.module';
import { ComplianceModule } from '../compliance/compliance.module';

import { AuthService }    from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy }    from './guards/jwt.strategy';
import { JwtGuard }       from './guards/jwt.guard';

// Phase 1: Naye guards aur strategy import karo
import { JwtSuperadminStrategy } from './guards/jwt-superadmin.strategy';
import { JwtSuperadminGuard }    from './guards/jwt-superadmin.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    IdentityModule,
    UsersModule,
    ComplianceModule,
  ],
  providers: [
    AuthService, 
    JwtStrategy, 
    JwtGuard, 
    // Phase 1: Strategy register karo
    JwtSuperadminStrategy, 
    JwtSuperadminGuard
  ],
  controllers: [AuthController],
  exports: [
    AuthService, 
    JwtGuard, 
    JwtStrategy, 
    // Phase 1: Guard export karo taaki controllers ise use kar sakein
    JwtSuperadminGuard
  ],
})
export class AuthModule {}
