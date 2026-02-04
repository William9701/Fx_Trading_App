import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { User } from '../../modules/auth/entities/user.entity';

// Pull the authenticated user off the request without repeating request.user everywhere
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as User;
    return data ? user?.[data] : user;
  },
);
