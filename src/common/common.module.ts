import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { LoggerService } from './services/logger.service';
import { CurrentUserUtil } from './utils/current-user.util';

@Global()
@Module({
  providers: [
    CurrentUserUtil,
    LoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  exports: [CurrentUserUtil, LoggerService],
})
export class CommonModule {}
