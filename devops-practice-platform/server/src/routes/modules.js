import { Router } from 'express';
import { query } from '../db/pool.js';
import { httpError } from '../middleware/errors.js';
import {
  getProgressRow,
  serializeProgress,
  updateProgress,
} from '../services/progress.js';

export const modulesRouter = Router();

async function findModuleBySlug(slug) {
  const { rows } = await query('SELECT * FROM modules WHERE slug = $1', [slug]);
  return rows[0] || null;
}

// GET /api/modules — ordered list with the current user's percent per module
modulesRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT m.id, m.slug, m.title, m.order_index, m.level,
              COALESCE(p.percent, 0) AS percent,
              COALESCE(p.notes_read, false) AS notes_read,
              (SELECT COUNT(*)::int FROM tasks t WHERE t.module_id = m.id) AS task_count,
              (SELECT COUNT(*)::int FROM quiz_questions q WHERE q.module_id = m.id) AS quiz_count
       FROM modules m
       LEFT JOIN progress p ON p.module_id = m.id AND p.user_id = $1
       ORDER BY m.order_index ASC`,
      [req.user.id]
    );

    const modules = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      order: r.order_index,
      level: r.level,
      percent: r.percent,
      complete: r.percent >= 100,
      notesRead: r.notes_read,
      taskCount: r.task_count,
      quizCount: r.quiz_count,
    }));

    const overall = modules.length
      ? Math.round(modules.reduce((s, m) => s + m.percent, 0) / modules.length)
      : 0;

    res.json({ overallPercent: overall, count: modules.length, modules });
  } catch (err) {
    next(err);
  }
});

// GET /api/modules/:slug — concept + notes + this user's progress
modulesRouter.get('/:slug', async (req, res, next) => {
  try {
    const mod = await findModuleBySlug(req.params.slug);
    if (!mod) throw httpError(404, `Module '${req.params.slug}' not found`);

    const taskCountRes = await query(
      'SELECT COUNT(*)::int AS n FROM tasks WHERE module_id = $1',
      [mod.id]
    );
    const progressRow = await getProgressRow(req.user.id, mod.id);

    res.json({
      id: mod.id,
      slug: mod.slug,
      title: mod.title,
      order: mod.order_index,
      level: mod.level,
      concept: mod.concept,
      notes: mod.notes,
      progress: serializeProgress(progressRow, taskCountRes.rows[0].n),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/modules/:slug/quiz — questions WITHOUT the answers (graded server-side)
modulesRouter.get('/:slug/quiz', async (req, res, next) => {
  try {
    const mod = await findModuleBySlug(req.params.slug);
    if (!mod) throw httpError(404, `Module '${req.params.slug}' not found`);

    const { rows } = await query(
      `SELECT id, position, type, question, options
       FROM quiz_questions WHERE module_id = $1 ORDER BY position ASC`,
      [mod.id]
    );
    res.json({
      slug: mod.slug,
      total: rows.length,
      questions: rows.map((q) => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/modules/:slug/quiz/submit — grade answers, update progress
// Body: { answers: { "docker-q1": 1, "docker-q2": true, ... } }
modulesRouter.post('/:slug/quiz/submit', async (req, res, next) => {
  try {
    const mod = await findModuleBySlug(req.params.slug);
    if (!mod) throw httpError(404, `Module '${req.params.slug}' not found`);

    const answers = (req.body && req.body.answers) || {};
    if (typeof answers !== 'object' || Array.isArray(answers)) {
      throw httpError(400, 'Body must include an "answers" object keyed by question id');
    }

    const { rows } = await query(
      `SELECT id, type, answer, explanation FROM quiz_questions
       WHERE module_id = $1 ORDER BY position ASC`,
      [mod.id]
    );

    let correct = 0;
    const results = rows.map((q) => {
      const given = answers[q.id];
      const isCorrect = given !== undefined && given !== null &&
        JSON.stringify(given) === JSON.stringify(q.answer);
      if (isCorrect) correct += 1;
      return {
        id: q.id,
        correct: isCorrect,
        correctAnswer: q.answer,
        given: given ?? null,
        explanation: q.explanation,
      };
    });

    const total = rows.length;
    const updated = await updateProgress(req.user.id, mod.id, {
      quizScore: correct,
      quizTotal: total,
    });

    res.json({
      slug: mod.slug,
      score: correct,
      total,
      percentage: total ? Math.round((correct / total) * 100) : 0,
      passed: total ? correct / total >= 0.7 : false,
      results,
      progress: serializeProgress(updated),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/modules/:slug/tasks — hands-on tasks + which the user completed
modulesRouter.get('/:slug/tasks', async (req, res, next) => {
  try {
    const mod = await findModuleBySlug(req.params.slug);
    if (!mod) throw httpError(404, `Module '${req.params.slug}' not found`);

    const { rows } = await query(
      `SELECT position, level, title, goal, steps, success_criteria
       FROM tasks WHERE module_id = $1 ORDER BY position ASC`,
      [mod.id]
    );
    const progressRow = await getProgressRow(req.user.id, mod.id);
    const completed = new Set(
      Array.isArray(progressRow.tasks_completed) ? progressRow.tasks_completed : []
    );

    res.json({
      slug: mod.slug,
      tasks: rows.map((t) => ({
        position: t.position,
        level: t.level,
        title: t.title,
        goal: t.goal,
        steps: t.steps,
        successCriteria: t.success_criteria,
        completed: completed.has(t.position),
      })),
    });
  } catch (err) {
    next(err);
  }
});
