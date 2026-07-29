import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { isHqAdmin } from '../hq-admin.interface';

/**
 * Ensures the authenticated principal is an HQ admin (not an agency user).
 */
@Injectable()
export class HqGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    if (!isHqAdmin(request.user)) {
      throw new ForbiddenException('HQ admin access required');
    }
    return true;
  }
}
