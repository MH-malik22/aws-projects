/**
 * Reminders module - handles browser notifications, due-date scheduling,
 * and recurring task rollover. Exposes a global `Reminders` object.
 *
 * The scheduler runs on an interval (checkEveryMs). For each task it:
 *   - fires a "pre-reminder" at (dueAt - remindBefore minutes)
 *   - fires a "due" notification at dueAt
 *   - marks an overdue task and, if recurring, rolls it forward
 *
 * To avoid spamming, we track fired events on the task itself:
 *   task.remindedPre  (boolean)
 *   task.remindedDue  (boolean)
 */
(function (global) {
  'use strict';

  const DEFAULTS = { checkEveryMs: 30 * 1000 };

  let timerId = null;
  let getTasks = null;   // () => tasks[]
  let saveTasks = null;  // (tasks) => void
  let onChange = null;   // () => void  (notify app to re-render)

  function notificationsSupported() {
    return 'Notification' in global;
  }

  function currentPermission() {
    if (!notificationsSupported()) return 'unsupported';
    return Notification.permission;
  }

  async function requestPermission() {
    if (!notificationsSupported()) return 'unsupported';
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Notification.permission;
    }
    try {
      const result = await Notification.requestPermission();
      return result;
    } catch (err) {
      console.error('Notification permission request failed:', err);
      return 'denied';
    }
  }

  function notify(title, body) {
    // Always log so users without notification permission still see it in console.
    console.info('[Reminder]', title, '-', body);

    if (!notificationsSupported() || Notification.permission !== 'granted') {
      // Fallback: in-page alert-style toast via title bar flash
      flashTitle(title);
      return;
    }
    try {
      const n = new Notification(title, { body, tag: title + '|' + body });
      // Auto-close after 8s so they don't pile up
      setTimeout(() => n.close && n.close(), 8000);
    } catch (err) {
      console.warn('Notification failed, falling back:', err);
      flashTitle(title);
    }
  }

  // Tab-title flasher for when notifications are not granted.
  let flashIntervalId = null;
  let originalTitle = null;
  function flashTitle(message) {
    if (typeof document === 'undefined') return;
    if (!originalTitle) originalTitle = document.title;
    if (flashIntervalId) return;
    let showMsg = true;
    flashIntervalId = setInterval(() => {
      document.title = showMsg ? ('(!) ' + message) : originalTitle;
      showMsg = !showMsg;
    }, 1500);
    // Restore title on focus.
    const restore = () => {
      clearInterval(flashIntervalId);
      flashIntervalId = null;
      document.title = originalTitle;
      global.removeEventListener('focus', restore);
    };
    global.addEventListener('focus', restore);
  }

  function minutesToMs(m) { return m * 60 * 1000; }

  function rollRecurring(task) {
    if (!task.repeat || task.repeat === 'none') return null;
    const due = new Date(task.dueAt);
    if (isNaN(due.getTime())) return null;
    switch (task.repeat) {
      case 'daily':
        due.setDate(due.getDate() + 1); break;
      case 'weekly':
        due.setDate(due.getDate() + 7); break;
      case 'monthly':
        due.setMonth(due.getMonth() + 1); break;
      default:
        return null;
    }
    return due.toISOString();
  }

  function tick() {
    if (!getTasks || !saveTasks) return;
    const tasks = getTasks();
    const now = Date.now();
    let mutated = false;

    for (const task of tasks) {
      if (task.completed) continue;
      const dueTs = new Date(task.dueAt).getTime();
      if (isNaN(dueTs)) continue;

      const remindBeforeMs = minutesToMs(Number(task.remindBefore) || 0);
      const preReminderTs = dueTs - remindBeforeMs;

      // Pre-reminder
      if (!task.remindedPre && remindBeforeMs > 0 && now >= preReminderTs && now < dueTs) {
        notify('Upcoming: ' + task.title, 'Due ' + formatRelative(dueTs));
        task.remindedPre = true;
        mutated = true;
      }

      // Due notification
      if (!task.remindedDue && now >= dueTs) {
        notify('Task due: ' + task.title, task.notes || 'It is time to work on this task.');
        task.remindedDue = true;
        mutated = true;

        // If recurring, roll forward and reset reminder flags.
        const next = rollRecurring(task);
        if (next) {
          task.dueAt = next;
          task.remindedPre = false;
          task.remindedDue = false;
        }
      }
    }

    if (mutated) {
      saveTasks(tasks);
      if (onChange) onChange();
    }
  }

  function formatRelative(ts) {
    const diffMs = ts - Date.now();
    const absMin = Math.round(Math.abs(diffMs) / 60000);
    const sign = diffMs >= 0 ? 'in' : 'ago';
    if (absMin < 1) return 'now';
    if (absMin < 60) return sign + ' ' + absMin + ' min';
    const hrs = Math.round(absMin / 60);
    if (hrs < 24) return sign + ' ' + hrs + ' hr';
    const days = Math.round(hrs / 24);
    return sign + ' ' + days + ' day(s)';
  }

  function start(options) {
    options = options || {};
    getTasks = options.getTasks;
    saveTasks = options.saveTasks;
    onChange = options.onChange;
    const interval = options.checkEveryMs || DEFAULTS.checkEveryMs;
    stop();
    timerId = setInterval(tick, interval);
    // Run immediately so first tick isn't delayed.
    tick();
  }

  function stop() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  global.Reminders = {
    notificationsSupported,
    currentPermission,
    requestPermission,
    start,
    stop,
    tick,
    formatRelative,
  };
})(window);
