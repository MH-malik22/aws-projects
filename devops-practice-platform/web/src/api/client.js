// Thin fetch wrapper for the platform API. In dev, Vite proxies /api to the
// backend (see vite.config.js); in production VITE_API_BASE_URL is baked in.
const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// A stable per-browser learner id so progress persists without real auth.
function userId() {
  let id = localStorage.getItem('dpp-user-id');
  if (!id) {
    id = 'learner-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('dpp-user-id', id);
  }
  return id;
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  health: () => request('/health'),
  listModules: () => request('/modules'),
  getModule: (slug) => request(`/modules/${slug}`),
  getQuiz: (slug) => request(`/modules/${slug}/quiz`),
  submitQuiz: (slug, answers) => request(`/modules/${slug}/quiz/submit`, { method: 'POST', body: { answers } }),
  getTasks: (slug) => request(`/modules/${slug}/tasks`),
  getProgress: () => request('/progress'),
  setNotesRead: (slug, notesRead) => request(`/progress/${slug}`, { method: 'POST', body: { notesRead } }),
  completeTask: (slug, position) => request(`/progress/${slug}`, { method: 'POST', body: { completeTask: position } }),
  uncompleteTask: (slug, position) => request(`/progress/${slug}`, { method: 'POST', body: { uncompleteTask: position } }),
};
