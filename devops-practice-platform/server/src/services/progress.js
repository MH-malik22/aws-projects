import { query } from '../db/pool.js';

// ---- Progress weighting ----
// A module's completion percentage is a weighted sum of three activities:
//   notes read ............ 20%
//   quiz passed (>=70%) ... 40%  (scaled by the best score once passed)
//   hands-on tasks ........ 40%  (each task contributes an equal share)
export const WEIGHTS = { notes: 20, quiz: 40, tasks: 40 };
export const QUIZ_PASS_RATIO = 0.7;

/**
 * Pure function: given a progress-like record and the module's task count,
 * return the integer completion percent (0-100). Kept pure so it can be unit
 * tested and reused by the API without touching the DB.
 */
export function computePercent({ notesRead, quizPassed, quizBestScore, quizTotal, tasksCompletedCount, taskCount }) {
  let percent = 0;

  if (notesRead) percent += WEIGHTS.notes;

  if (quizPassed && quizTotal > 0) {
    const ratio = Math.min(1, quizBestScore / quizTotal);
    percent += Math.round(WEIGHTS.quiz * ratio);
  }

  if (taskCount > 0) {
    const perTask = WEIGHTS.tasks / taskCount;
    percent += Math.round(perTask * Math.min(tasksCompletedCount, taskCount));
  }

  return Math.max(0, Math.min(100, percent));
}

/** Resolve (or lazily create) the internal user id for an external id. */
export async function getOrCreateUser(externalId) {
  const id = externalId || 'demo-user';
  const { rows } = await query(
    `INSERT INTO users (external_id) VALUES ($1)
     ON CONFLICT (external_id) DO UPDATE SET external_id = EXCLUDED.external_id
     RETURNING id, external_id, display_name`,
    [id]
  );
  return rows[0];
}

/** How many tasks a module has (denominator for the tasks weight). */
async function taskCountForModule(moduleId) {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM tasks WHERE module_id = $1', [moduleId]);
  return rows[0].n;
}

/** Fetch the existing progress row or a zeroed default (not yet persisted). */
export async function getProgressRow(userId, moduleId) {
  const { rows } = await query(
    'SELECT * FROM progress WHERE user_id = $1 AND module_id = $2',
    [userId, moduleId]
  );
  if (rows[0]) return rows[0];
  return {
    user_id: userId,
    module_id: moduleId,
    notes_read: false,
    quiz_best_score: 0,
    quiz_total: 0,
    quiz_passed: false,
    tasks_completed: [],
    percent: 0,
  };
}

/**
 * Upsert a progress row after recomputing percent from the merged state.
 * `changes` may include: notesRead, quizScore/quizTotal, completeTaskPosition.
 */
export async function updateProgress(userId, moduleId, changes = {}) {
  const current = await getProgressRow(userId, moduleId);
  const taskCount = await taskCountForModule(moduleId);

  const notesRead = changes.notesRead ?? current.notes_read;

  let quizBestScore = current.quiz_best_score;
  let quizTotal = current.quiz_total;
  let quizPassed = current.quiz_passed;
  if (typeof changes.quizScore === 'number' && typeof changes.quizTotal === 'number') {
    quizTotal = changes.quizTotal;
    quizBestScore = Math.max(current.quiz_best_score, changes.quizScore);
    if (changes.quizTotal > 0 && changes.quizScore / changes.quizTotal >= QUIZ_PASS_RATIO) {
      quizPassed = true;
    }
  }

  const completed = new Set(
    Array.isArray(current.tasks_completed) ? current.tasks_completed : []
  );
  if (typeof changes.completeTaskPosition === 'number') {
    completed.add(changes.completeTaskPosition);
  }
  if (typeof changes.uncompleteTaskPosition === 'number') {
    completed.delete(changes.uncompleteTaskPosition);
  }
  const tasksCompleted = [...completed].filter((p) => p < taskCount);

  const percent = computePercent({
    notesRead,
    quizPassed,
    quizBestScore,
    quizTotal,
    tasksCompletedCount: tasksCompleted.length,
    taskCount,
  });

  const { rows } = await query(
    `INSERT INTO progress (user_id, module_id, notes_read, quiz_best_score, quiz_total, quiz_passed, tasks_completed, percent, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
     ON CONFLICT (user_id, module_id) DO UPDATE SET
       notes_read = EXCLUDED.notes_read,
       quiz_best_score = EXCLUDED.quiz_best_score,
       quiz_total = EXCLUDED.quiz_total,
       quiz_passed = EXCLUDED.quiz_passed,
       tasks_completed = EXCLUDED.tasks_completed,
       percent = EXCLUDED.percent,
       updated_at = now()
     RETURNING *`,
    [userId, moduleId, notesRead, quizBestScore, quizTotal, quizPassed, JSON.stringify(tasksCompleted), percent]
  );
  return rows[0];
}

/** Shape a raw progress DB row into the API/UI structure. */
export function serializeProgress(row, taskCount = null) {
  return {
    moduleId: row.module_id,
    notesRead: row.notes_read,
    quiz: {
      bestScore: row.quiz_best_score,
      total: row.quiz_total,
      passed: row.quiz_passed,
    },
    tasksCompleted: Array.isArray(row.tasks_completed) ? row.tasks_completed : [],
    taskCount,
    percent: row.percent,
    complete: row.percent >= 100,
    updatedAt: row.updated_at || null,
  };
}
