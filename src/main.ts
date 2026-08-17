import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';

import { AppModule } from './app.module';
import { LoggerService } from './common/services/logger.service';

async function bootstrap() {
  console.log('[INFO] [Bootstrap] Starting application...');
  console.log('[INFO] [Bootstrap] NODE_ENV:', process.env.NODE_ENV);

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const logger = app.get(LoggerService);
  logger.setContext('Bootstrap');

  app.useLogger(logger);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
  });

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`Server is running at http://0.0.0.0:${port}/`, 'Bootstrap', {
    port,
    environment: process.env.NODE_ENV || 'production',
  });
}

bootstrap().catch((error) => {
  console.error('\n[BOOTSTRAP ERROR] Failed to start application:');
  console.error('Error Name:', error.name);
  console.error('Error Message:', error.message);
  if (error.stack) {
    console.error('Stack Trace:', error.stack);
  }
  process.exit(1);
});
