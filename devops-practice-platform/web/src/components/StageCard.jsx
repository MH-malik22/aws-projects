import { useNavigate } from 'react-router-dom';
import ProgressBar from './ProgressBar.jsx';
import DifficultyPips from './DifficultyPips.jsx';
import { statusOf } from '../lib/status.js';

const CHIP = {
  passed: { cls: 'passed', text: 'exit 0' },
  running: { cls: 'running', text: 'running' },
  queued: { cls: 'queued', text: 'queued' },
};
const ACTION = {
  passed: { cls: 'passed', text: '✓ passed — review' },
  running: { cls: 'running', text: '▸ resume' },
  queued: { cls: 'queued', text: '▸ start' },
};

// A pipeline stage as a card: status in CI vernacular, difficulty as pips,
// progress with a text label. The "next" stage is highlighted.
export default function StageCard({ module: m, isNext }) {
  const navigate = useNavigate();
  const s = statusOf(m);
  const chip = CHIP[s];
  const action = ACTION[s];

  return (
    <button
      className={`stage ${isNext ? 'is-next' : ''} ${s === 'passed' ? 'is-passed' : ''}`}
      onClick={() => navigate(`/modules/${m.slug}`)}
    >
      <div className="stage-top">
        <span className="stage-id">stage <b>{String(m.order).padStart(2, '0')}</b></span>
        <span className={`status-chip ${chip.cls}`}>{chip.text}</span>
      </div>

      <h3 className="stage-title">{m.title}</h3>

      <div className="diff-row">
        <DifficultyPips level={m.level} />
        <span className="meta-dot">·</span>
        <span>{m.quizCount} q</span>
        <span className="meta-dot">·</span>
        <span>{m.taskCount} labs</span>
      </div>

      <ProgressBar percent={m.percent} />

      <span className={`stage-action ${action.cls}`}>{action.text}</span>
    </button>
  );
}
