import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../services/logger.service';

/**
 * Interceptor to log HTTP requests and responses
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('LoggingInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const duration = Date.now() - startTime;

          this.logger.log('Request completed', 'HTTP', {
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
            query,
            params,
            body: this.sanitizeBody(body),
            userAgent: request.headers['user-agent'],
            ip: request.ip || request.connection?.remoteAddress,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode || 500;

          this.logger.error('Request failed', error.stack, 'HTTP', {
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
            query,
            params,
            body: this.sanitizeBody(body),
            error: error.message,
          });
        },
      }),
    );
  }

  private sanitizeBody(body: Record<string, any>): Record<string, any> {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveKeys = ['password', 'token', 'secret', 'authorization'];
    const sanitized = { ...body };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
