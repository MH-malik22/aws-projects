import { Router } from 'express';
import { query } from '../db/pool.js';
import { httpError } from '../middleware/errors.js';
import { updateProgress, serializeProgress, getProgressRow } from '../services/progress.js';

export const progressRouter = Router();

// GET /api/progress — all module progress for the current user
progressRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT m.id, m.slug, m.title, m.order_index,
              COALESCE(p.percent,0) AS percent,
              COALESCE(p.notes_read,false) AS notes_read,
              COALESCE(p.quiz_best_score,0) AS quiz_best_score,
              COALESCE(p.quiz_total,0) AS quiz_total,
              COALESCE(p.quiz_passed,false) AS quiz_passed,
              COALESCE(p.tasks_completed,'[]'::jsonb) AS tasks_completed,
              p.updated_at,
              (SELECT COUNT(*)::int FROM tasks t WHERE t.module_id = m.id) AS task_count
       FROM modules m
       LEFT JOIN progress p ON p.module_id = m.id AND p.user_id = $1
       ORDER BY m.order_index ASC`,
      [req.user.id]
    );

    const modules = rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      order: r.order_index,
      ...serializeProgress(
        {
          module_id: r.id,
          notes_read: r.notes_read,
          quiz_best_score: r.quiz_best_score,
          quiz_total: r.quiz_total,
          quiz_passed: r.quiz_passed,
          tasks_completed: r.tasks_completed,
          percent: r.percent,
          updated_at: r.updated_at,
        },
        r.task_count
      ),
    }));

    const overall = modules.length
      ? Math.round(modules.reduce((s, m) => s + m.percent, 0) / modules.length)
      : 0;

    res.json({ user: req.user.external_id, overallPercent: overall, modules });
  } catch (err) {
    next(err);
  }
});

// POST /api/progress/:slug — mark notes read or (un)complete a task
// Body: { notesRead?: bool, completeTask?: number, uncompleteTask?: number }
progressRouter.post('/:slug', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id FROM modules WHERE slug = $1', [req.params.slug]);
    if (!rows[0]) throw httpError(404, `Module '${req.params.slug}' not found`);
    const moduleId = rows[0].id;

    const body = req.body || {};
    const changes = {};
    if (typeof body.notesRead === 'boolean') changes.notesRead = body.notesRead;
    if (typeof body.completeTask === 'number') changes.completeTaskPosition = body.completeTask;
    if (typeof body.uncompleteTask === 'number') changes.uncompleteTaskPosition = body.uncompleteTask;

    if (Object.keys(changes).length === 0) {
      throw httpError(400, 'Provide at least one of: notesRead, completeTask, uncompleteTask');
    }

    const updated = await updateProgress(req.user.id, moduleId, changes);
    res.json({ slug: req.params.slug, progress: serializeProgress(updated) });
  } catch (err) {
    next(err);
  }
});

// GET /api/progress/:slug — a single module's progress
progressRouter.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id FROM modules WHERE slug = $1', [req.params.slug]);
    if (!rows[0]) throw httpError(404, `Module '${req.params.slug}' not found`);
    const row = await getProgressRow(req.user.id, rows[0].id);
    res.json({ slug: req.params.slug, progress: serializeProgress(row) });
  } catch (err) {
    next(err);
  }
});
