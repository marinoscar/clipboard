import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleProfile } from './strategies/google.strategy';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

export interface FullTokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Handles Google OAuth login
   */
  async handleGoogleLogin(profile: GoogleProfile): Promise<FullTokenResponse> {
    this.logger.log(`Google login attempt for email: ${profile.email}`);

    const email = profile.email.toLowerCase();

    // Check if user already exists by googleId
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.id },
    });

    if (!user) {
      // Check if user exists by email (shouldn't happen but handle gracefully)
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        // Update existing user with googleId
        user = await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { googleId: profile.id },
        });
      } else {
        // Create new user
        this.logger.log(`Creating new user: ${email}`);

        // Check if this should be the initial admin
        const userCount = await this.prisma.user.count();
        const initialAdminEmail = this.configService.get<string>('initialAdminEmail');
        const shouldBeAdmin = userCount === 0 ||
          (initialAdminEmail && email === initialAdminEmail.toLowerCase());

        user = await this.prisma.user.create({
          data: {
            email,
            displayName: profile.displayName,
            profileImageUrl: profile.picture || null,
            googleId: profile.id,
            isAdmin: shouldBeAdmin || false,
          },
        });

        if (shouldBeAdmin) {
          this.logger.log(`Admin role assigned to first user: ${email}`);
        }
      }
    }

    // Update profile info from provider
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        displayName: user.displayName || profile.displayName,
        profileImageUrl: user.profileImageUrl || profile.picture || null,
      },
    });

    // Check if user is disabled
    if (!user.isActive) {
      this.logger.warn(`Login attempt by disabled user: ${user.email}`);
      throw new ForbiddenException('User account is disabled');
    }

    // Generate JWT tokens
    const tokens = await this.generateFullTokens(user);

    this.logger.log(`Login successful for user: ${user.email}`);
    return tokens;
  }

  /**
   * Generate both access and refresh tokens
   */
  async generateFullTokens(user: {
    id: string;
    email: string;
    isAdmin: boolean;
  }): Promise<FullTokenResponse> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken: accessToken.token,
      expiresIn: accessToken.expiresIn,
      refreshToken,
    };
  }

  /**
   * Generate access token only
   */
  private generateAccessToken(user: {
    id: string;
    email: string;
    isAdmin: boolean;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
    };

    const accessTtlMinutes = this.configService.get<number>(
      'jwt.accessTtlMinutes',
      15,
    );

    return {
      token: this.jwtService.sign(payload),
      expiresIn: accessTtlMinutes * 60,
    };
  }

  /**
   * Create a new refresh token
   */
  private async createRefreshToken(userId: string): Promise<string> {
    const refreshTtlDays = this.configService.get<number>(
      'jwt.refreshTtlDays',
      14,
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshTtlDays);

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return token;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<FullTokenResponse> {
    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      await this.revokeAllUserTokens(storedToken.userId);
      this.logger.warn(
        `Refresh token reuse detected for user: ${storedToken.userId}`,
      );
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    if (!storedToken.user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Rotate token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const newRefreshToken = await this.createRefreshToken(storedToken.userId);
    const accessToken = this.generateAccessToken(storedToken.user);

    return {
      accessToken: accessToken.token,
      expiresIn: accessToken.expiresIn,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, userId },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.revokeAllUserTokens(userId);
    }
    this.logger.log(`User logged out: ${userId}`);
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    });
    this.logger.log(`Cleaned up ${result.count} expired/revoked tokens`);
    return result.count;
  }

  // ── Personal Access Tokens ──

  async createPat(
    userId: string,
    name: string,
    expiration: '1d' | '30d' | 'never',
  ) {
    const rawToken = 'clip_' + randomBytes(16).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const lastChars = rawToken.slice(-4);

    const expiresAt = new Date();
    if (expiration === '1d') {
      expiresAt.setDate(expiresAt.getDate() + 1);
    } else if (expiration === '30d') {
      expiresAt.setDate(expiresAt.getDate() + 30);
    } else {
      // 'never' = 100 years
      expiresAt.setFullYear(expiresAt.getFullYear() + 100);
    }

    const pat = await this.prisma.personalAccessToken.create({
      data: { userId, name, tokenHash, lastChars, expiresAt },
    });

    return {
      token: rawToken,
      id: pat.id,
      name: pat.name,
      lastChars: pat.lastChars,
      expiresAt: pat.expiresAt,
      createdAt: pat.createdAt,
    };
  }

  async validatePat(rawToken: string): Promise<AuthenticatedUser | null> {
    if (!rawToken.startsWith('clip_')) return null;

    const tokenHash = this.hashToken(rawToken);
    const pat = await this.prisma.personalAccessToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!pat) return null;
    if (pat.revokedAt) return null;
    if (pat.expiresAt < new Date()) return null;
    if (!pat.user.isActive) return null;

    return pat.user;
  }

  async listPats(userId: string) {
    return this.prisma.personalAccessToken.findMany({
      where: { userId },
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
  }

  async revokePat(userId: string, patId: string) {
    const pat = await this.prisma.personalAccessToken.findUnique({
      where: { id: patId },
    });

    if (!pat || pat.userId !== userId) {
      throw new UnauthorizedException('Token not found');
    }

    await this.prisma.personalAccessToken.update({
      where: { id: patId },
      data: { revokedAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Validates JWT payload and returns user
   */
  async validateJwtPayload(payload: JwtPayload): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }

  /**
   * Returns current user details
   */
  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      profileImageUrl: user.profileImageUrl,
      isActive: user.isActive,
      isAdmin: user.isAdmin,
    };
  }
}
