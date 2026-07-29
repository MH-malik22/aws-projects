import { Link } from 'react-router-dom';
import { statusOf, GLYPH } from '../lib/status.js';

// The signature: the learner's path rendered as a CI pipeline run — a track of
// stage nodes that go queued (○) → running (◍) → passed (●), left to right.
export default function PipelineTrack({ modules }) {
  return (
    <div className="track" role="list" aria-label="Your learning pipeline">
      {modules.map((m, i) => {
        const s = statusOf(m);
        const statusText = s === 'passed' ? 'exit 0' : s === 'running' ? `${m.percent}%` : 'queued';
        return (
          <div
            key={m.slug}
            role="listitem"
            className={`node ${s}`}
            style={{ animationDelay: `${i * 55}ms` }}
          >
            <Link to={`/modules/${m.slug}`} aria-label={`${m.title}: ${s}`}>
              <span className="glyph" aria-hidden="true">{GLYPH[s]}</span>
              <span className="n-num">{String(m.order).padStart(2, '0')}</span>
              <span className="n-name">{m.slug}</span>
              <span className="n-status">{statusText}</span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
