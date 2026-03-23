import { Module }             from '@nestjs/common';
import { JwtModule }          from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SuperadminService }  from './superadmin.service';
import { SuperadminController }from './superadmin.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret:      config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRY', '15m') },
      }),
      inject: [ConfigService],
    }),
  ],
  providers:   [SuperadminService],
  controllers: [SuperadminController],
})
export class SuperadminModule {}
