import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../interfaces/authenticated-user.interface';

interface FastifyRequestWithUser {
  user?: RequestUser;
}

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FastifyRequestWithUser>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
