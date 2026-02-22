const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get, all, initDb, seedTasks, uuidv4 } = require('./server/db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function mapTask(task) {
  return {
    ...task,
    archived: Boolean(task.archived),
    confirmed: Boolean(task.confirmed),
    is_container: Boolean(task.is_container)
  };
}

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    await run('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)', [id, email, passwordHash, createdAt]);
    const token = jwt.sign({ userId: id, email }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ token });
  } catch (error) {
    if (String(error).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: 'Could not register' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ token });
});

app.get('/api/tasks', auth, async (req, res) => {
  const { horizon, country, theme, parent_id, scope = 'all' } = req.query;
  const conditions = ['archived = 0'];
  const params = [];

  if (horizon) {
    conditions.push('horizon = ?');
    params.push(horizon);
  }
  if (country) {
    conditions.push('country = ?');
    params.push(country);
  }
  if (theme) {
    conditions.push('theme = ?');
    params.push(theme);
  }
  if (scope === 'parents') conditions.push('is_container = 1');
  if (scope === 'subtasks') conditions.push('parent_id IS NOT NULL');
  if (parent_id) {
    conditions.push('parent_id = ?');
    params.push(parent_id);
  }

  const rows = await all(`SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC`, params);
  const tasks = [];
  for (const row of rows) {
    const task = mapTask(row);
    if (task.is_container) {
      const progress = await get(
        `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed
         FROM tasks WHERE parent_id = ? AND archived = 0`,
        [task.id]
      );
      task.progress = {
        completed: progress?.completed || 0,
        total: progress?.total || 0
      };
    }
    tasks.push(task);
  }

  return res.json({ tasks });
});

app.get('/api/tasks/:id', auth, async (req, res) => {
  const task = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) return res.status(404).json({ error: 'Not found' });
  return res.json({ task: mapTask(task) });
});

app.post('/api/tasks', auth, async (req, res) => {
  const payload = req.body;
  const now = new Date().toISOString();
  const id = uuidv4();
  await run(
    `INSERT INTO tasks (
      id, title, description, country, theme, responsibility, horizon, status,
      rag, notes, parent_id, is_container, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.title,
      payload.description || '',
      payload.country,
      payload.theme,
      payload.responsibility,
      payload.horizon || 'NOW',
      payload.status || 'Not Started',
      payload.rag || 'Amber',
      payload.notes || '',
      payload.parent_id || null,
      payload.is_container ? 1 : 0,
      now,
      now
    ]
  );
  const task = await get('SELECT * FROM tasks WHERE id = ?', [id]);
  return res.status(201).json({ task: mapTask(task) });
});

app.patch('/api/tasks/:id', auth, async (req, res) => {
  const current = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!current) return res.status(404).json({ error: 'Not found' });

  const merged = { ...current, ...req.body, updated_at: new Date().toISOString() };
  await run(
    `UPDATE tasks SET
      title = ?, description = ?, country = ?, theme = ?, responsibility = ?, horizon = ?,
      status = ?, rag = ?, notes = ?, parent_id = ?, is_container = ?, updated_at = ?
      WHERE id = ?`,
    [
      merged.title,
      merged.description,
      merged.country,
      merged.theme,
      merged.responsibility,
      merged.horizon,
      merged.status,
      merged.rag,
      merged.notes,
      merged.parent_id || null,
      merged.is_container ? 1 : 0,
      merged.updated_at,
      req.params.id
    ]
  );
  const task = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  return res.json({ task: mapTask(task) });
});

app.post('/api/tasks/:id/swipe', auth, async (req, res) => {
  const { action } = req.body;
  const task = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const now = new Date().toISOString();
  if (action === 'keep') {
    await run('UPDATE tasks SET confirmed = 1, updated_action = ?, updated_at = ? WHERE id = ?', ['keep', now, req.params.id]);
  } else if (action === 'delete') {
    await run('UPDATE tasks SET archived = 1, updated_action = ?, updated_at = ? WHERE id = ?', ['delete', now, req.params.id]);
  } else if (action === 'defer') {
    await run("UPDATE tasks SET horizon = 'MONITOR', updated_action = ?, updated_at = ? WHERE id = ?", ['defer', now, req.params.id]);
  } else {
    return res.status(400).json({ error: 'Unsupported action' });
  }

  await run('INSERT INTO reviews (id, task_id, action, reviewed_at) VALUES (?, ?, ?, ?)', [uuidv4(), req.params.id, action, now]);
  const updated = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  return res.json({ task: mapTask(updated) });
});

app.get('/api/dashboard/velocity', auth, async (_req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const reviewed = await get('SELECT COUNT(*) as count FROM reviews WHERE reviewed_at >= ?', [todayIso]);
  const kept = await get("SELECT COUNT(*) as count FROM reviews WHERE reviewed_at >= ? AND action = 'keep'", [todayIso]);
  const deleted = await get("SELECT COUNT(*) as count FROM reviews WHERE reviewed_at >= ? AND action = 'delete'", [todayIso]);
  const horizonDistribution = await all(
    `SELECT horizon, COUNT(*) as count FROM tasks WHERE archived = 0 GROUP BY horizon ORDER BY count DESC`
  );

  return res.json({
    tasksReviewedToday: reviewed.count,
    keptDeletedRatio: `${kept.count}:${deleted.count}`,
    horizonDistribution
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

(async () => {
  await initDb();
  await seedTasks();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})();
