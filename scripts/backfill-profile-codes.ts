/**
 * Assign a profile code to every EasyProfile that does not have one yet,
 * including soft-deleted rows. The code is what the profile QR encodes.
 *
 * Skips a candidate when that code is already used, or when its lowercase
 * form matches an existing slug.
 *
 * 1. Leave DRY_RUN = true and inspect the plan.
 * 2. Set DRY_RUN = false and run against the target env:
 *      NODE_ENV=staging yarn script:backfill-profile-codes
 *      NODE_ENV=development yarn script:backfill-profile-codes
 *      NODE_ENV=production yarn script:backfill-profile-codes
 */
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { getPostgresConnectionOptions } from '../src/database/postgres.config';
import { Profile } from '../src/profiles/entities/profile.entity';
import { generateProfileCodeValue } from '../src/profiles/profile-code.util';

const DRY_RUN = false;

type ProfileRow = {
  id: string;
  slug: string | null;
  code: string | null;
  displayName: string;
  deletedAt: Date | string | null;
};

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
        `Set NODE_ENV to development, staging, or production. Example:\n  NODE_ENV=staging yarn script:backfill-profile-codes`,
      );
  }
}

function allocateCode(usedCodes: Set<string>, slugs: Set<string>): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateProfileCodeValue();
    if (usedCodes.has(code)) continue;
    if (slugs.has(code.toLowerCase())) continue;
    usedCodes.add(code);
    return code;
  }
  throw new Error('Unable to allocate a unique profile code');
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

  const profiles = await dataSource.getRepository(Profile).find({
    withDeleted: true,
    order: { createdAt: 'ASC' },
  });

  const usedCodes = new Set<string>();
  const slugs = new Set<string>();
  const missing: ProfileRow[] = [];

  for (const profile of profiles) {
    if (profile.code) usedCodes.add(profile.code);
    if (profile.slug) slugs.add(profile.slug.toLowerCase());
    if (!profile.code) {
      missing.push({
        id: profile.id,
        slug: profile.slug,
        code: profile.code,
        displayName: profile.displayName,
        deletedAt: profile.deletedAt,
      });
    }
  }

  console.error(
    `[INFO] ${DRY_RUN ? 'DRY RUN — ' : ''}profiles=${profiles.length} missingCode=${missing.length}`,
  );
  console.log('id\tslug\tdisplayName\tcode\tdeleted\tresult');

  let assigned = 0;
  let failed = 0;

  for (const profile of missing) {
    try {
      const code = allocateCode(usedCodes, slugs);
      if (!DRY_RUN) {
        // TypeORM returns [rows, rowCount] for UPDATE.
        const raw: [unknown[], number] = await dataSource.query(
          `UPDATE profiles SET code = $1 WHERE id = $2 AND code IS NULL RETURNING id`,
          [code, profile.id],
        );
        const rowCount = Array.isArray(raw) ? Number(raw[1] ?? 0) : 0;
        if (rowCount === 0) {
          console.log(
            `${profile.id}\t${profile.slug ?? ''}\t${profile.displayName}\t\t${profile.deletedAt ? 'yes' : 'no'}\tskipped (already set)`,
          );
          continue;
        }
      }
      assigned += 1;
      console.log(
        `${profile.id}\t${profile.slug ?? ''}\t${profile.displayName}\t${code}\t${profile.deletedAt ? 'yes' : 'no'}\t${DRY_RUN ? 'dry-run' : 'assigned'}`,
      );
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(
        `${profile.id}\t${profile.slug ?? ''}\t${profile.displayName}\t\t${profile.deletedAt ? 'yes' : 'no'}\tfailed (${message})`,
      );
    }
  }

  await dataSource.destroy();
  console.log(
    `assigned=${assigned} failed=${failed}${DRY_RUN ? ' dry-run' : ''}`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
