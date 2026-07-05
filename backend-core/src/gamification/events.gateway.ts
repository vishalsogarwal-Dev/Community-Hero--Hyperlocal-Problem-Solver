/**
 * Task 5.4 — Socket.io WebSocket Gateway.
 *
 * Handles real-time connections and provides a helper to emit events
 * to a specific authenticated user (by their userId stored in the
 * socket handshake auth token).
 */
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  // userId → Set of socket IDs (a user may have multiple tabs/devices)
  private readonly userSockets = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId as string;
    if (userId) {
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      this.logger.log(`[ws] connected: socket=${client.id} user=${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSockets.delete(userId);
        this.logger.log(`[ws] disconnected: socket=${client.id} user=${userId}`);
        break;
      }
    }
  }

  /** Emit an event payload to every socket belonging to a specific user. */
  emitToUser(userId: string, event: string, payload: Record<string, unknown>): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    for (const socketId of sockets) {
      this.server.to(socketId).emit(event, payload);
    }
  }

  /** Broadcast a map update (new report pin) to all connected clients. */
  broadcastMapUpdate(payload: Record<string, unknown>): void {
    this.server.emit('map_update', payload);
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    client.emit('pong', { ts: Date.now() });
  }
}
