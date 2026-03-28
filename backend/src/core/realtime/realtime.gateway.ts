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
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket }    from 'socket.io';

@WebSocketGateway({
  cors:      { origin: '*', credentials: true },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  // tenantId → Set of socket IDs
  private readonly tenantSockets = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    const tenantId = client.handshake.auth?.tenantId as string;
    if (!tenantId) {
      this.logger.warn(`[Realtime] Client ${client.id} connected without tenantId — disconnecting`);
      client.disconnect();
      return;
    }

    client.join(`tenant:${tenantId}`);
    if (!this.tenantSockets.has(tenantId)) this.tenantSockets.set(tenantId, new Set());
    this.tenantSockets.get(tenantId)!.add(client.id);

    this.logger.debug(`[Realtime] Client ${client.id} joined tenant:${tenantId}`);
  }

  handleDisconnect(client: Socket) {
    const tenantId = client.handshake.auth?.tenantId as string;
    if (tenantId) {
      this.tenantSockets.get(tenantId)?.delete(client.id);
    }
    this.logger.debug(`[Realtime] Client ${client.id} disconnected`);
  }

  // ─── Broadcast helpers (called from services) ────────────────────────────────

  emitToTenant(tenantId: string, event: string, payload: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
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
