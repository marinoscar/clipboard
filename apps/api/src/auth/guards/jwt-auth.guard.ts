import { ExecutionContext, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private authService?: AuthService;

  constructor(
    private reflector: Reflector,
    private moduleRef: ModuleRef,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Check for PAT (Personal Access Token)
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (authHeader && typeof authHeader === 'string') {
      const [scheme, token] = authHeader.split(' ');
      if (scheme === 'Bearer' && token?.startsWith('clip_')) {
        if (!this.authService) {
          this.authService = this.moduleRef.get(AuthService, { strict: false });
        }
        const user = await this.authService.validatePat(token);
        if (user) {
          request.user = {
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin,
            isActive: user.isActive,
          };
          return true;
        }
      }
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
