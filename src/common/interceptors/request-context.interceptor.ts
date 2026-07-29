import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { isHqAdmin } from '../../hq/hq-admin.interface';
import { User } from '../../users/entities/user.entity';

/**
 * Attaches request id and authenticated user for downstream handlers.
 * HQ tokens skip currentUser assignment (no agency User entity).
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    request.requestId =
      request.headers['x-request-id'] ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const user: User | undefined = request.user;
    if (user && !isHqAdmin(user)) {
      request.currentUser = user;
    }

    return next.handle();
  }
}
