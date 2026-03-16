import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { RequestUser } from '../../auth/interfaces/authenticated-user.interface';

interface FastifyRequestWithUser {
  user?: RequestUser;
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequestWithUser>();
    const user = request.user;

    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
