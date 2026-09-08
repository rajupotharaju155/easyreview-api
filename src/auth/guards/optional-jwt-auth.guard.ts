import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Authenticates a bearer token when present; otherwise continues as a guest. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    _err: unknown,
    user: TUser,
    _info?: unknown,
    _context?: ExecutionContext,
    _status?: unknown,
  ): TUser {
    return (user ?? null) as TUser;
  }
}
