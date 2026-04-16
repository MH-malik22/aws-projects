/**
 * Task Tracker - main app controller.
 * Wires up the DOM, storage, and reminders modules.
 */
(function () {
  'use strict';

  const form = document.getElementById('task-form');
  const taskList = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const filterSelect = document.getElementById('filter');
  const clearCompletedBtn = document.getElementById('clear-completed');
  const enableNotificationsBtn = document.getElementById('enable-notifications');
  const notificationStatus = document.getElementById('notification-status');

  let tasks = TaskStorage.load();

  function persist() {
    TaskStorage.save(tasks);
  }

  function getTasks() { return tasks; }
  function saveTasks(next) { tasks = next; persist(); }

  function createTaskFromForm() {
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    if (!title) return null;

    const dueAtRaw = String(fd.get('dueAt') || '');
    if (!dueAtRaw) return null;
    // datetime-local returns e.g. "2026-04-16T14:30"; treat as local time.
    const dueAt = new Date(dueAtRaw).toISOString();

    return {
      id: TaskStorage.createId(),
      title: title,
      notes: String(fd.get('notes') || '').trim(),
      dueAt: dueAt,
      priority: String(fd.get('priority') || 'medium'),
      category: String(fd.get('category') || '').trim(),
      repeat: String(fd.get('repeat') || 'none'),
      remindBefore: Math.max(0, parseInt(fd.get('remindBefore'), 10) || 0),
      completed: false,
      remindedPre: false,
      remindedDue: false,
      createdAt: new Date().toISOString(),
    };
  }

  function isOverdue(task) {
    if (task.completed) return false;
    const ts = new Date(task.dueAt).getTime();
    return !isNaN(ts) && ts < Date.now();
  }

  function isDueToday(task) {
    const d = new Date(task.dueAt);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  }

  function applyFilter(list, filter) {
    switch (filter) {
      case 'pending': return list.filter(t => !t.completed);
      case 'completed': return list.filter(t => t.completed);
      case 'overdue': return list.filter(isOverdue);
      case 'today': return list.filter(isDueToday);
      case 'all':
      default: return list.slice();
    }
  }

  function formatDateTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function render() {
    const filter = filterSelect.value;
    const visible = applyFilter(tasks, filter).sort((a, b) => {
      // Pending first, then by due date asc
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.dueAt) - new Date(b.dueAt);
    });

    taskList.innerHTML = '';
    if (!visible.length) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    for (const task of visible) {
      taskList.appendChild(renderTask(task));
    }
  }

  function renderTask(task) {
    const li = document.createElement('li');
    li.className = 'task-item';
    if (task.completed) li.classList.add('completed');
    const overdue = isOverdue(task);
    if (overdue) li.classList.add('overdue');

    // Checkbox
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'task-check';
    check.checked = !!task.completed;
    check.setAttribute('aria-label', 'Mark complete');
    check.addEventListener('change', () => toggleComplete(task.id, check.checked));
    li.appendChild(check);

    // Body
    const body = document.createElement('div');
    body.className = 'task-body';

    const title = document.createElement('p');
    title.className = 'task-title';
    title.textContent = task.title;
    body.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const due = document.createElement('span');
    due.textContent = formatDateTime(task.dueAt) + ' (' + Reminders.formatRelative(new Date(task.dueAt).getTime()) + ')';
    meta.appendChild(due);

    const priTag = document.createElement('span');
    priTag.className = 'tag priority-' + task.priority;
    priTag.textContent = task.priority;
    meta.appendChild(priTag);

    if (task.category) {
      const cat = document.createElement('span');
      cat.className = 'tag';
      cat.textContent = task.category;
      meta.appendChild(cat);
    }

    if (task.repeat && task.repeat !== 'none') {
      const rep = document.createElement('span');
      rep.className = 'tag repeat';
      rep.textContent = 'repeats ' + task.repeat;
      meta.appendChild(rep);
    }

    if (task.remindBefore > 0) {
      const rb = document.createElement('span');
      rb.className = 'tag';
      rb.textContent = 'reminds ' + task.remindBefore + 'm before';
      meta.appendChild(rb);
    }

    if (overdue) {
      const od = document.createElement('span');
      od.className = 'tag overdue';
      od.textContent = 'overdue';
      meta.appendChild(od);
    }

    body.appendChild(meta);

    if (task.notes) {
      const notes = document.createElement('p');
      notes.className = 'task-notes';
      notes.textContent = task.notes;
      body.appendChild(notes);
    }

    li.appendChild(body);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const snoozeBtn = document.createElement('button');
    snoozeBtn.className = 'icon-btn';
    snoozeBtn.type = 'button';
    snoozeBtn.title = 'Snooze 10 minutes';
    snoozeBtn.textContent = 'Snooze';
    snoozeBtn.addEventListener('click', () => snooze(task.id, 10));
    actions.appendChild(snoozeBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn danger';
    delBtn.type = 'button';
    delBtn.title = 'Delete task';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => deleteTask(task.id));
    actions.appendChild(delBtn);

    li.appendChild(actions);
    return li;
  }

  function toggleComplete(id, done) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    t.completed = done;
    if (done) {
      t.remindedPre = true;
      t.remindedDue = true;
    }
    persist();
    render();
  }

  function deleteTask(id) {
    tasks = tasks.filter(x => x.id !== id);
    persist();
    render();
  }

  function snooze(id, minutes) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const base = Math.max(new Date(t.dueAt).getTime(), Date.now());
    const next = new Date(base + minutes * 60000);
    t.dueAt = next.toISOString();
    t.remindedPre = false;
    t.remindedDue = false;
    persist();
    render();
  }

  function refreshNotificationStatus() {
    const perm = Reminders.currentPermission();
    notificationStatus.textContent = 'Notifications: ' + perm;
    notificationStatus.classList.remove('granted', 'denied', 'default');
    if (perm === 'granted') notificationStatus.classList.add('granted');
    else if (perm === 'denied') notificationStatus.classList.add('denied');
    else if (perm === 'default') notificationStatus.classList.add('default');
  }

  // ---- Events ----
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const task = createTaskFromForm();
    if (!task) return;
    tasks.push(task);
    persist();
    form.reset();
    // restore default number for the remind field after reset
    document.getElementById('remindBefore').value = '10';
    document.getElementById('priority').value = 'medium';
    render();
    Reminders.tick();
  });

  filterSelect.addEventListener('change', render);

  clearCompletedBtn.addEventListener('click', () => {
    tasks = tasks.filter(t => !t.completed);
    persist();
    render();
  });

  enableNotificationsBtn.addEventListener('click', async () => {
    await Reminders.requestPermission();
    refreshNotificationStatus();
  });

  // Set a sane default for the due-at input (now + 1h, rounded to minute).
  (function setDefaultDue() {
    const input = document.getElementById('dueAt');
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    input.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  })();

  // ---- Boot ----
  refreshNotificationStatus();
  render();
  Reminders.start({
    getTasks: getTasks,
    saveTasks: saveTasks,
    onChange: render,
    checkEveryMs: 30 * 1000,
  });

  // Re-render once per minute to refresh relative times / overdue highlights.
  setInterval(render, 60 * 1000);
})();
