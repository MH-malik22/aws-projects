import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import ProgressBar from '../components/ProgressBar.jsx';
import DifficultyPips from '../components/DifficultyPips.jsx';
import { statusOf, GLYPH } from '../lib/status.js';

// The path is the same pipeline as a vertical roadmap — a different read of the
// beginner→advanced sequence, one stage stacked on the next.
export default function LearningPath() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listModules().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="panel-msg error">! could not load path: {error}</div>;
  if (!data) return <div className="panel-msg">connecting…</div>;

  return (
    <div className="road">
      <h1>the path</h1>
      <p className="road-intro">Ten stages, beginner to advanced. Each turns green when its pipeline passes.</p>
      <ol className="road-list">
        {data.modules.map((m) => {
          const s = statusOf(m);
          return (
            <li key={m.slug} className={`road-step ${s}`}>
              <div className="road-node" aria-hidden="true">{s === 'passed' ? '✓' : m.order}</div>
              <div className="road-body" onClick={() => navigate(`/modules/${m.slug}`)}>
                <div className="road-row">
                  <h3><span aria-hidden="true">{GLYPH[s]}</span>&nbsp; {m.title}</h3>
                  <DifficultyPips level={m.level} />
                </div>
                <ProgressBar percent={m.percent} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
