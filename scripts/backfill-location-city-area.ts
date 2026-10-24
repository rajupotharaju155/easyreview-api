/**
 * Re-derive city and localArea for every location from its formattedAddress,
 * including soft-deleted rows. Earlier saves stored the most specific
 * sublocality as city (e.g. "Boosareddy Guda" instead of "Secunderabad").
 *
 * formattedAddress reads street → local area → city → state + postal code →
 * country, so after dropping the country and state segments the last segment
 * is the city and, for Indian addresses, the one before it is the local area.
 * Other countries rarely list a local area, so localArea stays null there.
 * Rows whose city cannot be derived are skipped and left unchanged.
 *
 * The localArea column must exist (start the API once so TypeORM syncs it).
 *
 * 1. Leave DRY_RUN = true and inspect the plan.
 * 2. Set DRY_RUN = false and run against the target env:
 *      NODE_ENV=staging yarn script:backfill-location-city-area
 *      NODE_ENV=development yarn script:backfill-location-city-area
 *      NODE_ENV=production yarn script:backfill-location-city-area
 */
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { getPostgresConnectionOptions } from '../src/database/postgres.config';

const DRY_RUN = false;

type LocationRow = {
  id: string;
  name: string;
  city: string | null;
  localArea: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  formattedAddress: string | null;
};

type ParsedAddress = {
  city: string;
  localArea: string | null;
};

// Plus codes such as "CFRP+M7H" are never a city or area.
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i;
// A street segment ("PG Road", "Gajwel Main Rd") is never a local area.
const ROAD = /\b(road|rd|street|st|lane|ln|marg|highway|hwy|main)\.?$/i;

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
        `Set NODE_ENV to development, staging, or production. Example:\n  NODE_ENV=staging yarn script:backfill-location-city-area`,
      );
  }
}

function same(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

function stripPostalCode(segment: string, pincode: string | null): string {
  let result = segment;
  if (pincode) result = result.replace(pincode, '');
  // Trailing numeric postal codes the pincode column may not hold, e.g. "Telangana 500003".
  return result.replace(/\s+\d{3,}(-\d+)?$/, '').trim();
}

function isPlaceName(segment: string): boolean {
  return Boolean(segment) && !PLUS_CODE.test(segment) && !/\d/.test(segment);
}

function parseAddress(row: LocationRow): ParsedAddress | null {
  if (!row.formattedAddress) return null;

  const segments = row.formattedAddress
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const last = segments[segments.length - 1];
  if (row.country && same(last, row.country)) segments.pop();
  if (segments.length === 0) return null;

  // "Telangana 500003", "NY 11542"; Singapore and Georgia have no state segment.
  const stateSegment = stripPostalCode(segments[segments.length - 1], row.pincode);
  if (same(stateSegment, row.state) || /^[A-Z]{2,3}$/.test(stateSegment)) {
    segments.pop();
  } else {
    segments[segments.length - 1] = stateSegment;
  }

  const city = segments.pop();
  if (!city || !isPlaceName(city)) return null;

  // Keep at least one segment ahead of localArea for the street / building.
  const areaCandidate =
    same(row.country, 'India') && segments.length >= 2
      ? segments[segments.length - 1]
      : null;
  const localArea =
    areaCandidate &&
    isPlaceName(areaCandidate) &&
    !ROAD.test(areaCandidate) &&
    !same(areaCandidate, city)
      ? areaCandidate
      : null;

  return { city, localArea };
}

function change(from: string | null, to: string | null): string {
  if (from === to) return to ?? '—';
  return `${from ?? '—'}  →  ${to ?? '—'}`;
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

  const rows: LocationRow[] = await dataSource.query(
    `SELECT id, name, city, "localArea", state, pincode, country, "formattedAddress"
     FROM locations
     ORDER BY "createdAt" ASC`,
  );

  console.error(
    `[INFO] ${DRY_RUN ? 'DRY RUN — ' : ''}locations=${rows.length}`,
  );

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const parsed = parseAddress(row);
    const title = `${row.name} (${row.id})`;

    if (!parsed) {
      skipped += 1;
      console.log(`\n[skipped] ${title}`);
      console.log(`  address:    ${row.formattedAddress ?? '—'}`);
      continue;
    }

    if (row.city === parsed.city && row.localArea === parsed.localArea) {
      unchanged += 1;
      console.log(`\n[unchanged] ${title}`);
      continue;
    }

    let result = DRY_RUN ? 'dry-run' : 'updated';
    try {
      if (!DRY_RUN) {
        await dataSource.query(
          `UPDATE locations SET city = $1, "localArea" = $2 WHERE id = $3`,
          [parsed.city, parsed.localArea, row.id],
        );
      }
      updated += 1;
    } catch (error) {
      failed += 1;
      result = `failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    console.log(`\n[${result}] ${title}`);
    console.log(`  city:       ${change(row.city, parsed.city)}`);
    console.log(`  localArea:  ${change(row.localArea, parsed.localArea)}`);
    console.log(`  address:    ${row.formattedAddress ?? '—'}`);
  }

  await dataSource.destroy();
  console.log(
    `\nupdated=${updated} unchanged=${unchanged} skipped=${skipped} failed=${failed}${DRY_RUN ? ' dry-run' : ''}`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
