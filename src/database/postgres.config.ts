/**
 * Build Postgres connection options from DATABASE_URL.
 *
 * Newer `pg` treats `sslmode=require` as `verify-full`, which fails on many
 * cloud certs. Strip sslmode from the URL and apply SSL via TypeORM instead.
 * Cloud SQL Unix sockets (`host=/cloudsql/...`) do not need client SSL.
 */
export function getPostgresConnectionOptions(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const sslMode = parsed.searchParams.get('sslmode');
  const socketHost = parsed.searchParams.get('host');
  const isCloudSqlSocket = Boolean(socketHost?.startsWith('/cloudsql/'));
  const wantsSsl =
    !isCloudSqlSocket && sslMode !== null && sslMode !== 'disable';

  parsed.searchParams.delete('sslmode');
  parsed.searchParams.delete('uselibpqcompat');

  return {
    type: 'postgres' as const,
    url: parsed.toString(),
    ssl: wantsSsl ? { rejectUnauthorized: false } : false,
  };
}
