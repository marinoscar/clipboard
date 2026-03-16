import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSocket(token?: string): any {
  return {
    id: 'socket-abc',
    handshake: {
      auth: token !== undefined ? { token } : {},
    },
    join: jest.fn(),
    disconnect: jest.fn(),
    data: {},
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const mockJwtService = {
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsGateway,
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    gateway = module.get<EventsGateway>(EventsGateway);
    jwtService = module.get(JwtService);

    // Attach a mock server to the gateway so emitToUser tests work
    (gateway as any).server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
  });

  // ── handleConnection ───────────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('should verify JWT and join user room when token is valid', () => {
      const userId = 'user-42';
      jwtService.verify.mockReturnValue({ sub: userId });

      const client = makeSocket('valid-token');
      gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(client.join).toHaveBeenCalledWith(`user:${userId}`);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect client when no auth token is present', () => {
      const client = makeSocket(undefined);
      // Override handshake.auth to have no token key at all
      client.handshake.auth = {};
      gateway.handleConnection(client);

      expect(jwtService.verify).not.toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should disconnect client when token is an empty string', () => {
      const client = makeSocket('');
      gateway.handleConnection(client);

      expect(jwtService.verify).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should disconnect client when JWT verification throws', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const client = makeSocket('bad-token');
      gateway.handleConnection(client);

      expect(client.join).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should disconnect client when JWT payload has no sub', () => {
      jwtService.verify.mockReturnValue({ sub: undefined });

      const client = makeSocket('token-missing-userid');
      gateway.handleConnection(client);

      expect(client.join).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  // ── handleDisconnect ───────────────────────────────────────────────────────

  describe('handleDisconnect', () => {
    it('should not throw when a client disconnects', () => {
      const client = makeSocket();
      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });
  });

  // ── emitToUser ─────────────────────────────────────────────────────────────

  describe('emitToUser', () => {
    it('should emit event to the correct user room', () => {
      const userId = 'user-99';
      const event = 'item:created';
      const data = { id: 'item-1', content: 'hello' };

      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      (gateway as any).server = { to: mockTo };

      gateway.emitToUser(userId, event, data);

      expect(mockTo).toHaveBeenCalledWith(`user:${userId}`);
      expect(mockEmit).toHaveBeenCalledWith(event, data);
    });

    it('should use the user: prefix in the room name', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      (gateway as any).server = { to: mockTo };

      gateway.emitToUser('abc-123', 'test:event', {});

      expect(mockTo).toHaveBeenCalledWith('user:abc-123');
    });
  });
});
