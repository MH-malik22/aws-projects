import { LEVEL_TO_PIPS } from '../lib/status.js';

// Difficulty as a 1–3 signal-bar meter (log-level vernacular), never a
// green/amber/red traffic light — that language is reserved for run status.
export default function DifficultyPips({ level }) {
  const n = LEVEL_TO_PIPS[level] || 1;
  return (
    <span className="diff-row">
      <span className={`pips lvl-${n}`} aria-hidden="true">
        <i /><i /><i />
      </span>
      <span>{level}</span>
      <span className="sr-only">difficulty {n} of 3</span>
    </span>
  );
}
