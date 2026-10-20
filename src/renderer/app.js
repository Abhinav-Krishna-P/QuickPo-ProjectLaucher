/* global Terminal, FitAddon, STACK_ICONS, STACK_LABELS */
(() => {
  const api = window.quickpo;
  const $ = (sel) => document.querySelector(sel);

  const listEl = $('#project-list');
  const tabsEl = $('#tabs');
  const termsEl = $('#terminals');
  const consoleEl = $('.console');
  const idleEl = $('#idle');
  const welcomeEl = $('#welcome');
  const viewEl = $('#project-view');
  const addBtn = $('#add-btn');
  const menuEl = $('#menu');

  const dlg = $('#project-dialog');
  const form = $('#project-form');
  const fPath = $('#f-path');
  const fName = $('#f-name');
  const fCommand = $('#f-command');
  const fSaveConfig = $('#f-save-config');
  const fAutostart = $('#f-autostart');
  const fError = $('#f-error');

  let projects = [];
  let maxProjects = 5;
  let editingId = null;
  let selectedId = null;
  let nodeVersion = '';
  let consoleView = 'term';
  /** id -> { term, fit, wrap, tab, logs, status, startedAt, partial } */
  const sessions = new Map();

  const byId = (id) => projects.find((p) => p.id === id);
  const statusOf = (id) => sessions.get(id)?.status || 'idle';
  const icon = (stack) => STACK_ICONS[stack] || STACK_ICONS.generic;
  const fmtTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const cleanError = (err) => String(err && err.message ? err.message : err).replace(/^.*Error: /, '');

  // ---------- Projects list ----------
  async function refreshProjects() {
    projects = await api.projects.list();
    if (selectedId && !byId(selectedId)) selectedId = null;
    render();
  }

  function render() {
    renderList();
    renderHeader();
  }

  function renderList() {
    listEl.innerHTML = '';
    projects.forEach((p, i) => {
      const status = statusOf(p.id);
      const running = status === 'running';
      const li = document.createElement('li');
      li.className = 'project' + (running ? ' running' : '') + (p.id === selectedId ? ' active' : '');
      li.style.setProperty('--i', String(i));
      li.innerHTML = `
        <span class="dot"></span>
        <span class="stack-icon">${icon(p.stack)}</span>
        <div class="info"><div class="name"></div><div class="path"></div></div>
        <button class="play" title="${running ? 'Stop' : 'Launch'}"><span class="tri"></span></button>
        <button class="kebab" title="More">&#8942;</button>
        <span class="cmd"></span>
        ${p.autoStart ? '<span class="auto" title="Launches when QuickPo opens">AUTO</span>' : ''}`;
      li.querySelector('.name').textContent = p.name;
      li.querySelector('.path').textContent = p.path;
      li.querySelector('.path').title = p.path;
      li.querySelector('.cmd').textContent = p.command || 'auto-detect';
      li.querySelector('.play').onclick = (e) => {
        e.stopPropagation();
        running ? stop(p.id) : launch(p.id);
      };
      li.querySelector('.kebab').onclick = (e) => {
        e.stopPropagation();
        openMenu(e.currentTarget, [
          { label: 'Edit config', fn: () => openDialog(p) },
          { label: 'Open folder', fn: () => api.projects.openFolder(p.path) },
          { label: running ? 'Restart' : 'Launch', fn: () => launch(p.id) },
          { label: 'Remove', danger: true, fn: () => removeProject(p) },
        ]);
      };
      li.onclick = () => select(p.id);
      listEl.appendChild(li);
    });
    const full = projects.length >= maxProjects;
    addBtn.disabled = full;
    $('#tab-add').disabled = full;
    $('#add-hint').textContent = `${projects.length} / ${maxProjects}`;
    $('#add-count').textContent = `${projects.length} / ${maxProjects}`;
    addBtn.title = full ? `Maximum of ${maxProjects} projects reached.` : '';
  }

  function renderHeader() {
    const p = byId(selectedId);
    welcomeEl.hidden = !!p;
    viewEl.hidden = !p;
    if (!p) return;
    const s = sessions.get(p.id);
    const status = statusOf(p.id);
    $('#ph-icon').innerHTML = icon(p.stack);
    $('#ph-name').textContent = p.name;
    $('#ph-path').textContent = p.path;
    $('#ph-cmd').textContent = p.command || 'auto-detect at launch';
    const badge = $('#ph-badge');
    badge.className = 'badge ' + status;
    badge.textContent = status === 'running' ? 'Running' : status === 'exited' ? 'Stopped' : 'Idle';
    const toggle = $('#ph-toggle');
    toggle.className = 'btn ' + (status === 'running' ? 'danger' : 'primary');
    toggle.innerHTML = status === 'running' ? '&#9632; Stop' : '&#9654; Launch';
    idleEl.hidden = !!s;
    for (const [sid, sess] of sessions) {
      sess.wrap.classList.toggle('active', sid === p.id);
      sess.tab.classList.toggle('active', sid === p.id);
    }
    const sb = $('#sb-status');
    sb.className = 'sb-status ' + status;
    sb.querySelector('span').textContent = status === 'running' ? 'Running' : status === 'exited' ? `Exited (${s?.exitCode ?? '?'})` : 'Idle';
    $('#sb-cmd').textContent = s?.command || p.command || '';
    $('#sb-started').textContent = s?.startedAt ? `Started ${fmtTime(s.startedAt)}` : '';
    $('#sb-node').textContent = nodeVersion ? `Node ${nodeVersion}` : '';
    $('#sb-stack').textContent = STACK_LABELS[p.stack] || '';
    if (s) requestAnimationFrame(() => s.fit.fit());
  }

  function select(id) {
    selectedId = id;
    render();
    const s = sessions.get(id);
    if (s && consoleView === 'term') s.term.focus();
  }

  async function removeProject(p) {
    const s = sessions.get(p.id);
    if (s && s.status === 'running' && !window.confirm(`"${p.name}" is running. Stop it and remove?`)) return;
    await api.projects.remove(p.id);
    closeSession(p.id);
    await refreshProjects();
  }

  // ---------- Context menu ----------
  function openMenu(anchor, items) {
    menuEl.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.textContent = it.label;
      if (it.danger) b.className = 'danger';
      b.onclick = () => {
        closeMenu();
        it.fn();
      };
      menuEl.appendChild(b);
    }
    const r = anchor.getBoundingClientRect();
    menuEl.hidden = false;
    const w = menuEl.offsetWidth;
    menuEl.style.left = Math.min(r.right - w, window.innerWidth - w - 8) + 'px';
    menuEl.style.top = r.bottom + 4 + 'px';
  }
  function closeMenu() {
    menuEl.hidden = true;
  }
  document.addEventListener('mousedown', (e) => {
    if (!menuEl.hidden && !menuEl.contains(e.target)) closeMenu();
  });
  window.addEventListener('blur', closeMenu);

  // ---------- Dialog ----------
  function openDialog(p) {
    editingId = p ? p.id : null;
    $('#dialog-title').textContent = p ? 'Edit project' : 'Add project';
    fPath.value = p ? p.path : '';
    fName.value = p ? p.name : '';
    fCommand.value = p ? p.command : '';
    fAutostart.checked = p ? !!p.autoStart : false;
    fSaveConfig.checked = false;
    fError.textContent = '';
    dlg.showModal();
    if (!p) $('#f-browse').focus();
  }
  $('#f-browse').onclick = async () => {
    const r = await api.projects.pickFolder();
    if (!r) return;
    fPath.value = r.path;
    if (!fName.value) fName.value = r.name;
    if (!fCommand.value) fCommand.value = r.command;
  };
  $('#f-cancel').onclick = () => dlg.close();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    fError.textContent = '';
    const data = { path: fPath.value, name: fName.value, command: fCommand.value, autoStart: fAutostart.checked };
    try {
      if (!data.path) throw new Error('Choose a project folder.');
      let saved;
      if (editingId) saved = await api.projects.update(editingId, data);
      else saved = await api.projects.add(data);
      if (fSaveConfig.checked && data.command) await api.projects.writeConfig(data.path, data.command);
      dlg.close();
      await refreshProjects();
      select(saved.id);
    } catch (err) {
      fError.textContent = cleanError(err);
    }
  });

  // ---------- Settings dialog ----------
  const sdlg = $('#settings-dialog');
  $('#settings-btn').onclick = () => {
    $('#s-start').checked = $('#start-with-windows').checked;
    $('#s-about').textContent = `QuickPo · up to ${maxProjects} projects${nodeVersion ? ' · Node ' + nodeVersion : ''}`;
    sdlg.showModal();
  };
  $('#s-start').addEventListener('change', async (e) => {
    $('#start-with-windows').checked = e.target.checked;
    await api.settings.set({ startWithWindows: e.target.checked });
  });
  $('#start-with-windows').addEventListener('change', async (e) => {
    await api.settings.set({ startWithWindows: e.target.checked });
  });

  // ---------- Sessions ----------
  function createSession(p) {
    const wrap = document.createElement('div');
    wrap.className = 'term-wrap';
    wrap.innerHTML = `<div class="term"></div><pre class="logs"></pre>`;
    termsEl.appendChild(wrap);

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: '"Cascadia Mono", "Cascadia Code", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 5000,
      theme: { background: '#070708', foreground: '#f1f1f3', cursor: '#ff3b1f', selectionBackground: '#2a2a30', black: '#18181b', brightBlack: '#6d6d78' },
      allowProposedApi: true,
    });
    const fit = new FitAddon.FitAddon();
    term.loadAddon(fit);
    term.open(wrap.querySelector('.term'));
    term.onData((d) => api.pty.input(p.id, d));
    term.onResize(({ cols, rows }) => api.pty.resize(p.id, cols, rows));

    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.innerHTML = `<span class="dot"></span><span class="label"></span>`;
    tab.querySelector('.label').textContent = p.name;
    tab.onclick = () => select(p.id);
    tabsEl.appendChild(tab);

    const s = { term, fit, wrap, tab, logs: wrap.querySelector('.logs'), status: 'idle', startedAt: null, partial: '', lineCount: 0, command: '' };
    sessions.set(p.id, s);
    return s;
  }

  function setStatus(id, status, exitCode) {
    const s = sessions.get(id);
    if (!s) return;
    s.status = status;
    s.exitCode = exitCode;
    s.tab.classList.toggle('running', status === 'running');
    s.tab.classList.toggle('exited', status === 'exited');
    render();
  }

  function appendLog(s, data) {
    const text = (s.partial + data).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
    const lines = text.split('\n');
    s.partial = lines.pop();
    const stamp = fmtTime(new Date());
    for (let line of lines) {
      line = line.split('\r').pop().trimEnd();
      if (!line) continue;
      const row = document.createElement('div');
      row.innerHTML = `<span class="t">[${stamp}]</span><span class="l"></span>`;
      row.querySelector('.l').textContent = line;
      s.logs.appendChild(row);
      if (++s.lineCount > 3000) {
        s.logs.firstChild.remove();
        s.lineCount--;
      }
    }
    if (consoleView === 'logs') s.logs.scrollTop = s.logs.scrollHeight;
  }

  async function launch(id) {
    const p = byId(id);
    if (!p) return;
    let s = sessions.get(id);
    if (s && s.status === 'running') {
      await api.pty.stop(id);
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!s) s = createSession(p);
    else {
      s.term.clear();
      s.logs.innerHTML = '';
      s.lineCount = 0;
    }
    selectedId = id;
    s.startedAt = new Date();
    s.command = p.command || '';
    render();
    s.fit.fit();
    s.term.writeln(`\x1b[90m[QuickPo] ${p.path}\x1b[0m`);
    try {
      await api.pty.launch(id, { cols: s.term.cols, rows: s.term.rows });
      setStatus(id, 'running');
    } catch (err) {
      s.term.writeln(`\x1b[31m[QuickPo] ${cleanError(err)}\x1b[0m`);
      appendLog(s, `[QuickPo] ${cleanError(err)}\n`);
      setStatus(id, 'exited', 'failed');
    }
  }

  const stop = (id) => api.pty.stop(id);

  function closeSession(id) {
    const s = sessions.get(id);
    if (!s) return;
    s.term.dispose();
    s.wrap.remove();
    s.tab.remove();
    sessions.delete(id);
    render();
  }


  api.pty.onData(({ id, data }) => {
    const s = sessions.get(id);
    if (!s) return;
    s.term.write(data);
    appendLog(s, data);
  });
  api.pty.onExit(({ id, code }) => {
    const s = sessions.get(id);
    if (!s) return;
    s.term.writeln(`\r\n\x1b[90m[QuickPo] process exited with code ${code}\x1b[0m`);
    appendLog(s, `[QuickPo] process exited with code ${code}\n`);
    setStatus(id, 'exited', code);
  });

  // ---------- Header & console controls ----------
  $('#ph-open').onclick = () => api.projects.openFolder(byId(selectedId).path);
  $('#ph-edit').onclick = () => openDialog(byId(selectedId));
  $('#ph-toggle').onclick = () => (statusOf(selectedId) === 'running' ? stop(selectedId) : launch(selectedId));
  $('#ph-copy').onclick = () => navigator.clipboard.writeText(byId(selectedId).path);
  $('#clear-btn').onclick = () => {
    const s = sessions.get(selectedId);
    if (!s) return;
    s.term.clear();
    s.logs.innerHTML = '';
    s.lineCount = 0;
  };
  for (const b of document.querySelectorAll('.ctab')) {
    b.onclick = () => {
      consoleView = b.dataset.view;
      document.querySelectorAll('.ctab').forEach((x) => x.classList.toggle('active', x === b));
      consoleEl.classList.toggle('show-logs', consoleView === 'logs');
      const s = sessions.get(selectedId);
      if (s) consoleView === 'logs' ? (s.logs.scrollTop = s.logs.scrollHeight) : s.term.focus();
    };
  }
  window.addEventListener('resize', () => sessions.get(selectedId)?.fit.fit());

  // ---------- Boot ----------
  addBtn.onclick = () => openDialog(null);
  $('#tab-add').onclick = () => openDialog(null);

  (async () => {
    maxProjects = await api.projects.max();
    const settings = await api.settings.get();
    $('#start-with-windows').checked = !!settings.startWithWindows;
    api.env.info().then((i) => {
      nodeVersion = i.node;
      renderHeader();
    });
    await refreshProjects();
    if (projects.length && !selectedId) select(projects[0].id);
    for (const p of projects.filter((x) => x.autoStart)) await launch(p.id);
  })();
})();
