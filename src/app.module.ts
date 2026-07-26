import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { LoggerService } from './common/services/logger.service';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

/**
 * Loads env file for staging or production only.
 */
function getEnvFilePath(): string {
  const nodeEnv = process.env.NODE_ENV;
  const logger = new LoggerService();
  logger.setContext('AppModule');

  switch (nodeEnv) {
    case 'staging':
      logger.log('[app.module.ts] Loading .env.staging');
      return '.env.staging';
    case 'production':
      logger.log('[app.module.ts] Loading .env.production');
      return '.env.production';
    default:
      throw new Error(
        `Unsupported NODE_ENV "${nodeEnv ?? ''}". Use "staging" or "production".`,
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
    PrismaModule,
    HealthModule,
    UsersModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
})
export class AppModule {}
