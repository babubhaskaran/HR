# Task Manager (Next.js + Supabase)

Production-ready task manager built with Next.js App Router, Supabase Auth/Database, TypeScript, and Tailwind CSS.

## Features

- Email/password login with Supabase Auth
- Redirect unauthenticated users to `/login` from dashboard session check
- Task dashboard for authenticated users only
- CRUD for tasks (create, inline edit, delete)
- Status and priority updates
- Filters by status and priority
- Dark, mobile-friendly UI

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase (`@supabase/supabase-js`)

## Project Structure

```txt
/app
  /components
    task-dashboard.tsx
  /dashboard
    page.tsx
  /login
    page.tsx
  globals.css
  layout.tsx
  page.tsx
/lib
  supabaseClient.ts
```

## 1) Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000

## 2) Connect Supabase

Create a Supabase project and set environment variables in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Create table and enable RLS:

```sql
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  notes text,
  status text not null default 'Not Started',
  priority text not null default 'Medium',
  owner text,
  region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "Users can read own tasks"
on public.tasks for select
using (auth.uid() = user_id);

create policy "Users can insert own tasks"
on public.tasks for insert
with check (auth.uid() = user_id);

create policy "Users can update own tasks"
on public.tasks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own tasks"
on public.tasks for delete
using (auth.uid() = user_id);
```

In Supabase Auth settings, enable email/password sign-in. Create at least one user in Authentication > Users.

## 3) Deploy to Vercel

1. Push repository to GitHub.
2. Import project into Vercel.
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.

Vercel build command: `npm run build`
