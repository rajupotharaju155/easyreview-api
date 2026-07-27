import { existsSync } from 'node:fs';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from './auth/guards/email-verified.guard';
import { CommonModule } from './common/common.module';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { LoggerService } from './common/services/logger.service';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { LocationsModule } from './locations/locations.module';
import { ReviewModule } from './review/review.module';
import { UsersModule } from './users/users.module';

/**
 * Loads env file based on NODE_ENV.
 * Cloud Run / Docker inject env vars directly, so the file is optional there.
 */
function getEnvFilePath(): string {
  const nodeEnv = process.env.NODE_ENV;
  const logger = new LoggerService();
  logger.setContext('AppModule');

  switch (nodeEnv) {
    case 'development':
      logger.log('[app.module.ts] Loading .env.development');
      return '.env.development';
    case 'staging':
      logger.log('[app.module.ts] Loading .env.staging');
      return '.env.staging';
    case 'production':
      logger.log('[app.module.ts] Loading .env.production');
      return '.env.production';
    default:
      throw new Error(
        `Unsupported NODE_ENV "${nodeEnv ?? ''}". Use "development", "staging", or "production".`,
      );
  }
}

const envFilePath = getEnvFilePath();
// K_SERVICE is set automatically on Cloud Run.
const ignoreEnvFile =
  Boolean(process.env.K_SERVICE) || !existsSync(envFilePath);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      ignoreEnvFile,
    }),
    CommonModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    UsersModule,
    LocationsModule,
    ReviewModule,
    EmailModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: EmailVerifiedGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
})
export class AppModule {}
