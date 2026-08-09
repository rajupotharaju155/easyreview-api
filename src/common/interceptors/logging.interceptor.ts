import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../services/logger.service';

const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|authorization|api[_-]?key|cookie|refresh/i;

const MAX_BODY_CHARS = 8_000;

/**
 * Interceptor to log HTTP requests and responses (with sensitive field redaction).
 * Emits Cloud Logging `httpRequest` so Logs Explorer shows method/status/latency pills.
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
    const requestUrl = request.originalUrl || url;

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const durationMs = Date.now() - startTime;

          // Message is just the URL so the collapsed line matches Cloud Run style:
          // [PATCH] [200] [47 ms] /hq/orders/...
          // Do NOT put userAgent / responseSize in httpRequest — those become pills.
          this.logger.log(requestUrl, 'HTTP', {
            httpRequest: {
              requestMethod: method,
              requestUrl,
              status: statusCode,
              latency: `${(durationMs / 1000).toFixed(3)}s`,
            },
            details: {
              query,
              params,
              requestBody: this.sanitize(body),
              responseBody: this.sanitize(responseBody),
              userAgent: request.headers['user-agent'],
              ip: request.ip || request.connection?.remoteAddress,
              durationMs,
            },
          });
        },
        error: (error) => {
          const durationMs = Date.now() - startTime;
          const response = context.switchToHttp().getResponse();
          const statusCode = error.status || response.statusCode || 500;

          this.logger.error(requestUrl, error.stack, 'HTTP', {
            httpRequest: {
              requestMethod: method,
              requestUrl,
              status: statusCode,
              latency: `${(durationMs / 1000).toFixed(3)}s`,
            },
            details: {
              query,
              params,
              requestBody: this.sanitize(body),
              error: error.message,
              durationMs,
            },
          });
        },
      }),
    );
  }

  private sanitize(value: unknown): unknown {
    const redacted = this.redact(value);
    return this.truncate(redacted);
  }

  private redact(value: unknown, depth = 0): unknown {
    if (value == null || typeof value !== 'object' || depth > 6) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.redact(item, depth + 1));
    }

    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? '[REDACTED]'
        : this.redact(nested, depth + 1);
    }
    return out;
  }

  private truncate(value: unknown): unknown {
    try {
      const serialized = JSON.stringify(value);
      if (serialized == null) {
        return value;
      }
      if (serialized.length <= MAX_BODY_CHARS) {
        return value;
      }
      return {
        _truncated: true,
        preview: serialized.slice(0, MAX_BODY_CHARS),
      };
    } catch {
      return '[Unserializable]';
    }
  }
}
