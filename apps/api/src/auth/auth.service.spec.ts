import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

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

const mockGoogleProfile = {
  id: 'google-123',
  email: 'test@example.com',
  displayName: 'Test User',
  picture: 'https://example.com/photo.jpg',
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          'jwt.accessTtlMinutes': 15,
          'jwt.refreshTtlDays': 14,
          'initialAdminEmail': null,
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('handleGoogleLogin', () => {
    it('should login existing user by googleId', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      prisma.refreshToken.create.mockResolvedValue({ id: 'token-1' });

      const result = await service.handleGoogleLogin(mockGoogleProfile);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: 'google-123' },
      });
    });

    it('should link googleId when pre-registered user logs in by email', async () => {
      const preRegistered = { ...mockUser, googleId: null };
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // googleId lookup
        .mockResolvedValueOnce(preRegistered); // email lookup
      prisma.user.update.mockResolvedValue(mockUser);
      prisma.refreshToken.create.mockResolvedValue({ id: 'token-1' });

      const result = await service.handleGoogleLogin(mockGoogleProfile);

      expect(result).toHaveProperty('accessToken');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: preRegistered.id },
          data: expect.objectContaining({
            googleId: 'google-123',
          }),
        }),
      );
    });

    it('should reject unregistered email with ForbiddenException', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // googleId lookup
        .mockResolvedValueOnce(null); // email lookup

      await expect(
        service.handleGoogleLogin(mockGoogleProfile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should auto-create initial admin from INITIAL_ADMIN_EMAIL', async () => {
      configService.get.mockImplementation((key: string, def?: any) => {
        if (key === 'initialAdminEmail') return 'test@example.com';
        const c: Record<string, any> = { 'jwt.accessTtlMinutes': 15, 'jwt.refreshTtlDays': 14 };
        return c[key] ?? def;
      });

      prisma.user.findUnique
        .mockResolvedValueOnce(null) // googleId lookup
        .mockResolvedValueOnce(null); // email lookup
      prisma.user.create.mockResolvedValue({ ...mockUser, isAdmin: true });
      prisma.user.update.mockResolvedValue({ ...mockUser, isAdmin: true });
      prisma.refreshToken.create.mockResolvedValue({ id: 'token-1' });

      await service.handleGoogleLogin(mockGoogleProfile);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isAdmin: true,
            email: 'test@example.com',
          }),
        }),
      );
    });

    it('should throw ForbiddenException for disabled user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      prisma.user.update.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(
        service.handleGoogleLogin(mockGoogleProfile),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const tokenHash = createHash('sha256').update('valid-token').digest('hex');
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        user: mockUser,
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-2' });

      const result = await service.refreshAccessToken('valid-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt-1' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('should throw for invalid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.refreshAccessToken('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw and revoke all tokens for reused token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: new Date(), // already revoked
        user: mockUser,
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await expect(
        service.refreshAccessToken('reused-token'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', revokedAt: null },
        }),
      );
    });

    it('should throw for expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 86400000), // expired
        revokedAt: null,
        user: mockUser,
      });

      await expect(
        service.refreshAccessToken('expired-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateJwtPayload', () => {
    it('should return user for valid payload', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.validateJwtPayload({
        sub: 'user-1',
        email: 'test@example.com',
        isAdmin: false,
      });

      expect(result).toEqual(mockUser);
    });

    it('should return null for inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const result = await service.validateJwtPayload({
        sub: 'user-1',
        email: 'test@example.com',
        isAdmin: false,
      });

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateJwtPayload({
        sub: 'non-existent',
        email: 'test@example.com',
        isAdmin: false,
      });

      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should revoke specific refresh token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('user-1', 'some-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });

    it('should revoke all tokens when no specific token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.logout('user-1');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired and revoked tokens', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { revokedAt: { not: null } },
          ],
        },
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return user details', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser('user-1');

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        profileImageUrl: null,
        isActive: true,
        isAdmin: false,
      });
    });

    it('should throw for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentUser('non-existent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('listUsers', () => {
    it('should return all users', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);
      const result = await service.listUsers();
      expect(result).toHaveLength(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
      );
    });
  });

  describe('addAllowedUser', () => {
    it('should create a placeholder user with no googleId', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-1',
        email: 'new@example.com',
        isActive: true,
        isAdmin: false,
        createdAt: new Date(),
      });

      const result = await service.addAllowedUser('New@Example.com');

      expect(result.email).toBe('new@example.com');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          isActive: true,
          isAdmin: false,
        },
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.addAllowedUser('test@example.com')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('removeUser', () => {
    it('should delete the user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.delete.mockResolvedValue(mockUser);

      await service.removeUser('admin-1', 'user-1');

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should throw BadRequestException when removing self', async () => {
      await expect(service.removeUser('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.removeUser('admin-1', 'non-existent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
