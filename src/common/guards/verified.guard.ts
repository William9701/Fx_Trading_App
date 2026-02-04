import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

// Only verified users can hit trading endpoints
@Injectable()
export class VerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.isVerified) {
      throw new ForbiddenException(
        'Please verify your email before accessing this feature',
      );
    }

    return true;
  }
}
