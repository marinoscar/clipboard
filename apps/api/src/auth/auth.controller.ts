import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, FullTokenResponse } from './auth.service';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequestUser } from './interfaces/authenticated-user.interface';
import { GoogleProfile } from './strategies/google.strategy';

const REFRESH_TOKEN_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: 14 * 24 * 60 * 60, // 14 days in seconds
};

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET /auth/providers
   */
  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'List enabled OAuth providers' })
  async getProviders() {
    return {
      data: {
        providers: [{ name: 'google', enabled: true }],
      },
    };
  }

  /**
   * GET /auth/google
   */
  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth' })
  async googleAuth() {
    // Guard handles the redirect to Google
  }

  /**
   * GET /auth/google/callback
   */
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(
    @Req() req: FastifyRequest & { user?: GoogleProfile },
    @Res() res: FastifyReply,
  ) {
    try {
      const profile = req.user;
      if (!profile) {
        this.logger.error('No profile found in Google OAuth callback');
        const appUrl = this.configService.get<string>('appUrl');
        return res.redirect(`${appUrl}/auth/callback?error=authentication_failed`);
      }
      const tokens = await this.authService.handleGoogleLogin(profile);
      return this.handleOAuthRedirect(res, tokens);
    } catch (error) {
      return this.handleOAuthError(res, error);
    }
  }

  private handleOAuthRedirect(
    res: FastifyReply,
    tokens: FullTokenResponse,
  ): void {
    res.setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken!, COOKIE_OPTIONS);
    const appUrl = this.configService.get<string>('appUrl');
    const redirectUrl = new URL('/auth/callback', appUrl);
    redirectUrl.searchParams.set('token', tokens.accessToken);
    redirectUrl.searchParams.set('expiresIn', tokens.expiresIn.toString());
    res.status(302).redirect(redirectUrl.toString());
  }

  private handleOAuthError(res: FastifyReply, error: unknown): void {
    this.logger.error('Error in OAuth callback', error);
    const appUrl = this.configService.get<string>('appUrl');
    const errorMessage = error instanceof Error
      ? encodeURIComponent(error.message.replace(/[\r\n]/g, ' ').substring(0, 200))
      : 'authentication_failed';
    res.redirect(`${appUrl}/auth/callback?error=${errorMessage}`);
  }

  /**
   * GET /auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  async getCurrentUser(@CurrentUser() user: RequestUser) {
    const currentUser = await this.authService.getCurrentUser(user.id);
    return { data: currentUser };
  }

  /**
   * POST /auth/refresh
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const tokens = await this.authService.refreshAccessToken(refreshToken);

    res.setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken!, COOKIE_OPTIONS);

    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    };
  }

  /**
   * POST /auth/logout
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout' })
  async logout(
    @CurrentUser() user: RequestUser,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<void> {
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE];
    await this.authService.logout(user.id, refreshToken);
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/auth' });
  }
}
