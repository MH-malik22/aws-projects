import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import ProgressBar from '../components/ProgressBar.jsx';

// Ordered roadmap view: the same modules as the dashboard, but presented as a
// linear beginner -> advanced path with connectors.
export default function LearningPath() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listModules().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="panel error">Could not load path: {error}</div>;
  if (!data) return <div className="panel">Loading…</div>;

  return (
    <div className="path">
      <h1>Learning Path</h1>
      <p className="path-intro">Follow the roadmap top to bottom. Each step builds on the previous one.</p>
      <ol className="path-list">
        {data.modules.map((m) => (
          <li key={m.slug} className={`path-step ${m.complete ? 'done' : ''}`}>
            <div className="path-node">{m.complete ? '✓' : m.order}</div>
            <div className="path-body" onClick={() => navigate(`/modules/${m.slug}`)}>
              <div className="path-row">
                <h3>{m.title}</h3>
                <span className={`level-pill level-${m.level}`}>{m.level}</span>
              </div>
              <ProgressBar percent={m.percent} size="sm" />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
