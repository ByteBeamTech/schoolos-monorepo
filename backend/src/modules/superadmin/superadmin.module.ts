import { Module }             from '@nestjs/common';
import { JwtModule }          from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SuperadminService }  from './superadmin.service';
import { SuperadminController }from './superadmin.controller';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { PlatformNotificationController } from './platform-notification.controller';
import { PlatformNotificationService } from './platform-notification.service';
import { PlatformUsersController } from './controllers/platform-users.controller';
import { PlatformUsersService } from './services/platform-users.service';
import { PlatformInvitationsController } from './controllers/platform-invitations.controller';
import { InvitationAcceptController } from './controllers/invitation-accept.controller';
import { PlatformInvitationsService } from './services/platform-invitations.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ComplianceModule } from '../../core/compliance/compliance.module';

@Module({
  imports: [NotificationsModule, ComplianceModule,
    JwtModule.registerAsync({
      imports:    [ConfigModule,],
      useFactory: (config: ConfigService) => ({
        secret:      config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRY', '15m') },
      }),
      inject: [ConfigService],
    }),
  ],
  providers:   [
    SuperadminService, CouponsService, PlatformNotificationService,
    PlatformUsersService, PlatformInvitationsService,
  ],
  controllers: [
    SuperadminController, CouponsController, PlatformNotificationController,
    PlatformUsersController, PlatformInvitationsController, InvitationAcceptController,
  ],
})
export class SuperadminModule {}
