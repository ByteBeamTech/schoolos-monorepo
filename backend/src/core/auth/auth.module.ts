import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { IdentityModule }   from '../identity/identity.module';
import { UsersModule }      from '../users/users.module';
import { ComplianceModule } from '../compliance/compliance.module';

import { AuthService }    from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy }    from './guards/jwt.strategy';
import { JwtGuard }       from './guards/jwt.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    IdentityModule,
    UsersModule,
    ComplianceModule,
  ],
  providers:   [AuthService, JwtStrategy, JwtGuard],
  controllers: [AuthController],
  exports:     [AuthService, JwtGuard, JwtStrategy],
})
export class AuthModule {}
