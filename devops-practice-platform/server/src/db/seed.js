import { readdir, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The content/ directory lives next to server/ in local dev, and is copied to
// /app/content in the Docker image. Resolve whichever exists.
async function resolveContentDir() {
  if (process.env.CONTENT_DIR) return resolve(process.env.CONTENT_DIR);
  const candidates = [
    join(__dirname, '..', '..', 'content'),        // /app/content (docker)
    join(__dirname, '..', '..', '..', 'content'),  // repo/devops-practice-platform/content (dev)
  ];
  for (const c of candidates) {
    try {
      await access(c);
      return c;
    } catch {
      /* try next */
    }
  }
  throw new Error('Could not locate the content/ directory. Set CONTENT_DIR.');
}

async function loadModules(dir) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  const modules = [];
  for (const file of files) {
    const raw = await readFile(join(dir, file), 'utf8');
    modules.push(JSON.parse(raw));
  }
  modules.sort((a, b) => a.order - b.order);
  return modules;
}

async function seed() {
  const dir = await resolveContentDir();
  const modules = await loadModules(dir);
  console.log(`[seed] loading ${modules.length} modules from ${dir}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Replace module-owned content; progress rows cascade-delete but are
    // per-user and re-created on demand, so a full reseed is safe for content.
    await client.query('TRUNCATE quiz_questions, tasks, modules RESTART IDENTITY CASCADE');

    for (const m of modules) {
      const { rows } = await client.query(
        `INSERT INTO modules (slug, title, order_index, level, concept, notes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [m.slug, m.title, m.order, m.level, JSON.stringify(m.concept || {}), JSON.stringify(m.notes || {})]
      );
      const moduleId = rows[0].id;

      let qPos = 0;
      for (const q of m.quiz || []) {
        await client.query(
          `INSERT INTO quiz_questions (id, module_id, position, type, question, options, answer, explanation)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [q.id, moduleId, qPos++, q.type, q.question, JSON.stringify(q.options || []), JSON.stringify(q.answer), q.explanation || '']
        );
      }

      let tPos = 0;
      for (const t of m.tasks || []) {
        await client.query(
          `INSERT INTO tasks (module_id, position, level, title, goal, steps, success_criteria)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [moduleId, tPos++, t.level, t.title, t.goal || '', JSON.stringify(t.steps || []), JSON.stringify(t.successCriteria || [])]
        );
      }
      console.log(`[seed]   ${m.slug}: ${(m.quiz || []).length} questions, ${(m.tasks || []).length} tasks`);
    }

    await client.query('COMMIT');
    console.log('[seed] done');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  });
