import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { IdentityModule }   from '../identity/identity.module';
import { UsersModule }      from '../users/users.module';
import { ComplianceModule } from '../compliance/compliance.module';

import { AuthService }          from './auth.service';
import { AuthController }       from './auth.controller';
import { JwtStrategy }          from './guards/jwt.strategy';
import { JwtGuard }             from './guards/jwt.guard';
import { JwtSuperadminStrategy } from './guards/jwt-superadmin.strategy';
import { JwtSuperadminGuard }    from './guards/jwt-superadmin.guard';
// BUG 7 FIX: PasswordResetService was never registered in the module,
// so NestJS DI could not resolve it and the forgot/reset routes didn't work.
import { PasswordResetService } from './password-reset.service';

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
    JwtSuperadminStrategy,
    JwtSuperadminGuard,
    PasswordResetService,   // BUG 7 FIX: was missing
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    JwtGuard,
    JwtStrategy,
    JwtSuperadminGuard,
    PasswordResetService,   // export so other modules can inject it if needed
  ],
})
export class AuthModule {}
