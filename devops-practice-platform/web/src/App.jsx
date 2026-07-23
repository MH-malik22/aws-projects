import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import LearningPath from './pages/LearningPath.jsx';
import Module from './pages/Module.jsx';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark">‹/›</span> DevOps Practice Platform
        </NavLink>
        <nav className="topnav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/path">Learning Path</NavLink>
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/path" element={<LearningPath />} />
          <Route path="/modules/:slug" element={<Module />} />
        </Routes>
      </main>
      <footer className="footer">
        Beginner → Advanced · 10 modules · quizzes, notes &amp; hands-on labs
      </footer>
    </div>
  );
}
