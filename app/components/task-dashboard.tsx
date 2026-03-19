'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Task = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: 'Not Started' | 'In Progress' | 'Completed';
  priority: 'Low' | 'Medium' | 'High';
  owner: string | null;
  region: string | null;
  created_at: string;
  updated_at: string;
};

type TaskInput = Omit<Task, 'id' | 'created_at' | 'updated_at'>;

const defaultTask: TaskInput = {
  title: '',
  description: '',
  notes: '',
  status: 'Not Started',
  priority: 'Medium',
  owner: '',
  region: '',
};

export default function TaskDashboard() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState<TaskInput>(defaultTask);
  const [statusFilter, setStatusFilter] = useState<'All' | Task['status']>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | Task['priority']>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async (currentUserId: string) => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', currentUserId)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setIsLoading(false);
      return;
    }

    setTasks((data ?? []) as Task[]);
    setIsLoading(false);
  };

  useEffect(() => {
    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace('/login');
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email ?? '');
      fetchTasks(session.user.id);
    };

    loadSession();
  }, [router]);

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const statusMatch = statusFilter === 'All' || task.status === statusFilter;
        const priorityMatch = priorityFilter === 'All' || task.priority === priorityFilter;
        return statusMatch && priorityMatch;
      }),
    [tasks, statusFilter, priorityFilter],
  );

  const createTask = async () => {
    if (!userId) return;
    if (!newTask.title.trim()) {
      setError('Title is required.');
      return;
    }

    setError(null);
    const now = new Date().toISOString();

    const { error: insertError } = await supabase.from('tasks').insert({
      ...newTask,
      user_id: userId,
      created_at: now,
      updated_at: now,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNewTask(defaultTask);
    fetchTasks(userId);
  };

  const updateTask = async (id: string, patch: Partial<TaskInput>) => {
    if (!userId) return;
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              ...patch,
              updated_at: new Date().toISOString(),
            }
          : task,
      ),
    );
  };

  const deleteTask = async (id: string) => {
    if (!userId) return;
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setTasks((current) => current.filter((task) => task.id !== id));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Task Dashboard</h1>
            <p className="text-sm text-slate-400">Signed in as {userEmail}</p>
          </div>
          <button onClick={signOut} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-md text-sm w-fit">
            Sign Out
          </button>
        </header>

        <section className="bg-card border border-slate-800 rounded-xl p-4 space-y-3">
          <h2 className="font-medium">Create Task</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              placeholder="Title"
              value={newTask.title}
              onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
            />
            <input
              placeholder="Owner"
              value={newTask.owner ?? ''}
              onChange={(e) => setNewTask((prev) => ({ ...prev, owner: e.target.value }))}
            />
            <input
              placeholder="Description"
              value={newTask.description ?? ''}
              onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
            />
            <input
              placeholder="Region"
              value={newTask.region ?? ''}
              onChange={(e) => setNewTask((prev) => ({ ...prev, region: e.target.value }))}
            />
            <input
              placeholder="Notes"
              value={newTask.notes ?? ''}
              onChange={(e) => setNewTask((prev) => ({ ...prev, notes: e.target.value }))}
            />
            <select
              value={newTask.status}
              onChange={(e) => setNewTask((prev) => ({ ...prev, status: e.target.value as Task['status'] }))}
            >
              <option>Not Started</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask((prev) => ({ ...prev, priority: e.target.value as Task['priority'] }))}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
            <button onClick={createTask} className="bg-indigo-600 hover:bg-indigo-500 rounded-md px-4 py-2 font-medium">
              Add Task
            </button>
          </div>
          {error ? <p className="text-red-400 text-sm">{error}</p> : null}
        </section>

        <section className="bg-card border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <h2 className="font-medium">Tasks</h2>
            <div className="flex gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'All' | Task['status'])}>
                <option>All</option>
                <option>Not Started</option>
                <option>In Progress</option>
                <option>Completed</option>
              </select>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as 'All' | Task['priority'])}>
                <option>All</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>
          </div>

          {isLoading ? <p className="text-sm text-slate-400">Loading tasks...</p> : null}

          {!isLoading && visibleTasks.length === 0 ? (
            <p className="text-sm text-slate-400">No tasks found for current filters.</p>
          ) : null}

          <div className="space-y-3">
            {visibleTasks.map((task) => (
              <article key={task.id} className="border border-slate-800 rounded-lg p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
                <input value={task.title} onChange={(e) => updateTask(task.id, { title: e.target.value })} className="md:col-span-2" />
                <input
                  value={task.description ?? ''}
                  onChange={(e) => updateTask(task.id, { description: e.target.value })}
                  placeholder="Description"
                  className="md:col-span-2"
                />
                <input
                  value={task.notes ?? ''}
                  onChange={(e) => updateTask(task.id, { notes: e.target.value })}
                  placeholder="Notes"
                  className="md:col-span-2"
                />
                <select value={task.status} onChange={(e) => updateTask(task.id, { status: e.target.value as Task['status'] })}>
                  <option>Not Started</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
                <select
                  value={task.priority}
                  onChange={(e) => updateTask(task.id, { priority: e.target.value as Task['priority'] })}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
                <input value={task.owner ?? ''} onChange={(e) => updateTask(task.id, { owner: e.target.value })} placeholder="Owner" />
                <input value={task.region ?? ''} onChange={(e) => updateTask(task.id, { region: e.target.value })} placeholder="Region" />
                <button onClick={() => deleteTask(task.id)} className="bg-red-600 hover:bg-red-500 rounded-md px-3 py-2 text-sm">
                  Delete
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
