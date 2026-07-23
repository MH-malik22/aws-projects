import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import ModuleCard from '../components/ModuleCard.jsx';
import ProgressBar from '../components/ProgressBar.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listModules().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="panel error">Could not load modules: {error}</div>;
  if (!data) return <div className="panel">Loading…</div>;

  const completed = data.modules.filter((m) => m.complete).length;

  return (
    <div className="dashboard">
      <section className="hero">
        <div className="hero-text">
          <h1>Your DevOps Journey</h1>
          <p>Work through 10 modules from beginner to advanced. Read the notes, pass the quiz, and finish the hands-on labs to complete each module.</p>
        </div>
        <div className="hero-stat">
          <div className="stat-big">{data.overallPercent}%</div>
          <ProgressBar percent={data.overallPercent} showLabel={false} />
          <div className="stat-sub">{completed} of {data.count} modules complete</div>
        </div>
      </section>

      <h2 className="section-title">Modules</h2>
      <div className="module-grid">
        {data.modules.map((m) => (
          <ModuleCard key={m.slug} module={m} />
        ))}
      </div>
    </div>
  );
}
