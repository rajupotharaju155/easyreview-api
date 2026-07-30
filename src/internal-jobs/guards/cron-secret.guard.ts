import { timingSafeEqual } from 'node:crypto';

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Requires header `x-cron-secret` to match env `CRON_SECRET`.
 * Used by Cloud Scheduler → internal job endpoints.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('CRON_SECRET');
    if (!expected) {
      throw new UnauthorizedException('CRON_SECRET is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-cron-secret'];
    if (typeof provided !== 'string' || !secureEquals(provided, expected)) {
      throw new UnauthorizedException('Invalid or missing cron secret');
    }

    return true;
  }
}

function secureEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}
