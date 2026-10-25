'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store, MAX_PROJECTS } = require('./store');
const { detectCommand, detectStack, CONFIG_FILE } = require('./detect');
const { execFile } = require('child_process');
const { PtyManager } = require('./pty');

let win = null;
let store = null;
let ptys = null;

// QUICKPO_SMOKE=1: isolated userData, auto-launch a project that echoes a marker, exit 0 on success.
const SMOKE = process.env.QUICKPO_SMOKE === '1';
if (SMOKE) app.setPath('userData', path.join(app.getPath('temp'), 'quickpo-smoke-' + process.pid));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 820,
    minHeight: 500,
    backgroundColor: '#0b0b0d',
    title: 'QuickPo',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.ico'),
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#121214', symbolColor: '#e6e6ea', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.on('closed', () => {
    win = null;
  });
}

function applyLoginItem() {
  const enabled = !!store.getSettings().startWithWindows;
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: [] });
}

function registerIpc() {
  ipcMain.handle('projects:list', () => store.list().map((p) => ({ ...p, stack: detectStack(p.path) })));
  ipcMain.handle('env:info', () =>
    new Promise((resolve) => {
      execFile('node', ['-v'], { windowsHide: true }, (err, out) => resolve({ node: err ? '' : String(out).trim() }));
    }),
  );
  ipcMain.handle('projects:max', () => MAX_PROJECTS);
  ipcMain.handle('projects:add', (_e, data) => store.add(data));
  ipcMain.handle('projects:update', (_e, id, patch) => store.update(id, patch));
  ipcMain.handle('projects:remove', (_e, id) => {
    ptys.kill(id);
    store.remove(id);
  });
  ipcMain.handle('projects:pickFolder', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const root = r.filePaths[0];
    return { path: root, name: path.basename(root), command: detectCommand(root) };
  });
  ipcMain.handle('projects:detect', (_e, root) => detectCommand(root));
  ipcMain.handle('projects:writeConfig', (_e, root, command) => {
    fs.writeFileSync(path.join(root, CONFIG_FILE), JSON.stringify({ command }, null, 2) + '\n');
    return true;
  });
  ipcMain.handle('projects:openFolder', (_e, root) => shell.openPath(root));

  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('settings:set', (_e, patch) => {
    const s = store.setSettings(patch);
    applyLoginItem();
    return s;
  });

  ipcMain.handle('pty:launch', (_e, id, size) => {
    const p = store.get(id);
    if (!p) throw new Error('Project not found.');
    if (!fs.existsSync(p.path)) throw new Error(`Folder not found: ${p.path}`);
    const command = p.command || detectCommand(p.path);
    return ptys.spawn(id, { cwd: p.path, command, cols: size?.cols, rows: size?.rows });
  });
  ipcMain.handle('pty:stop', (_e, id) => ptys.kill(id));
  ipcMain.handle('pty:running', () => store.list().filter((p) => ptys.isRunning(p.id)).map((p) => p.id));
  ipcMain.on('pty:input', (_e, id, data) => ptys.write(id, data));
  ipcMain.on('pty:resize', (_e, id, cols, rows) => ptys.resize(id, cols, rows));
}

