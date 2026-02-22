const { useState, useEffect, useMemo, useRef } = React;

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [form, setForm] = useState({ email: 'exec@example.com', password: 'password123' });
  const [tasks, setTasks] = useState([]);
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState({ horizon: 'NOW', country: '', theme: '', scope: 'all', parent_id: '' });
  const [velocity, setVelocity] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const cardRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });

  const currentTask = tasks[index];

  const api = async (url, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, { ...options, headers });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Request failed');
    return body;
  };

  const loadTasks = async () => {
    if (!token) return;
    const params = new URLSearchParams(Object.entries(filter).filter(([, v]) => v));
    const [taskRes, velocityRes] = await Promise.all([
      api(`/api/tasks?${params.toString()}`),
      api('/api/dashboard/velocity')
    ]);
    setTasks(taskRes.tasks);
    setIndex(0);
    setVelocity(velocityRes);
  };

  useEffect(() => { loadTasks().catch(alert); }, [token, filter.horizon, filter.country, filter.theme, filter.scope, filter.parent_id]);

  useEffect(() => {
    const onKey = (e) => {
      if (!currentTask) return;
      if (e.key === 'ArrowRight') handleSwipe('keep');
      if (e.key === 'ArrowLeft') handleSwipe('delete');
      if (e.key === 'ArrowDown') handleSwipe('defer');
      if (e.key === 'ArrowUp') setEditingTask(currentTask);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentTask]);

  const handleAuth = async (type) => {
    const res = await api(`/api/auth/${type}`, { method: 'POST', body: JSON.stringify(form), headers: {} });
    localStorage.setItem('token', res.token);
    setToken(res.token);
  };

  const handleSwipe = async (action) => {
    await api(`/api/tasks/${currentTask.id}/swipe`, { method: 'POST', body: JSON.stringify({ action }) });
    await loadTasks();
  };

  const ragClass = useMemo(() => {
    if (!currentTask) return '';
    return currentTask.rag.toLowerCase();
  }, [currentTask]);

  const onPointerDown = (event) => {
    startRef.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event) => {
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 80) {
      if (dx > 0) handleSwipe('keep');
      else handleSwipe('delete');
    } else if (Math.abs(dy) > 80) {
      if (dy > 0) handleSwipe('defer');
      else setEditingTask(currentTask);
    }
  };

  const saveEdit = async () => {
    await api(`/api/tasks/${editingTask.id}`, { method: 'PATCH', body: JSON.stringify(editingTask) });
    setEditingTask(null);
    await loadTasks();
  };

  const createSubtask = async () => {
    const title = prompt('Sub-task title');
    if (!title) return;
    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: '',
        country: editingTask.country,
        theme: editingTask.theme,
        responsibility: editingTask.responsibility,
        horizon: 'NOW',
        status: 'Not Started',
        rag: 'Amber',
        parent_id: editingTask.id
      })
    });
    await loadTasks();
  };

  if (!token) {
    return <div className="app"><h1>Executive Decision Accelerator</h1><p>Sign in to start high-velocity review.</p>
      <input placeholder="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      <input type="password" placeholder="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
      <div className="actions"><button onClick={() => handleAuth('login')}>Login</button><button onClick={() => handleAuth('register')}>Register</button></div>
    </div>;
  }

  return <div className="app">
    <div className="header"><h2>Swipe Review Mode</h2><button onClick={() => { localStorage.removeItem('token'); setToken(''); }}>Logout</button></div>

    {velocity && <div className="metric-grid">
      <div className="metric"><strong>{velocity.tasksReviewedToday}</strong><div>Reviewed Today</div></div>
      <div className="metric"><strong>{velocity.keptDeletedRatio}</strong><div>Keep:Delete</div></div>
      <div className="metric"><strong>{velocity.horizonDistribution.map(h => `${h.horizon}:${h.count}`).join(' | ')}</strong><div>Horizons</div></div>
    </div>}

    <div className="controls">
      <select value={filter.horizon} onChange={e => setFilter({ ...filter, horizon: e.target.value })}>
        <option value="">All Horizons</option><option value="NOW">NOW</option><option value="BUILD">BUILD</option><option value="MONITOR">MONITOR</option>
      </select>
      <select value={filter.scope} onChange={e => setFilter({ ...filter, scope: e.target.value })}>
        <option value="all">All Tasks</option><option value="parents">Parent Containers</option><option value="subtasks">Sub-tasks</option>
      </select>
      <input placeholder="Country" value={filter.country} onChange={e => setFilter({ ...filter, country: e.target.value })} />
      <input placeholder="Theme" value={filter.theme} onChange={e => setFilter({ ...filter, theme: e.target.value })} />
    </div>

    {currentTask ? <div className={`card ${ragClass}`} ref={cardRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onClick={() => alert(currentTask.description)}>
      <div>
        <h3>{currentTask.title}</h3>
        <div className="badges">
          <span className="badge">{currentTask.country}</span>
          <span className="badge">{currentTask.horizon}</span>
          <span className="badge">RAG: {currentTask.rag}</span>
          <span className="badge">{currentTask.status}</span>
        </div>
        <p><strong>Owner:</strong> {currentTask.responsibility}</p>
        {currentTask.progress && <p><strong>Progress:</strong> {currentTask.progress.completed}/{currentTask.progress.total} complete</p>}
      </div>
      <small>Swipe → keep/delete, ↓ defer, ↑ edit, tap for details</small>
    </div> : <div className="empty">No tasks match the current filters.</div>}

    <div className="actions">
      <button disabled={!currentTask} onClick={() => handleSwipe('delete')}>Delete ⬅</button>
      <button disabled={!currentTask} onClick={() => handleSwipe('defer')}>Monitor ⬇</button>
      <button disabled={!currentTask} onClick={() => setEditingTask(currentTask)}>Comment/Edit ⬆</button>
      <button disabled={!currentTask} onClick={() => handleSwipe('keep')}>Keep ➡</button>
    </div>

    {editingTask && <div className="modal"><div className="modal-inner">
      <h3>Edit Task</h3>
      <input value={editingTask.responsibility} onChange={e => setEditingTask({ ...editingTask, responsibility: e.target.value })} placeholder="Responsibility" />
      <select value={editingTask.horizon} onChange={e => setEditingTask({ ...editingTask, horizon: e.target.value })}>
        <option>NOW</option><option>BUILD</option><option>MONITOR</option>
      </select>
      <select value={editingTask.rag} onChange={e => setEditingTask({ ...editingTask, rag: e.target.value })}>
        <option>Red</option><option>Amber</option><option>Green</option>
      </select>
      <textarea rows="4" value={editingTask.notes || ''} onChange={e => setEditingTask({ ...editingTask, notes: e.target.value })} placeholder="Add note" />
      <button onClick={() => setEditingTask({ ...editingTask, is_container: true })}>Convert to Parent Container</button>
      <button onClick={createSubtask}>Add Sub-task</button>
      <div className="actions"><button onClick={() => setEditingTask(null)}>Cancel</button><button onClick={saveEdit}>Save</button></div>
    </div></div>}
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
