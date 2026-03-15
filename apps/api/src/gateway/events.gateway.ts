import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/clipboard',
  cors: { origin: true, credentials: true },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      this.logger.warn(`Client ${client.id} connected without token — disconnecting`);
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<{ userId: string }>(token);
      const userId = payload.userId;

      if (!userId) {
        throw new Error('JWT payload missing userId claim');
      }

      const room = `user:${userId}`;
      client.join(room);
      this.logger.debug(`Client ${client.id} joined room ${room}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Client ${client.id} JWT validation failed: ${message} — disconnecting`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client ${client.id} disconnected`);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    const room = `user:${userId}`;
    this.server.to(room).emit(event, data);
    this.logger.debug(`Emitted ${event} to ${room}`);
  }
}
