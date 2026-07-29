import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import PipelineTrack from '../components/PipelineTrack.jsx';
import StageCard from '../components/StageCard.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { resumeTarget, nextTab, statusOf } from '../lib/status.js';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listModules().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="panel-msg error">! could not load pipeline: {error}</div>;
  if (!data) return <div className="panel-msg">connecting…</div>;

  const passed = data.modules.filter((m) => statusOf(m) === 'passed').length;
  const resume = resumeTarget(data.modules);
  const resumeStatus = resume ? statusOf(resume) : null;

  return (
    <div className="dashboard">
      {/* Signature: your path as a live pipeline run */}
      <section className="pipeline" aria-label="Learning pipeline">
        <div className="run-head">
          <span className="eyebrow">run · your path</span>
          <span className="exit">{passed === data.count ? 'exit 0' : `exit — · ${data.overallPercent}%`}</span>
        </div>

        <PipelineTrack modules={data.modules} />

        {resume && (
          <div className="resume">
            <div className="r-meta">
              <div className="r-label">
                {resumeStatus === 'running' ? 'now running' : resumeStatus === 'queued' ? 'next up' : 'all stages passed'}
              </div>
              <div className="r-title">{String(resume.order).padStart(2, '0')} · {resume.title}</div>
              <div className="r-bar"><ProgressBar percent={resume.percent} /></div>
            </div>
            <Link
              className="btn primary"
              to={`/modules/${resume.slug}`}
              state={{ tab: nextTab(resume) }}
            >
              {resumeStatus === 'passed' ? 'review ▸' : resumeStatus === 'running' ? 'resume ▸' : 'start ▸'}
            </Link>
          </div>
        )}
      </section>

      <div className="stages-head">
        <h2>stages</h2>
        <span className="eyebrow">{passed}/{data.count} passed</span>
      </div>

      <div className="stage-grid">
        {data.modules.map((m) => (
          <StageCard key={m.slug} module={m} isNext={resume && m.slug === resume.slug && resumeStatus !== 'passed'} />
        ))}
      </div>
    </div>
  );
}
