import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { LoggerService } from './common/services/logger.service';
import { HealthModule } from './health/health.module';

/**
 * Determines which environment file to load based on NODE_ENV
 */
function getEnvFilePath(): string | string[] {
  const nodeEnv = process.env.NODE_ENV;
  const logger = new LoggerService();
  logger.setContext('AppModule');

  switch (nodeEnv) {
    case 'local':
      logger.log('[app.module.ts] Loading .env.local for local development');
      return ['.env.local'];
    case 'staging':
      logger.log('[app.module.ts] Loading .env.staging for staging');
      return ['.env.staging'];
    default:
      logger.log(
        '[app.module.ts] NODE_ENV not set, Loading .env for production',
      );
      return '.env';
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
    HealthModule,
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
