import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { getPostgresConnectionOptions } from './src/database/postgres.config';

/**
 * Load environment files based on NODE_ENV (same logic as app.module.ts)
 */
function loadEnvironmentConfig() {
  const nodeEnv = process.env.NODE_ENV;

  console.log(`[INFO] TypeORM Environment detected: ${nodeEnv || 'undefined'}`);

  switch (nodeEnv) {
    case 'development':
      config({ path: '.env.development' });
      console.log('[INFO] TypeORM loaded .env.development successfully');
      break;

    case 'staging':
      config({ path: '.env.staging' });
      console.log('[INFO] TypeORM loaded .env.staging successfully');
      break;

    case 'production':
      config({ path: '.env.production' });
      console.log('[INFO] TypeORM loaded .env.production successfully');
      break;

    default:
      config({ path: '.env' });
      console.log('[INFO] TypeORM loaded .env for production');
      break;
  }
}

// Load the appropriate environment configuration
loadEnvironmentConfig();

const configService = new ConfigService();
const url = configService.getOrThrow<string>('DATABASE_URL');

export default new DataSource({
  ...getPostgresConnectionOptions(url),
  entities: ['**/*.entity.ts'],
  migrations: ['migrations/*.ts'],
  synchronize: false,
  logging: true,
});
