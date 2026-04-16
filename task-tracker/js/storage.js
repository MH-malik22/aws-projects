/**
 * Storage module - persists tasks in localStorage.
 * Exposes a global `TaskStorage` object.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'task-tracker.tasks.v1';

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Failed to load tasks from storage:', err);
      return [];
    }
  }

  function save(tasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.error('Failed to save tasks to storage:', err);
    }
  }

  function createId() {
    return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  global.TaskStorage = { load, save, createId, STORAGE_KEY };
})(window);
