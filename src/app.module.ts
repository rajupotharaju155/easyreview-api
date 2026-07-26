import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { BusinessesModule } from './businesses/businesses.module';
import { CommonModule } from './common/common.module';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { LoggerService } from './common/services/logger.service';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';

/**
 * Loads env file based on NODE_ENV.
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePath(),
      ignoreEnvFile: false,
    }),
    CommonModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    UsersModule,
    BusinessesModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
})
export class AppModule {}
