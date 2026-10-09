
// ==/UserScript==

(function () {
  'use strict';

  /* ================= SETTINGS ================= */
  const API = 'https://api.niftypm.com';
  const CENTRAL_PROJECT_ID = 'aBJKVSqLoDsm';          // CAD CENTRAL
  // CAD CENTRAL status -> which column it goes to on the designer board
  const RULES = [
    { from: /^new\s*cad$/i,   label: 'New Jobs', to: /^new\s*jobs?$/i,  toFallback: /new/i },
    { from: /^revisions?$/i,  label: 'Revision', to: /^revisions?(\s*jobs?)?$/i, toFallback: /revision/i },
  ];
  const ruleFor = name => RULES.find(r => r.from.test((name || '').trim())) || null;
  const DESIGNER_PROJECT_RE = /^CAD\s*-\s*/i;         // designer boards are named "CAD - Name"
  const EXCLUDE_PROJECTS = [/central/i];              // boards to hide from the list (add names as needed)
  const TARGET_STATUS_RE = /^new\s*jobs?$/i;          // target column on the designer board
  const TARGET_STATUS_FALLBACK_RE = /new/i;
  const REVISION_STATUS_RE = /revision/i;
  const COUNT_CACHE_MS = 2 * 60 * 1000;
  /* ============================================ */

  const LOG = (...a) => console.log('[CAD-QA]', ...a);

  // ---------- state ----------
  let authHeader = null;             // the app's own Authorization header (kept in memory only, never saved)
  let baseHeaders = {};              // other app headers (Device-Id, APP-Version)
  const tasksByNice = new Map();     // nice_id -> {id, nice_id, task_group, project, name}
  const groupsByProject = new Map(); // projectId -> [{id,name}]
  const projects = new Map();        // id -> {id,name}
  const countCache = new Map();      // projectId -> {t, newJobs, revision}

  // ---------- XHR hook: pick up headers and data from the app's own requests ----------
  const XO = XMLHttpRequest.prototype.open;
  const XH = XMLHttpRequest.prototype.setRequestHeader;
  const XS = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (m, u) {
    this.__qaUrl = String(u || '');
    return XO.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    try {
      if (this.__qaUrl && this.__qaUrl.indexOf(API) === 0) {
        const lk = String(k).toLowerCase();
        if (lk === 'authorization') authHeader = v;
        else if (lk === 'device-id' || lk === 'app-version') baseHeaders[k] = v;
      }
    } catch (e) {}
    return XH.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    const x = this;
    if (x.__qaUrl && x.__qaUrl.indexOf(API) === 0) {
      x.addEventListener('load', () => {
        try { ingest(x.responseURL || x.__qaUrl, x.responseText); } catch (e) {}
      });
    }
    return XS.apply(this, arguments);
  };

  function listOf(j, ...keys) {
    if (Array.isArray(j)) return j;
    for (const k of keys) if (j && Array.isArray(j[k])) return j[k];
    return [];
  }

  function ingest(url, text) {
    if (!text || text[0] !== '{' && text[0] !== '[') return;
    const path = url.replace(API, '').split('?')[0];
    if (path === '/tasks') {
      const j = JSON.parse(text);
      listOf(j, 'tasks', 'items').forEach(rememberTask);
    } else if (path === '/task_groups') {
      const pid = new URL(url).searchParams.get('project_id');
      const j = JSON.parse(text);
      const items = listOf(j, 'items', 'task_groups');
      if (pid && items.length) groupsByProject.set(pid, items.map(g => ({ id: g.id, name: (g.name || '').trim() })));
    } else if (path === '/users/me/events') {
      const j = JSON.parse(text);
      listOf(j, 'events', 'items').forEach(ev => {
        const pl = ev && ev.payload;
        if (!pl || !pl.id || !pl.nice_id || !/task/.test(ev.type || '')) return;
        const old = [...tasksByNice.values()].find(t => t.id === pl.id);
        if (old && old.nice_id !== pl.nice_id) tasksByNice.delete(old.nice_id);
        rememberTask(Object.assign({}, old || {}, pl, { project: pl.project || (old && old.nice_id === pl.nice_id ? old.project : undefined) }));
      });
    } else if (path === '/projects') {
      const j = JSON.parse(text);
      listOf(j, 'items', 'projects').forEach(p => {
        if (p && p.id && p.name && !p.archived) projects.set(p.id, { id: p.id, name: p.name.trim() });
      });
    }
  }
  function rememberTask(t) {
    if (t && t.id && t.nice_id) {
      const prev = tasksByNice.get(t.nice_id) || {};
      tasksByNice.set(t.nice_id, { id: t.id, nice_id: t.nice_id, task_group: t.task_group || prev.task_group, project: t.project || prev.project, name: t.name || prev.name });
    }
  }

  // ---------- our own API calls (using the app's headers) ----------
  function uuid() {
    return (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    }));
  }
  async function api(method, path, body) {
    if (!authHeader) throw new Error('Login session not detected yet — please refresh the page once.');
    const headers = Object.assign({
      'Accept': 'application/json, text/plain, */*',
      'Authorization': authHeader,
      'X-Request-Id': uuid(),
      'x-timestamp': String(Math.floor(Date.now() / 1000)),
    }, baseHeaders);
    if (body) headers['Content-Type'] = 'application/json';
    const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const txt = await r.text();
    if (!r.ok) throw new Error(`API ${r.status}: ${txt.slice(0, 200)}`);
    return txt ? JSON.parse(txt) : {};
  }

  async function getGroups(pid, force) {
    if (!force && groupsByProject.has(pid)) return groupsByProject.get(pid);
    const j = await api('GET', `/task_groups?project_id=${encodeURIComponent(pid)}&offset=0&limit=1000`);
    const items = listOf(j, 'items', 'task_groups').map(g => ({ id: g.id, name: (g.name || '').trim() }));
    groupsByProject.set(pid, items);
    return items;
  }

  async function loadProjects() {
    if ([...projects.values()].some(p => DESIGNER_PROJECT_RE.test(p.name))) return;
    let offset = 0;
    for (let i = 0; i < 10; i++) {
      const j = await api('GET', `/projects?archived=false&limit=300&offset=${offset}`);
      const items = listOf(j, 'items', 'projects');
      items.forEach(p => { if (p && p.id && p.name && !p.archived) projects.set(p.id, { id: p.id, name: p.name.trim() }); });
      if (!j.hasMore || !items.length) break;
      offset += items.length;
    }
  }

  async function findTaskByNice(nice) {
    if (tasksByNice.has(nice)) return tasksByNice.get(nice);
    // app has not loaded it yet — fetch CAD CENTRAL tasks ourselves
    let offset = 0;
    for (let i = 0; i < 20; i++) {
      const j = await api('GET', `/tasks?project_ids=${CENTRAL_PROJECT_ID}&include_completed=false&include_archived=false&offset=${offset}&limit=1000`);
      const items = listOf(j, 'tasks', 'items');
      items.forEach(rememberTask);
      if (tasksByNice.has(nice) || !j.hasMore || !items.length) break;
      offset += items.length;
    }
    return tasksByNice.get(nice) || null;
  }

  function designerProjects() {
    return [...projects.values()]
      .filter(p => DESIGNER_PROJECT_RE.test(p.name) && !EXCLUDE_PROJECTS.some(re => re.test(p.name)))
      .sort((a, b) => shortName(a.name).localeCompare(shortName(b.name)));
  }
  const shortName = n => n.replace(DESIGNER_PROJECT_RE, '').trim();

  function pickGroup(groups, re, fallback) {
    return groups.find(g => re.test(g.name)) || (fallback && groups.find(g => fallback.test(g.name))) || null;
  }

  async function getCounts(pid, force) {
    const c = countCache.get(pid);
    if (!force && c && Date.now() - c.t < COUNT_CACHE_MS) return c;
    const groups = await getGroups(pid);
    const ng = pickGroup(groups, TARGET_STATUS_RE, TARGET_STATUS_FALLBACK_RE);
    const rg = pickGroup(groups, REVISION_STATUS_RE);
    let offset = 0, newJobs = 0, revision = 0;
    for (let i = 0; i < 10; i++) {
      const j = await api('GET', `/tasks?project_ids=${encodeURIComponent(pid)}&include_completed=false&include_archived=false&offset=${offset}&limit=1000`);
      const items = listOf(j, 'tasks', 'items');
      items.forEach(t => {
        if (t.archived || t.completed) return;
        if (ng && t.task_group === ng.id) newJobs++;
        if (rg && t.task_group === rg.id) revision++;
      });
      if (!j.hasMore || !items.length) break;
      offset += items.length;
    }
    const res = { t: Date.now(), newJobs, revision };
    countCache.set(pid, res);
    return res;
  }

  async function moveTask(taskId, groupId) {
    return api('POST', `/tasks/${encodeURIComponent(taskId)}/moveOrder/v2`, { to: { type: 'task_group', id: groupId } });
  }

  // ---------- UI ----------
  const STYLE = `
  #cadqa-panel{position:fixed;right:10px;top:150px;width:230px;max-height:calc(100vh - 190px);display:flex;flex-direction:column;
    background:#fff;border:1px solid #d9dee5;border-radius:10px;box-shadow:0 8px 24px rgba(20,30,50,.18);z-index:2147483000;
    font:13px/1.35 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1d2433}
  #cadqa-panel.min .cadqa-body{display:none}
  #cadqa-panel .cadqa-head{display:flex;align-items:center;gap:6px;padding:8px 10px;background:#14a38b;color:#fff;border-radius:10px 10px 0 0;cursor:pointer;user-select:none}
  #cadqa-panel.min .cadqa-head{border-radius:10px}
  #cadqa-panel .cadqa-head b{flex:1;font-size:12px;letter-spacing:.3px}
  #cadqa-panel .cadqa-head button{background:rgba(255,255,255,.2);border:0;color:#fff;border-radius:5px;padding:2px 6px;cursor:pointer;font-size:12px}
  #cadqa-panel .cadqa-body{overflow:auto;padding:6px}
  #cadqa-panel .cadqa-search{width:100%;box-sizing:border-box;border:1px solid #d9dee5;border-radius:6px;padding:5px 8px;margin-bottom:6px;font-size:12px}
  #cadqa-panel .cadqa-legend{font-size:11px;color:#6b7383;margin:0 2px 6px}
  #cadqa-panel .cadqa-btn{display:flex;width:100%;align-items:center;gap:6px;text-align:left;background:#f6f8fa;border:1px solid #e3e7ec;
    border-radius:7px;padding:7px 8px;margin-bottom:5px;cursor:pointer;font-size:13px;color:#1d2433}
  #cadqa-panel .cadqa-btn:hover{background:#e7f7f3;border-color:#14a38b}
  #cadqa-panel .cadqa-btn[disabled]{opacity:.55;cursor:wait}
  #cadqa-panel .cadqa-name{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #cadqa-panel .cadqa-c{font-size:11px;font-weight:700;border-radius:10px;padding:1px 6px;min-width:12px;text-align:center}
  #cadqa-panel .cadqa-n{background:#dff3ee;color:#0f7a68}
  #cadqa-panel .cadqa-r{background:#fff1d6;color:#9a6200}
  #cadqa-panel .cadqa-msg{font-size:12px;color:#6b7383;padding:6px 4px}
  #cadqa-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#1d2433;color:#fff;padding:10px 14px;border-radius:8px;
    z-index:2147483001;font:13px -apple-system,Segoe UI,Roboto,Arial,sans-serif;display:flex;gap:10px;align-items:center;box-shadow:0 6px 18px rgba(0,0,0,.25)}
  #cadqa-toast button{background:#14a38b;border:0;color:#fff;border-radius:5px;padding:4px 10px;cursor:pointer;font-weight:600}
  #cadqa-toast.err{background:#b3261e}`;

  let panel = null, currentNice = null, currentTask = null, currentRule = null, busy = false;
  let minimized = false;
  try { minimized = localStorage.getItem('cadqa_min') === '1'; } catch (e) {}

  function ensureStyle() {
    if (document.getElementById('cadqa-style')) return;
    const s = document.createElement('style'); s.id = 'cadqa-style'; s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function toast(msg, opts = {}) {
    const old = document.getElementById('cadqa-toast'); if (old) old.remove();
    const t = document.createElement('div'); t.id = 'cadqa-toast'; if (opts.error) t.className = 'err';
    const span = document.createElement('span'); span.textContent = msg; t.appendChild(span);
    if (opts.undo) {
      const b = document.createElement('button'); b.textContent = 'Undo';
      b.onclick = () => { t.remove(); opts.undo(); };
      t.appendChild(b);
    }
    document.body.appendChild(t);
    setTimeout(() => t.remove(), opts.ms || 7000);
  }

  function removePanel() { if (panel) { panel.remove(); panel = null; } }

  function buildPanel() {
    ensureStyle();
    removePanel();
    panel = document.createElement('div');
    panel.id = 'cadqa-panel';
    if (minimized) panel.classList.add('min');
    panel.innerHTML = `
      <div class="cadqa-head"><b>SEND TO DESIGNER → ${currentRule ? currentRule.label.toUpperCase() : ''}</b><button class="cadqa-refresh" title="Refresh counts">⟳</button><button class="cadqa-min">${minimized ? '▢' : '–'}</button></div>
      <div class="cadqa-body">
        <input class="cadqa-search" placeholder="Search name…">
        <div class="cadqa-legend"><span class="cadqa-c cadqa-n">N</span> New Jobs &nbsp; <span class="cadqa-c cadqa-r">R</span> Revision</div>
        <div class="cadqa-list"><div class="cadqa-msg">Loading…</div></div>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('.cadqa-head').addEventListener('click', e => {
      if (e.target.closest('.cadqa-refresh')) return;
      minimized = !minimized;
      panel.classList.toggle('min', minimized);
      panel.querySelector('.cadqa-min').textContent = minimized ? '▢' : '–';
      try { localStorage.setItem('cadqa_min', minimized ? '1' : '0'); } catch (err) {}
    });
    panel.querySelector('.cadqa-refresh').addEventListener('click', e => { e.stopPropagation(); renderList(true); });
    panel.querySelector('.cadqa-search').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      panel.querySelectorAll('.cadqa-btn').forEach(b => { b.style.display = b.dataset.name.toLowerCase().includes(q) ? '' : 'none'; });
    });
    renderList(false);
  }

  async function renderList(forceCounts) {
    const list = panel && panel.querySelector('.cadqa-list');
    if (!list) return;
    try {
      await loadProjects();
    } catch (e) {
      list.innerHTML = `<div class="cadqa-msg">Could not load project list: ${e.message}</div>`;
      return;
    }
    const ds = designerProjects();
    if (!ds.length) { list.innerHTML = '<div class="cadqa-msg">No "CAD - Name" boards found.</div>'; return; }
    list.innerHTML = '';
    ds.forEach(p => {
      const b = document.createElement('button');
      b.className = 'cadqa-btn'; b.dataset.pid = p.id; b.dataset.name = shortName(p.name);
      b.title = `${p.name} → send to ${currentRule ? currentRule.label : 'New Jobs'}`;
      b.innerHTML = `<span class="cadqa-name"></span><span class="cadqa-c cadqa-n">…</span><span class="cadqa-c cadqa-r">…</span>`;
      b.querySelector('.cadqa-name').textContent = shortName(p.name);
      b.addEventListener('click', () => onDesignerClick(p, b));
      list.appendChild(b);
    });
    // counts — 4 boards at a time
    const queue = ds.slice();
    const worker = async () => {
      while (queue.length) {
        const p = queue.shift();
        const b = list.querySelector(`.cadqa-btn[data-pid="${CSS.escape(p.id)}"]`);
        try {
          const c = await getCounts(p.id, forceCounts);
          if (b) { b.querySelector('.cadqa-n').textContent = c.newJobs; b.querySelector('.cadqa-r').textContent = c.revision; }
        } catch (e) {
          if (b) { b.querySelector('.cadqa-n').textContent = '?'; b.querySelector('.cadqa-r').textContent = '?'; }
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }

  async function onDesignerClick(p, btn) {
    if (busy || !currentTask) return;
    busy = true;
    const task = currentTask;
    const label = btn.querySelector('.cadqa-name').textContent;
    panel.querySelectorAll('.cadqa-btn').forEach(b => b.disabled = true);
    btn.querySelector('.cadqa-name').textContent = 'Moving…';
    try {
      const groups = await getGroups(p.id);
      const rule = currentRule;
      const target = pickGroup(groups, rule.to, rule.toFallback);
      if (!target) throw new Error(`${p.name}: "${rule.label}" column not found`);
      const fromGroup = task.task_group;
      await moveTask(task.id, target.id);
      tasksByNice.delete(task.nice_id);
      countCache.delete(p.id);
      LOG('moved', task.nice_id, '->', p.name, target.name);
      removePanel();
      currentTask = null; // keep currentNice so the old URL is not re-fetched
      toast(`✓ ${task.name || task.nice_id} → ${label} (${rule.label})`, {
        undo: async () => {
          try {
            await moveTask(task.id, fromGroup);
            countCache.delete(p.id);
            toast('↩ Moved back to CAD CENTRAL', { ms: 4000 });
          } catch (e) { toast('Undo failed: ' + e.message, { error: true }); }
        },
      });
    } catch (e) {
      toast('Move failed: ' + e.message, { error: true });
      btn.querySelector('.cadqa-name').textContent = label;
      panel && panel.querySelectorAll('.cadqa-btn').forEach(b => b.disabled = false);
    } finally {
      busy = false;
    }
  }

  // ---------- show / hide panel based on URL ----------
  async function check() {
    const m = location.pathname.match(/^\/([^/]+)\/task\/([A-Za-z]+-\d+)/);
    if (!m || m[1] !== CENTRAL_PROJECT_ID) { currentNice = null; currentTask = null; removePanel(); return; }
    const nice = m[2];
    if (nice === currentNice) {
      // same task still open — hide panel if its status changed on the page
      const t = tasksByNice.get(nice), gs = groupsByProject.get(CENTRAL_PROJECT_ID);
      if (t && gs && !busy) {
        const g = gs.find(x => x.id === t.task_group);
        const r = g ? ruleFor(g.name) : null;
        // status changed on the page: hide, or rebuild for the new status
        if ((panel && r !== currentRule) || (!panel && r)) { removePanel(); currentTask = null; currentNice = null; }
      }
      return;
    }
    currentNice = nice; currentTask = null; removePanel();
    try {
      const [task, groups] = await Promise.all([findTaskByNice(nice), getGroups(CENTRAL_PROJECT_ID)]);
      if (currentNice !== nice) return;
      if (!task || task.project && task.project !== CENTRAL_PROJECT_ID) return;
      const g = groups.find(x => x.id === task.task_group);
      const rule = g && ruleFor(g.name);
      if (!rule) return;
      currentTask = task; currentRule = rule;
      buildPanel();
    } catch (e) {
      LOG('check failed', e);
      currentNice = null; // retry on next tick
    }
  }

  function start() {
    setInterval(() => { if (!busy) check(); }, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
