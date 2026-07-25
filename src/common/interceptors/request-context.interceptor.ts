import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Interceptor to attach request context for downstream handlers
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    request.requestId =
      request.headers['x-request-id'] ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return next.handle();
  }
}
