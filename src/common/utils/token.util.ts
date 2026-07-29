import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { User } from '../../users/entities/user.entity';

export function validatePassword(password: string): boolean {
  return password.length >= 8;
}

export async function generateHashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function tokenExpiry(hours = 24): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function generateTokens(
  user: User,
  jwtService: JwtService,
  configService: ConfigService,
): Promise<{ accessToken: string; refreshToken: string }> {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
  };

  const accessExpiresIn = configService.getOrThrow<string>(
    'JWT_ACCESS_TOKEN_EXPIRATION',
  ) as `${number}d` | `${number}h` | `${number}m` | `${number}s`;
  const refreshExpiresIn = configService.getOrThrow<string>(
    'JWT_REFRESH_TOKEN_EXPIRATION',
  ) as `${number}d` | `${number}h` | `${number}m` | `${number}s`;

  const accessToken = await jwtService.signAsync(payload, {
    expiresIn: accessExpiresIn,
  });

  const refreshToken = await jwtService.signAsync(payload, {
    expiresIn: refreshExpiresIn,
  });

  return { accessToken, refreshToken };
}
