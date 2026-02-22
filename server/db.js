const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'data.sqlite');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCallback(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    country TEXT NOT NULL,
    theme TEXT NOT NULL,
    responsibility TEXT NOT NULL,
    horizon TEXT NOT NULL CHECK (horizon IN ('NOW','BUILD','MONITOR')),
    status TEXT NOT NULL CHECK (status IN ('Not Started','In Progress','Completed')),
    rag TEXT NOT NULL CHECK (rag IN ('Red','Amber','Green')),
    notes TEXT DEFAULT '',
    parent_id TEXT,
    is_container INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    confirmed INTEGER NOT NULL DEFAULT 0,
    updated_action TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(parent_id) REFERENCES tasks(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    FOREIGN KEY(task_id) REFERENCES tasks(id)
  )`);
}

async function seedTasks() {
  const existing = await get('SELECT COUNT(*) as count FROM tasks');
  if (existing && existing.count > 0) return;

  const now = new Date().toISOString();
  const parentId = uuidv4();
  const sampleTasks = [
    {
      id: parentId,
      title: 'Warehouse Stabilization Program',
      description: 'Cross-functional remediation program for Q3 fulfillment disruptions.',
      country: 'UK',
      theme: 'Operations',
      responsibility: 'COO Office',
      horizon: 'BUILD',
      status: 'In Progress',
      rag: 'Amber',
      notes: 'Parent container for all stabilization tracks.',
      parent_id: null,
      is_container: 1
    },
    {
      id: uuidv4(),
      title: 'Staffing spike response plan',
      description: 'Align temporary staffing vendors for next 8 weeks.',
      country: 'UK',
      theme: 'People',
      responsibility: 'Head of HR Ops',
      horizon: 'NOW',
      status: 'In Progress',
      rag: 'Red',
      notes: 'Need board visibility before Friday.',
      parent_id: parentId,
      is_container: 0
    },
    {
      id: uuidv4(),
      title: 'Dock automation pilot',
      description: 'Pilot conveyor sorting automation in two hubs.',
      country: 'Germany',
      theme: 'Automation',
      responsibility: 'VP Engineering',
      horizon: 'BUILD',
      status: 'Not Started',
      rag: 'Amber',
      notes: '',
      parent_id: parentId,
      is_container: 0
    },
    {
      id: uuidv4(),
      title: 'Regulatory watch: cross-border VAT adjustments',
      description: 'Monitor policy changes and prepare compliance position.',
      country: 'France',
      theme: 'Compliance',
      responsibility: 'General Counsel',
      horizon: 'MONITOR',
      status: 'In Progress',
      rag: 'Green',
      notes: 'No action until legal memo lands.',
      parent_id: null,
      is_container: 0
    }
  ];

  for (const task of sampleTasks) {
    await run(
      `INSERT INTO tasks (
        id, title, description, country, theme, responsibility, horizon, status, rag,
        notes, parent_id, is_container, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.description,
        task.country,
        task.theme,
        task.responsibility,
        task.horizon,
        task.status,
        task.rag,
        task.notes,
        task.parent_id,
        task.is_container,
        now,
        now
      ]
    );
  }
}

module.exports = { db, run, get, all, initDb, seedTasks, uuidv4 };
