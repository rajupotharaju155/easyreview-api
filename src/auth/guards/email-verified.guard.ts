import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ALLOW_UNVERIFIED_KEY } from '../../common/decorators/allow-unverified.decorator';
import { isHqAdmin } from '../../hq/hq-admin.interface';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const allowUnverified = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNVERIFIED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowUnverified) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user;
    if (isHqAdmin(user)) {
      return true;
    }
    if (!user?.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email before accessing this resource.',
      );
    }

    return true;
  }
}
