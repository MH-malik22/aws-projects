import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { attachUser } from './middleware/user.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { modulesRouter } from './routes/modules.js';
import { progressRouter } from './routes/progress.js';
import { pool } from './db/pool.js';
import { applySchema } from './db/migrate.js';
import { seedFromContent } from './db/seed.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

// When INIT_DB=true (managed hosting like Azure Container Apps), the API
// prepares its own database on startup: apply the schema (idempotent) and seed
// content only if the modules table is empty. Seeding on-empty means restarts
// and scale events never wipe learner progress; change content with a manual
// `npm run seed`.
async function initDb() {
  if (process.env.INIT_DB !== 'true') return;
  console.log('[init] INIT_DB=true — applying schema');
  await applySchema();
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM modules');
  if (rows[0].n === 0) {
    console.log('[init] no modules found — seeding content');
    await seedFromContent();
  } else {
    console.log(`[init] ${rows[0].n} modules present — skipping seed`);
  }
}

// CORS: allow the configured web origins (comma-separated) or all in dev.
const origins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));

app.use(express.json());

// Health check does not require the DB-backed user middleware.
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'down', error: err.message });
  }
});

// Everything under /api gets a resolved user (demo user by default).
app.use('/api', attachUser);
app.use('/api/modules', modulesRouter);
app.use('/api/progress', progressRouter);

app.use('/api', notFound);
app.use(errorHandler);

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[server] DevOps Practice Platform API listening on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[init] database initialization failed:', err);
    process.exit(1);
  });
