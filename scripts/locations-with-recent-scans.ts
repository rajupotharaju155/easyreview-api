/**
 * Print locations with ≥1 QR scan in the last 14 days (UTC).
 *
 * From easyreview-api:
 *   NODE_ENV=staging yarn script:recent-scans
 *   NODE_ENV=development yarn script:recent-scans
 *   NODE_ENV=production yarn script:recent-scans
 */
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { getPostgresConnectionOptions } from '../src/database/postgres.config';
import { Location } from '../src/locations/entities/location.entity';

const LOOKBACK_DAYS = 7;

function loadEnvironmentConfig(): void {
  const nodeEnv = process.env.NODE_ENV;
  console.error(`[INFO] Environment: ${nodeEnv || 'undefined'}`);

  switch (nodeEnv) {
    case 'development':
      config({ path: '.env.development' });
      break;
    case 'staging':
      config({ path: '.env.staging' });
      break;
    case 'production':
      config({ path: '.env.production' });
      break;
    default:
      throw new Error(
        `Set NODE_ENV to development, staging, or production. Example:\n  NODE_ENV=staging yarn script:recent-scans`,
      );
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

async function main(): Promise<void> {
  loadEnvironmentConfig();

  const url = new ConfigService().getOrThrow<string>('DATABASE_URL');
  const dataSource = new DataSource({
    ...getPostgresConnectionOptions(url),
    entities: ['src/**/*.entity.ts'],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();

  const fromDate = addDays(todayUtc(), -(LOOKBACK_DAYS - 1));
  const rows: Array<{ id: string; name: string; lastScanDate: string }> =
    await dataSource
      .getRepository(Location)
      .createQueryBuilder('location')
      .innerJoin('location.scanMetrics', 'metric')
      .where('metric.scanCount > :minScans', { minScans: 0 })
      .andWhere('metric.date >= :fromDate', { fromDate })
      .select('location.id', 'id')
      .addSelect('location.name', 'name')
      .addSelect('MAX(metric.date)', 'lastScanDate')
      .groupBy('location.id')
      .addGroupBy('location.name')
      .orderBy('MAX(metric.date)', 'DESC')
      .addOrderBy('location.name', 'ASC')
      .getRawMany();

  await dataSource.destroy();

  console.log(
    `Locations with ≥1 QR scan since ${fromDate} (last ${LOOKBACK_DAYS} days, UTC):`,
  );
  console.log(`locationId\tname\tlastScanDate`);
  for (const row of rows) {
    console.log(`${row.id}\t${row.name}\t${row.lastScanDate}`);
  }
  console.log(`(${rows.length} location${rows.length === 1 ? '' : 's'})`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
