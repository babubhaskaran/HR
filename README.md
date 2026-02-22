# Executive Swipe Decision Accelerator

A lightweight task-management web app focused on executive decision velocity. Tasks are reviewed one at a time using swipe gestures and keyboard shortcuts.

## Stack
- **Frontend:** React (CDN + JSX via Babel)
- **Backend:** Node.js + Express
- **Database:** SQLite
- **Auth:** Email/password + JWT

## Project structure

- `server.js` - Express server and REST API routes
- `server/db.js` - SQLite schema + seed helpers
- `scripts/seed.js` - Manual seed runner
- `public/index.html` - Frontend shell
- `public/app.jsx` - Swipe UI, filters, modal editing
- `public/styles.css` - Mobile-first styles with RAG accents

## Features delivered
- Swipe review mode with one-task-at-a-time cards
  - Right: Keep active
  - Left: Soft-delete (archive)
  - Down: Move to MONITOR
  - Up: Open comment/edit modal
  - Tap: View full details
- Filtering by horizon, country, theme, parent/sub-task scope
- Parent container support with progress indicator (`x/y complete`)
- Comment/edit panel to update responsibility, horizon, notes, RAG
- Convert any task to parent container and add sub-tasks
- Basic auth (register/login)
- Decision velocity dashboard (reviewed today, keep/delete ratio, horizon distribution)
- Keyboard shortcuts
  - `→` Keep
  - `←` Delete
  - `↑` Comment/Edit
  - `↓` Move to MONITOR

## Setup

```bash
npm install
npm run seed
npm start
```

Then open: `http://localhost:3000`

## API overview

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`

### Tasks
- `GET /api/tasks?horizon=NOW&country=UK&theme=Operations&scope=parents&parent_id=<id>`
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/swipe` with `{ "action": "keep|delete|defer" }`

### Dashboard
- `GET /api/dashboard/velocity`

## Seed data
Includes a parent container task (`Warehouse Stabilization Program`) with sub-tasks and one MONITOR task.
