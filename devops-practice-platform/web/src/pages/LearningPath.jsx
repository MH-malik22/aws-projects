import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import ProgressBar from '../components/ProgressBar.jsx';
import DifficultyPips from '../components/DifficultyPips.jsx';
import { statusOf, GLYPH, resumeTarget } from '../lib/status.js';

// The path is the pipeline as a vertical roadmap, grouped into beginner →
// intermediate → advanced phase bands with the next stage highlighted.
const BANDS = [
  { key: 'beginner', label: 'Beginner', hint: 'Foundations' },
  { key: 'intermediate', label: 'Intermediate', hint: 'Build & ship' },
  { key: 'advanced', label: 'Advanced', hint: 'Operate & scale' },
];

export default function LearningPath() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listModules().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="panel-msg error">! could not load path: {error}</div>;
  if (!data) return <div className="panel-msg">connecting…</div>;

  const passed = data.modules.filter((m) => statusOf(m) === 'passed').length;
  const resume = resumeTarget(data.modules);

  return (
    <div className="road">
      <header className="road-head">
        <div>
          <span className="eyebrow">roadmap</span>
          <h1>The Path</h1>
          <p className="road-intro">
            {data.count} stages, beginner to advanced. Each turns green when its pipeline passes.
          </p>
        </div>
        <div className="road-summary">
          <div className="road-summary-num">{data.overallPercent}%</div>
          <ProgressBar percent={data.overallPercent} showLabel={false} />
          <div className="road-summary-sub">{passed}/{data.count} stages passed</div>
        </div>
      </header>

      {BANDS.map((band) => {
        const items = data.modules.filter((m) => m.level === band.key);
        if (items.length === 0) return null;
        const bandPassed = items.filter((m) => statusOf(m) === 'passed').length;
        return (
          <section className="road-band" key={band.key}>
            <div className="road-band-head">
              <span className={`band-dot level-${band.key}`} aria-hidden="true" />
              <h2>{band.label}</h2>
              <span className="band-hint">{band.hint}</span>
              <span className="band-count">{bandPassed}/{items.length}</span>
            </div>

            <ol className="road-list">
              {items.map((m) => {
                const s = statusOf(m);
                const isNext = resume && m.slug === resume.slug && s !== 'passed';
                const action = s === 'passed' ? 'review' : s === 'running' ? 'resume ▸' : 'start ▸';
                return (
                  <li key={m.slug} className={`road-step ${s} ${isNext ? 'is-next' : ''}`}>
                    <div className="road-node" aria-hidden="true">
                      {s === 'passed' ? '✓' : GLYPH[s]}
                    </div>
                    <Link className="road-body" to={`/modules/${m.slug}`} aria-label={`${m.title} — ${s}`}>
                      <div className="road-body-main">
                        <div className="road-row">
                          <span className="road-num">{String(m.order).padStart(2, '0')}</span>
                          <h3>{m.title}</h3>
                          {isNext && <span className="road-next-tag">next</span>}
                        </div>
                        <div className="road-meta">
                          <DifficultyPips level={m.level} />
                          <span className="meta-dot">·</span>
                          <span>{m.quizCount} q</span>
                          <span className="meta-dot">·</span>
                          <span>{m.taskCount} labs</span>
                        </div>
                      </div>
                      <div className="road-body-side">
                        <ProgressBar percent={m.percent} />
                        <span className={`road-action ${s}`}>{action}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
