// Derive CI-vernacular status from a module's progress percent.
export function statusOf(m) {
  if (m.complete || m.percent >= 100) return 'passed';
  if (m.percent > 0) return 'running';
  return 'queued';
}

export const GLYPH = { passed: '●', running: '◍', queued: '○' };

export const LEVEL_TO_PIPS = { beginner: 1, intermediate: 2, advanced: 3 };

// The module the learner should jump into: the one in progress, else the
// first not-yet-started, else the last (all done).
export function resumeTarget(modules = []) {
  const running = modules.find((m) => statusOf(m) === 'running');
  if (running) return running;
  const queued = modules.find((m) => statusOf(m) === 'queued');
  if (queued) return queued;
  return modules[modules.length - 1] || null;
}

// Which tab a module should open on, given its progress.
export function nextTab(m) {
  if (!m) return 'Concept';
  if (!m.notesRead) return 'Notes';
  return 'Quiz';
}
