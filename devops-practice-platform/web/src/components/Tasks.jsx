import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced', 'simulation'];

// Hands-on labs with a completion checkbox that updates progress.
export default function Tasks({ slug, onProgress }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    api.getTasks(slug).then(setData).catch((e) => setError(e.message));
  }, [slug]);

  async function toggle(task) {
    setBusy(task.position);
    try {
      const res = task.completed
        ? await api.uncompleteTask(slug, task.position)
        : await api.completeTask(slug, task.position);
      setData((d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.position === task.position ? { ...t, completed: !t.completed } : t
        ),
      }));
      if (onProgress) onProgress(res.progress);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <div className="panel error">{error}</div>;
  if (!data) return <div className="panel">Loading labs…</div>;

  const sorted = [...data.tasks].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
  );

  return (
    <div className="tasks">
      {sorted.map((t) => (
        <div key={t.position} className={`task-card ${t.completed ? 'done' : ''}`}>
          <div className="task-head">
            <span className={`level-pill level-${t.level === 'simulation' ? 'advanced' : t.level}`}>{t.level}</span>
            <h3>{t.title}</h3>
            <button
              className={`task-toggle ${t.completed ? 'checked' : ''}`}
              onClick={() => toggle(t)}
              disabled={busy === t.position}
              aria-label={t.completed ? 'Mark incomplete' : 'Mark complete'}
            >
              {t.completed ? '✓ Done' : 'Mark done'}
            </button>
          </div>
          <p className="task-goal">{t.goal}</p>
          <div className="task-cols">
            <div>
              <h4>Steps</h4>
              <ol>{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
            <div>
              <h4>Success criteria</h4>
              <ul>{t.successCriteria.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
