import { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import ProgressBar from '../components/ProgressBar.jsx';
import NotesView from '../components/NotesView.jsx';
import Quiz from '../components/Quiz.jsx';
import Tasks from '../components/Tasks.jsx';

const TABS = ['Concept', 'Notes', 'Quiz', 'Labs'];

export default function Module() {
  const { slug } = useParams();
  const location = useLocation();
  const [mod, setMod] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(location.state?.tab || 'Concept');
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    setMod(null);
    api.getModule(slug)
      .then((m) => { setMod(m); setPercent(m.progress.percent); })
      .catch((e) => setError(e.message));
  }, [slug]);

  function handleProgress(p) {
    if (p && typeof p.percent === 'number') setPercent(p.percent);
    setMod((m) => (m ? { ...m, progress: { ...m.progress, ...(p || {}) } } : m));
  }

  async function markNotesRead() {
    try {
      const res = await api.setNotesRead(slug, true);
      handleProgress(res.progress);
    } catch (e) { setError(e.message); }
  }

  if (error) return <div className="panel-msg error">! could not load stage: {error}</div>;
  if (!mod) return <div className="panel-msg">connecting…</div>;

  const c = mod.concept;
  const pr = mod.progress;
  const done = { Notes: pr.notesRead, Quiz: pr.quiz?.passed, Labs: pr.taskCount > 0 && (pr.tasksCompleted?.length || 0) >= pr.taskCount };

  // Contextual next step
  let next = null;
  if (!pr.notesRead) next = { tab: 'Notes', label: 'read the notes' };
  else if (!pr.quiz?.passed) next = { tab: 'Quiz', label: 'pass the quiz' };
  else if (!done.Labs) next = { tab: 'Labs', label: 'finish the labs' };

  return (
    <div className="module-page">
      <div className="crumb">
        <Link to="/">run</Link> <span className="sep">/</span> {mod.slug}
      </div>

      <header className="mod-head">
        <div>
          <span className="eyebrow">stage {String(mod.order).padStart(2, '0')} · {mod.level}</span>
          <h1>{mod.title}</h1>
        </div>
        <div className="mod-head-right"><ProgressBar percent={percent} /></div>
      </header>

      <nav className="tabs" aria-label="Stage sections">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}{done[t] && <span className="tick" aria-label="complete">✓</span>}
          </button>
        ))}
      </nav>

      <div className="tab-panel">
        {tab === 'Concept' && (
          <div className="concept">
            <section><h3># overview</h3><p>{c.overview}</p></section>
            <section><h3># why it matters</h3><p>{c.whyItMatters}</p></section>
            <section>
              <h3># real-world use cases</h3>
              <ul>{(c.useCases || []).map((u, i) => <li key={i}>{u}</li>)}</ul>
            </section>
            <section className="arch">
              <h3># architecture</h3>
              <p>{c.architecture}</p>
            </section>
          </div>
        )}

        {tab === 'Notes' && (
          <div>
            <NotesView notes={mod.notes} />
            <div className="notes-cta">
              <button className={`btn ${pr.notesRead ? 'done' : 'primary'}`} onClick={markNotesRead} disabled={pr.notesRead}>
                {pr.notesRead ? '✓ notes read · +20%' : 'mark notes as read · +20%'}
              </button>
            </div>
          </div>
        )}

        {tab === 'Quiz' && <Quiz slug={slug} onProgress={handleProgress} />}
        {tab === 'Labs' && <Tasks slug={slug} onProgress={handleProgress} />}
      </div>

      {next && tab !== next.tab && (
        <div className="next-step">
          <span className="ns-label">next: {next.label}</span>
          <button className="btn primary" onClick={() => setTab(next.tab)}>{next.tab} ▸</button>
        </div>
      )}
    </div>
  );
}
