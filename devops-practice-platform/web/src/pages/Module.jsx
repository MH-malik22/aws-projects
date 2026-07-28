import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import ProgressBar from '../components/ProgressBar.jsx';
import NotesView from '../components/NotesView.jsx';
import Quiz from '../components/Quiz.jsx';
import Tasks from '../components/Tasks.jsx';

const TABS = ['Concept', 'Notes', 'Quiz', 'Labs'];

export default function Module() {
  const { slug } = useParams();
  const [mod, setMod] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('Concept');
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    setMod(null);
    api.getModule(slug)
      .then((m) => { setMod(m); setPercent(m.progress.percent); })
      .catch((e) => setError(e.message));
  }, [slug]);

  // Keep the header bar in sync when quiz/labs report new progress.
  function handleProgress(p) {
    if (p && typeof p.percent === 'number') setPercent(p.percent);
    setMod((m) => (m ? { ...m, progress: { ...m.progress, notesRead: p?.notesRead ?? m.progress.notesRead } } : m));
  }

  async function markNotesRead() {
    try {
      const res = await api.setNotesRead(slug, true);
      handleProgress(res.progress);
      setMod((m) => ({ ...m, progress: { ...m.progress, notesRead: true } }));
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <div className="panel error">Could not load module: {error}</div>;
  if (!mod) return <div className="panel">Loading…</div>;

  const c = mod.concept;

  return (
    <div className="module-page">
      <div className="breadcrumb"><Link to="/">← All modules</Link></div>

      <header className="module-header">
        <div>
          <span className={`level-pill level-${mod.level}`}>{mod.level}</span>
          <h1>{mod.title}</h1>
        </div>
        <div className="module-header-progress">
          <ProgressBar percent={percent} />
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      <div className="tab-panel">
        {tab === 'Concept' && (
          <div className="concept">
            <section><h3>Overview</h3><p>{c.overview}</p></section>
            <section><h3>Why it matters</h3><p>{c.whyItMatters}</p></section>
            <section>
              <h3>Real-world use cases</h3>
              <ul>{(c.useCases || []).map((u, i) => <li key={i}>{u}</li>)}</ul>
            </section>
            <section className="arch">
              <h3>Architecture</h3>
              <p>{c.architecture}</p>
            </section>
          </div>
        )}

        {tab === 'Notes' && (
          <div>
            <NotesView notes={mod.notes} />
            <div className="notes-cta">
              <button
                className={`btn ${mod.progress.notesRead ? 'done' : 'primary'}`}
                onClick={markNotesRead}
                disabled={mod.progress.notesRead}
              >
                {mod.progress.notesRead ? '✓ Notes marked as read (+20%)' : 'Mark notes as read (+20%)'}
              </button>
            </div>
          </div>
        )}

        {tab === 'Quiz' && <Quiz slug={slug} onProgress={handleProgress} />}
        {tab === 'Labs' && <Tasks slug={slug} onProgress={handleProgress} />}
      </div>
    </div>
  );
}
