import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { User } from '../../users/entities/user.entity';

/**
 * Request-scoped helper for reading the authenticated user from anywhere.
 */
@Injectable({ scope: Scope.REQUEST })
export class CurrentUserUtil {
  constructor(@Inject(REQUEST) private readonly request: any) {}

  getCurrentUser(): User {
    const user = this.request.currentUser || this.request.user;
    if (!user) {
      throw new Error(
        '[ERROR] No current user found in request context. Make sure the RequestContextInterceptor is properly configured and user is authenticated.',
      );
    }
    return user;
  }

  getCurrentUserOrNull(): User | null {
    return this.request.currentUser || this.request.user || null;
  }

  isAuthenticated(): boolean {
    return this.getCurrentUserOrNull() !== null;
  }

  getCurrentUserId(): string {
    return this.getCurrentUser().id;
  }

  getCurrentUserEmail(): string {
    return this.getCurrentUser().email;
  }

  getCurrentUserName(): string | null {
    return this.getCurrentUser().name ?? null;
  }
}
