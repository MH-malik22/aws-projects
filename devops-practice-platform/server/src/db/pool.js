import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// Prefer a full DATABASE_URL; otherwise assemble from discrete POSTGRES_* vars.
function connectionConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'devops',
    password: process.env.POSTGRES_PASSWORD || 'devops',
    database: process.env.POSTGRES_DB || 'devops_platform',
  };
}

export const pool = new Pool(connectionConfig());

export function query(text, params) {
  return pool.query(text, params);
}
