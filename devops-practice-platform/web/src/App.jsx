import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import LearningPath from './pages/LearningPath.jsx';
import Module from './pages/Module.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';

export default function App() {
  return (
    <div className="app">
      <a href="#content" className="skip-link">Skip to content</a>

      <header className="topbar">
        <NavLink to="/" className="prompt" aria-label="DevOps Practice Platform — home">
          <span className="p-user">devops@practice</span>
          <span className="p-cwd">:~</span>
          <span className="p-path">&nbsp;$&nbsp;</span>
          <span className="p-cmd">learn</span>
          <span className="p-caret" aria-hidden="true" />
        </NavLink>

        <div className="topbar-right">
          <nav className="topnav" aria-label="Primary">
            <NavLink to="/" end>dashboard</NavLink>
            <NavLink to="/path">path</NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main id="content" className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/path" element={<LearningPath />} />
          <Route path="/modules/:slug" element={<Module />} />
        </Routes>
      </main>

      <footer className="footer">
        beginner → advanced · 10 stages · exit 0 when your pipeline is green
      </footer>
    </div>
  );
}
