import { useNavigate } from 'react-router-dom';
import ProgressBar from './ProgressBar.jsx';

const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

export default function ModuleCard({ module }) {
  const navigate = useNavigate();
  return (
    <button className="module-card" onClick={() => navigate(`/modules/${module.slug}`)}>
      <div className="module-card-head">
        <span className="module-order">{String(module.order).padStart(2, '0')}</span>
        <span className={`level-pill level-${module.level}`}>{LEVEL_LABEL[module.level] || module.level}</span>
      </div>
      <h3 className="module-title">{module.title}</h3>
      <p className="module-meta">{module.quizCount} quiz questions · {module.taskCount} labs</p>
      <ProgressBar percent={module.percent} size="sm" />
    </button>
  );
}
