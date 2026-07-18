// core/realtime/realtime.module.ts
import { Global, Module }    from '@nestjs/common';
import { JwtModule }         from '@nestjs/jwt';
import { RealtimeGateway }   from './realtime.gateway';

@Global()
@Module({
  // No default secret registered here -- RealtimeGateway.handleConnection
  // passes an explicit `secret` per verify() call (tenant vs superadmin
  // secret, chosen by the token's own audience claim), so JwtModule only
  // needs to be present to make JwtService injectable at all.
  imports:   [JwtModule.register({})],
  providers: [RealtimeGateway],
  exports:   [RealtimeGateway],
})
export class RealtimeModule {}
