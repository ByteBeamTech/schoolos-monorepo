// infra/pooling/db-pool.config.ts
// Prisma connection pool configuration.
// Set DATABASE_URL with pool params, or configure via env vars below.

import { ConfigService } from '@nestjs/config';

export function buildDatabaseUrl(config: ConfigService): string {
  const base          = config.get<string>('DATABASE_URL', '');
  const poolSize      = config.get<number>('DB_POOL_SIZE',       10);
  const poolTimeout   = config.get<number>('DB_POOL_TIMEOUT',    30);  // seconds
  const connTimeout   = config.get<number>('DB_CONNECT_TIMEOUT', 10);  // seconds
  const socketTimeout = config.get<number>('DB_SOCKET_TIMEOUT',  30);  // seconds

  // Prisma uses pgbouncer-style connection limit params in the URL
  // Format: postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=30
  if (!base) return '';

  const url = new URL(base);
  url.searchParams.set('connection_limit', String(poolSize));
  url.searchParams.set('pool_timeout',     String(poolTimeout));
  url.searchParams.set('connect_timeout',  String(connTimeout));
  url.searchParams.set('socket_timeout',   String(socketTimeout));

  return url.toString();
}

export const DB_POOL_DEFAULTS = {
  // Recommended pool sizes by environment
  development: { connection_limit: 5,  pool_timeout: 10 },
  test:        { connection_limit: 3,  pool_timeout: 5  },
  production:  { connection_limit: 20, pool_timeout: 30 },
} as const;

// ─── Usage in PrismaService ──────────────────────────────────────────────────
// constructor(config: ConfigService) {
//   super({
//     datasources: { db: { url: buildDatabaseUrl(config) } },
//     log: [
//       { emit: 'event', level: 'error' },
//       { emit: 'event', level: 'warn' },
//     ],
//     errorFormat: 'colorless',
//   });
// }
