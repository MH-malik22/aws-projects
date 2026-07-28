import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Apply schema.sql. Retries a few times so it works when the DB container is
// still coming up (docker-compose starts api right after db becomes healthy).
async function migrate() {
  const sql = await readFile(join(__dirname, 'schema.sql'), 'utf8');
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query(sql);
      console.log('[migrate] schema applied successfully');
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const wait = Math.min(attempt * 1000, 5000);
      console.log(`[migrate] attempt ${attempt} failed (${err.code || err.message}); retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

migrate()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[migrate] failed:', err);
    process.exit(1);
  });
