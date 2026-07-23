// Animated progress bar with a percent label and a "complete" state.
export default function ProgressBar({ percent = 0, showLabel = true, size = 'md' }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const complete = clamped >= 100;
  return (
    <div className={`progress ${size} ${complete ? 'is-complete' : ''}`}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${clamped}%` }} />
      </div>
      {showLabel && (
        <span className="progress-label">
          {complete ? '✓ Complete' : `${clamped}%`}
        </span>
      )}
    </div>
  );
}
