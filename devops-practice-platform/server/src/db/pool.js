import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// Enable TLS when talking to a managed provider (e.g. Azure Database for
// PostgreSQL requires SSL). Triggered by DATABASE_SSL=true or an sslmode=require
// in the connection string. rejectUnauthorized:false accepts the provider's
// managed cert without bundling a CA; supply one via PGSSLROOTCERT for stricter
// verification if you need it.
function sslConfig() {
  const url = process.env.DATABASE_URL || '';
  const wantSsl = process.env.DATABASE_SSL === 'true' || /sslmode=require/i.test(url);
  return wantSsl ? { rejectUnauthorized: false } : undefined;
}

// Prefer a full DATABASE_URL; otherwise assemble from discrete POSTGRES_* vars.
function connectionConfig() {
  const ssl = sslConfig();
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ...(ssl ? { ssl } : {}) };
  }
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'devops',
    password: process.env.POSTGRES_PASSWORD || 'devops',
    database: process.env.POSTGRES_DB || 'devops_platform',
    ...(ssl ? { ssl } : {}),
  };
}

export const pool = new Pool(connectionConfig());

export function query(text, params) {
  return pool.query(text, params);
}
