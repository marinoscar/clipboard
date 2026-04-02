import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  profileImageUrl: null,
  googleId: 'google-123',
  isActive: true,
  isAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService — Personal Access Tokens', () => {
  let service: AuthService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      personalAccessToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock-jwt') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              const c: Record<string, any> = {
                'jwt.accessTtlMinutes': 15,
                'jwt.refreshTtlDays': 14,
              };
              return c[key] ?? def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('createPat', () => {
    it('should create a token with clip_ prefix and return raw token once', async () => {
      prisma.personalAccessToken.create.mockImplementation(({ data }: any) => ({
        id: 'pat-1',
        ...data,
        createdAt: new Date(),
      }));

      const result = await service.createPat('user-1', 'My Token', '30d');

      expect(result.token).toMatch(/^clip_[0-9a-f]{32}$/);
      expect(result.name).toBe('My Token');
      expect(result.lastChars).toHaveLength(4);
      expect(result.id).toBe('pat-1');
      expect(prisma.personalAccessToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'My Token',
          tokenHash: expect.any(String),
          lastChars: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should set expiration to ~1 day for "1d"', async () => {
      prisma.personalAccessToken.create.mockImplementation(({ data }: any) => ({
        id: 'pat-1',
        ...data,
        createdAt: new Date(),
      }));

      const before = Date.now();
      const result = await service.createPat('user-1', 'Short', '1d');
      const expiresMs = new Date(result.expiresAt).getTime();

      // Should expire in ~24h (within a 1-minute tolerance)
      const oneDayMs = 24 * 60 * 60 * 1000;
      expect(expiresMs).toBeGreaterThan(before + oneDayMs - 60_000);
      expect(expiresMs).toBeLessThan(before + oneDayMs + 60_000);
    });

    it('should set expiration to ~100 years for "never"', async () => {
      prisma.personalAccessToken.create.mockImplementation(({ data }: any) => ({
        id: 'pat-1',
        ...data,
        createdAt: new Date(),
      }));

      const result = await service.createPat('user-1', 'Forever', 'never');
      const expiresYear = new Date(result.expiresAt).getFullYear();

      expect(expiresYear).toBeGreaterThanOrEqual(new Date().getFullYear() + 99);
    });
  });

  describe('validatePat', () => {
    it('should return user for a valid token', async () => {
      const rawToken = 'clip_abcdef1234567890abcdef1234567890';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      prisma.personalAccessToken.findUnique.mockResolvedValue({
        id: 'pat-1',
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400_000),
        user: mockUser,
      });

      const result = await service.validatePat(rawToken);

      expect(result).toEqual(mockUser);
    });

    it('should return null for non-clip_ token', async () => {
      const result = await service.validatePat('some-jwt-token');
      expect(result).toBeNull();
      expect(prisma.personalAccessToken.findUnique).not.toHaveBeenCalled();
    });

    it('should return null for revoked token', async () => {
      const rawToken = 'clip_abcdef1234567890abcdef1234567890';
      prisma.personalAccessToken.findUnique.mockResolvedValue({
        id: 'pat-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400_000),
        user: mockUser,
      });

      const result = await service.validatePat(rawToken);
      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      const rawToken = 'clip_abcdef1234567890abcdef1234567890';
      prisma.personalAccessToken.findUnique.mockResolvedValue({
        id: 'pat-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 86400_000),
        user: mockUser,
      });

      const result = await service.validatePat(rawToken);
      expect(result).toBeNull();
    });

    it('should return null for inactive user', async () => {
      const rawToken = 'clip_abcdef1234567890abcdef1234567890';
      prisma.personalAccessToken.findUnique.mockResolvedValue({
        id: 'pat-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400_000),
        user: { ...mockUser, isActive: false },
      });

      const result = await service.validatePat(rawToken);
      expect(result).toBeNull();
    });

    it('should return null for unknown token', async () => {
      const rawToken = 'clip_0000000000000000000000000000000000';
      prisma.personalAccessToken.findUnique.mockResolvedValue(null);

      const result = await service.validatePat(rawToken);
      expect(result).toBeNull();
    });
  });

  describe('listPats', () => {
    it('should return tokens without raw values', async () => {
      const tokens = [
        { id: 'pat-1', name: 'Token 1', lastChars: 'ab12', expiresAt: new Date(), createdAt: new Date(), revokedAt: null },
        { id: 'pat-2', name: 'Token 2', lastChars: 'cd34', expiresAt: new Date(), createdAt: new Date(), revokedAt: new Date() },
      ];
      prisma.personalAccessToken.findMany.mockResolvedValue(tokens);

      const result = await service.listPats('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('tokenHash');
      expect(result[0]).not.toHaveProperty('token');
      expect(prisma.personalAccessToken.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: {
          id: true,
          name: true,
          lastChars: true,
          expiresAt: true,
          createdAt: true,
          revokedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('revokePat', () => {
    it('should set revokedAt on the token', async () => {
      prisma.personalAccessToken.findUnique.mockResolvedValue({
        id: 'pat-1',
        userId: 'user-1',
      });
      prisma.personalAccessToken.update.mockResolvedValue({});

      await service.revokePat('user-1', 'pat-1');

      expect(prisma.personalAccessToken.update).toHaveBeenCalledWith({
        where: { id: 'pat-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw if token belongs to another user', async () => {
      prisma.personalAccessToken.findUnique.mockResolvedValue({
        id: 'pat-1',
        userId: 'user-2',
      });

      await expect(service.revokePat('user-1', 'pat-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw if token does not exist', async () => {
      prisma.personalAccessToken.findUnique.mockResolvedValue(null);

      await expect(service.revokePat('user-1', 'pat-999')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
