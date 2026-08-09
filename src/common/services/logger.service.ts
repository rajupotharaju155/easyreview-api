import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

interface LogContext {
  [key: string]: any;
}

const GCP_SEVERITY: Record<string, string> = {
  ERROR: 'ERROR',
  WARN: 'WARNING',
  INFO: 'INFO',
};

/**
 * Custom logger service with structured JSON logging for Cloud Logging.
 * Provides three log levels: info, warn, and error.
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private context?: string;

  /**
   * Set the context for the logger (usually the class name)
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Log an error message
   */
  error(
    message: any,
    trace?: string,
    context?: string,
    meta?: LogContext,
  ): void {
    this.writeLog('ERROR', message, {
      trace,
      context: context || this.context,
      ...meta,
    });
  }

  /**
   * Log a warning message
   */
  warn(message: any, context?: string, meta?: LogContext): void {
    this.writeLog('WARN', message, {
      context: context || this.context,
      ...meta,
    });
  }

  /**
   * Log an informational message
   */
  log(message: any, context?: string, meta?: LogContext): void {
    this.writeLog('INFO', message, {
      context: context || this.context,
      ...meta,
    });
  }

  /**
   * Alias for log() for convenience
   */
  info(message: any, context?: string, meta?: LogContext): void {
    this.log(message, context, meta);
  }

  /**
   * Alias for log() to maintain NestJS LoggerService compatibility
   */
  debug(message: any, context?: string, meta?: LogContext): void {
    this.log(message, context, meta);
  }

  /**
   * Alias for log() to maintain NestJS LoggerService compatibility
   */
  verbose(message: any, context?: string, meta?: LogContext): void {
    this.log(message, context, meta);
  }

  /**
   * Write log as a single-line JSON object so Cloud Logging stores jsonPayload.
   * Uses `severity` so GCP maps the level correctly in Logs Explorer.
   */
  private writeLog(level: string, message: any, meta: LogContext = {}): void {
    const context = meta.context || this.context;
    const messageStr =
      typeof message === 'string' ? message : JSON.stringify(message);

    if (context === 'RouterExplorer' || context === 'RoutesResolver') {
      return;
    }

    if (
      typeof messageStr === 'string' &&
      (messageStr.includes('Mapped {') || messageStr.includes('route'))
    ) {
      return;
    }

    const {
      context: _context,
      trace,
      details,
      httpRequest,
      ...fields
    } = meta;
    const nestedDetails =
      details && typeof details === 'object' && !Array.isArray(details)
        ? { ...details, ...fields }
        : Object.keys(fields).length > 0
          ? { ...fields }
          : details;

    // Root special fields (severity, message, httpRequest) are hoisted by Cloud
    // Logging. Method/status/latency pills come from httpRequest; keep bodies
    // and userAgent under details so they only appear when expanded.
    const logEntry: Record<string, unknown> = {
      severity: GCP_SEVERITY[level] || 'INFO',
      message: messageStr,
      ...(httpRequest ? { httpRequest } : {}),
      ...(context ? { context } : {}),
      ...(trace ? { trace } : {}),
      ...(nestedDetails && Object.keys(nestedDetails).length > 0
        ? { details: nestedDetails }
        : {}),
    };

    const logLine = JSON.stringify(logEntry);

    switch (level) {
      case 'ERROR':
        console.error(logLine);
        break;
      case 'WARN':
        console.warn(logLine);
        break;
      default:
        console.log(logLine);
    }
  }
}
