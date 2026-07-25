import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

interface LogContext {
  [key: string]: any;
}

/**
 * Custom logger service with structured logging.
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
   * Write log in structured JSON format
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

    const logEntry = {
      ...(meta.url && { url: meta.url }),
      ...(meta.method && { method: meta.method }),
      ...(meta.statusCode && { statusCode: meta.statusCode }),
      ...(meta.duration && { duration: meta.duration }),
      ...(meta.query && { query: meta.query }),
      ...(meta.params && { params: meta.params }),
      ...(meta.body && { body: meta.body }),
      ...(meta.userAgent && { userAgent: meta.userAgent }),
      ...(meta.ip && { ip: meta.ip }),
      level,
      message: messageStr,
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
