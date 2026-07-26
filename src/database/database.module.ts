import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getPostgresConnectionOptions } from './postgres.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const url = configService.getOrThrow<string>('DATABASE_URL');

        return {
          ...getPostgresConnectionOptions(url),
          autoLoadEntities: true,
          synchronize: true, // Use migrations instead of auto-sync
          logging: ['error', 'warn', 'schema', 'migration'],
          logger: 'advanced-console',
          maxQueryExecutionTime: 5000,
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
