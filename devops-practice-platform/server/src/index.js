import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { attachUser } from './middleware/user.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { modulesRouter } from './routes/modules.js';
import { progressRouter } from './routes/progress.js';
import { pool } from './db/pool.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

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

app.listen(PORT, () => {
  console.log(`[server] DevOps Practice Platform API listening on :${PORT}`);
});
