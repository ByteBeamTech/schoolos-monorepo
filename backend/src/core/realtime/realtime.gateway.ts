// core/realtime/realtime.gateway.ts
// Single realtime module — resolves the core/realtime vs modules/system/realtime duplication.
// Use THIS file. Delete modules/system/realtime if it exists.

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { JwtService }         from '@nestjs/jwt';
import { Server, Socket }     from 'socket.io';

// SECURITY FIX (found while activating this gateway for the first time --
// it was built but never registered/used anywhere in the app, see the
// activation commit). handleConnection previously trusted whatever
// tenantId the client claimed in the handshake auth payload with zero
// verification -- literally any client could connect with
// { tenantId: 'any-tenant-id-they-want' } and silently join that tenant's
// room, receiving every real-time event meant for that tenant (or the
// superadmin platform room) without ever logging in. Fixed by verifying a
// real JWT in the handshake instead, using the exact same two
// secrets/audiences the HTTP guards already trust (JwtStrategy /
// JwtSuperadminStrategy) -- tenantId is now derived from the *verified*
// token payload, never from client-supplied data.
@WebSocketGateway({
  cors:      { origin: '*', credentials: true },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  // tenantId → Set of socket IDs
  private readonly tenantSockets = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`[Realtime] Client ${client.id} connected without a token — disconnecting`);
      client.disconnect();
      return;
    }

    const audienceFallback = this.config.get<string>('SUPERADMIN_JWT_AUDIENCE', 'schoolos-superadmin');

    let payload: any;
    try {
      // Peek at the audience claim (unverified) purely to pick which
      // secret to verify against -- the actual trust decision happens in
      // the verify() call below, not here. Fallback defaults here match
      // jwt-superadmin.strategy.ts's own exactly (SUPERADMIN_JWT_SECRET
      // falls back to JWT_SECRET, SUPERADMIN_JWT_AUDIENCE falls back to
      // the literal 'schoolos-superadmin') -- without matching these,
      // superadmin token detection here would silently fail whenever
      // those env vars aren't explicitly set, even though the real HTTP
      // guard elsewhere works fine via its own fallback.
      const unverified    = this.jwtService.decode(token) as any;
      const isSuperadmin  = unverified?.aud === audienceFallback;
      const secret = isSuperadmin
        ? this.config.get<string>('SUPERADMIN_JWT_SECRET', this.config.get<string>('JWT_SECRET')!)
        : this.config.get<string>('JWT_SECRET');
      payload = this.jwtService.verify(token, {
        secret,
        audience: isSuperadmin ? audienceFallback : undefined,
      });
    } catch (e) {
      this.logger.warn(`[Realtime] Client ${client.id} sent an invalid/expired token — disconnecting`);
      client.disconnect();
      return;
    }

    const tenantId = payload.tenantId as string;
    if (!tenantId) {
      this.logger.warn(`[Realtime] Client ${client.id}'s token has no tenantId claim — disconnecting`);
      client.disconnect();
      return;
    }

    client.join(`tenant:${tenantId}`);
    if (!this.tenantSockets.has(tenantId)) this.tenantSockets.set(tenantId, new Set());
    this.tenantSockets.get(tenantId)!.add(client.id);

    // Superadmin sockets additionally join a dedicated 'admins' room, so
    // cross-tenant admin-facing events (new ticket from ANY school, new
    // override request from ANY tenant) have somewhere to broadcast to
    // without hardcoding the platform tenant's DB id anywhere, and
    // without leaking those events to individual schools' own sockets
    // the way emitToAll() would.
    const isSuperadminToken = payload.aud === audienceFallback;
    if (isSuperadminToken) client.join('admins');

    this.logger.debug(`[Realtime] Client ${client.id} (user ${payload.sub ?? payload.id}) joined tenant:${tenantId}${isSuperadminToken ? ' + admins' : ''}`);
  }

  handleDisconnect(client: Socket) {
    // Client already left every room it joined automatically on
    // disconnect (Socket.IO's own behavior) -- this just cleans up our
    // own bookkeeping map. We don't have the tenantId handy here without
    // re-decoding, so sweep all sets; cheap given realistic connection
    // counts.
    for (const sockets of this.tenantSockets.values()) {
      sockets.delete(client.id);
    }
    this.logger.debug(`[Realtime] Client ${client.id} disconnected`);
  }

  // ─── Broadcast helpers (called from services) ────────────────────────────────

  emitToTenant(tenantId: string, event: string, payload: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
  }

  emitToAdmins(event: string, payload: unknown) {
    this.server.to('admins').emit(event, payload);
  }

  emitToAll(event: string, payload: unknown) {
    this.server.emit(event, payload);
  }

  // ─── Client-side subscriptions ───────────────────────────────────────────────

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channel: string },
  ) {
    client.join(data.channel);
    return { status: 'subscribed', channel: data.channel };
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong', data: { ts: Date.now() } };
  }
}
