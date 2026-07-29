// Progress bar with a monospace label. Colour is never the only signal — the
// label always spells out the percent or "exit 0".
export default function ProgressBar({ percent = 0, showLabel = true }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const done = clamped >= 100;
  return (
    <div className={`bar ${done ? 'done' : ''}`}>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${clamped}%` }} />
      </div>
      {showLabel && (
        <span className="bar-label">{done ? 'exit 0' : `${clamped}%`}</span>
      )}
    </div>
  );
}
