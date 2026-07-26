/**
 * Build Postgres connection options from DATABASE_URL.
 *
 * Newer `pg` treats `sslmode=require` as `verify-full`, which fails on many
 * cloud certs. Strip sslmode from the URL and apply SSL via TypeORM instead.
 */
export function getPostgresConnectionOptions(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const sslMode = parsed.searchParams.get('sslmode');
  const wantsSsl = sslMode !== null && sslMode !== 'disable';

  parsed.searchParams.delete('sslmode');
  parsed.searchParams.delete('uselibpqcompat');

  return {
    type: 'postgres' as const,
    url: parsed.toString(),
    ssl: wantsSsl ? { rejectUnauthorized: false } : false,
  };
}