app.whenReady().then(() => {
  store = new Store(path.join(app.getPath('userData'), 'projects.json'));
  let smokeOut = '';
  ptys = new PtyManager({
    onData: (id, data) => {
      send('pty:data', { id, data });
      if (SMOKE) smokeOut += data;
    },
    onExit: (id, code) => {
      send('pty:exit', { id, code });
      if (SMOKE) {
        const ok = smokeOut.includes('SMOKE_OK');
        console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL: marker missing', 'exit', code);
        setTimeout(async () => {
          // QUICKPO_SHOT=<file.png>: save a screenshot of the window for visual checks.
          if (process.env.QUICKPO_SHOT && win) {
            const img = await win.webContents.capturePage();
            fs.writeFileSync(process.env.QUICKPO_SHOT, img.toPNG());
          }
          app.exit(ok ? 0 : 2);
        }, 600);
      }
    },
  });
  registerIpc();
  if (!SMOKE) applyLoginItem();
  if (SMOKE) {
    store.add({ path: process.cwd(), name: 'smoke', command: 'echo SMOKE_OK && exit', autoStart: true });
    // QUICKPO_SMOKE_EXTRA=path;path – extra idle projects, handy for screenshots.
    for (const extra of (process.env.QUICKPO_SMOKE_EXTRA || '').split(';').filter((x) => x && fs.existsSync(x))) {
      try { store.add({ path: extra, command: detectCommand(extra) }); } catch { /* duplicate or full */ }
    }
  }
  createWindow();
  // QUICKPO_RECORD=<dir>: resize + zoom the window, run QUICKPO_DEBUG_SCRIPT in the renderer (async, drives the UI),
  // capture PNG frames at QUICKPO_RECORD_FPS for QUICKPO_RECORD_SECS, then exit. Used for the product video.
  if (!SMOKE && process.env.QUICKPO_RECORD) {
    const dir = process.env.QUICKPO_RECORD;
    const fps = Number(process.env.QUICKPO_RECORD_FPS || 25);
    const secs = Number(process.env.QUICKPO_RECORD_SECS || 8);
    const zoom = Number(process.env.QUICKPO_RECORD_ZOOM || 1.4);
    fs.mkdirSync(dir, { recursive: true });
    win.setSize(Number(process.env.QUICKPO_RECORD_W || 1600), Number(process.env.QUICKPO_RECORD_H || 1000));
    win.center();
    win.webContents.once('did-finish-load', () => {
      win.webContents.setZoomFactor(zoom);
      setTimeout(async () => {
        if (process.env.QUICKPO_DEBUG_SCRIPT) {
          win.webContents.executeJavaScript(fs.readFileSync(process.env.QUICKPO_DEBUG_SCRIPT, 'utf8')).catch((e) => console.error('script failed', e.message));
        }
        const total = Math.round(fps * secs);
        const t0 = Date.now();
        for (let i = 0; i < total; i++) {
          const due = t0 + (i * 1000) / fps;
          const wait = due - Date.now();
          if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          let img = null;
          for (let attempt = 0; attempt < 5 && !img; attempt++) {
            try {
              img = await win.webContents.capturePage();
            } catch (e) {
              await new Promise((r) => setTimeout(r, 30)); // transient viz errors: retry
            }
          }
          if (img) fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, '0')}.png`), img.toPNG());
          else if (i > 0) fs.copyFileSync(path.join(dir, `f${String(i - 1).padStart(4, '0')}.png`), path.join(dir, `f${String(i).padStart(4, '0')}.png`));
        }
        console.log('RECORDED', total, 'frames at', fps, 'fps, size', JSON.stringify(win.getContentSize()));
        ptys.killAll();
        app.exit(0);
      }, 1200);
    });
  }
  // QUICKPO_DEBUG=1: echo renderer console to stdout; with QUICKPO_SHOT, screenshot after 4s and exit.
  if (!SMOKE && process.env.QUICKPO_DEBUG === '1') {
    win.webContents.on('console-message', (e) => console.log(`RENDERER[${e.level}] ${e.message} (${e.sourceId}:${e.lineNumber})`));
    if (process.env.QUICKPO_SHOT) {
      setTimeout(async () => {
        // QUICKPO_DEBUG_SCRIPT=<file.js>: run in the renderer first (async), result logged.
        if (process.env.QUICKPO_DEBUG_SCRIPT) {
          const r = await win.webContents.executeJavaScript(fs.readFileSync(process.env.QUICKPO_DEBUG_SCRIPT, 'utf8')).catch((e) => 'script failed: ' + e.message);
          console.log('SCRIPT', JSON.stringify(r));
        }
        const diag = await win.webContents
          .executeJavaScript(`JSON.stringify({
            projects: document.querySelectorAll('.project').length,
            tabs: document.querySelectorAll('.tab').length,
            selected: document.getElementById('ph-name')?.textContent || null,
            readyState: document.readyState,
          })`)
          .catch((e) => 'diag failed: ' + e.message);
        console.log('DIAG', diag);
        fs.writeFileSync(process.env.QUICKPO_SHOT, (await win.webContents.capturePage()).toPNG());
        ptys.killAll();
        app.exit(0);
      }, 4000);
    }
  }
  if (SMOKE) {
    win.webContents.on('console-message', (e) => {
      if (e.level === 'error') {
        console.error('RENDERER ERROR:', e.message);
        app.exit(3);
      }
    });
    win.webContents.on('did-fail-load', (_e, code, desc) => {
      console.error('LOAD FAIL', code, desc);
      app.exit(4);
    });
    setTimeout(() => {
      console.error('SMOKE TIMEOUT');
      app.exit(5);
    }, 20000);
  }
});

app.on('window-all-closed', () => {
  ptys?.killAll();
  app.quit();
});

app.on('before-quit', () => ptys?.killAll());
