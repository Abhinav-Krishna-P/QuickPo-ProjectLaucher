'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store, MAX_PROJECTS } = require('./store');
const { detectCommand, CONFIG_FILE } = require('./detect');
const { PtyManager } = require('./pty');

let win = null;
let store = null;
let ptys = null;

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
  ipcMain.handle('projects:list', () => store.list());
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
  ptys = new PtyManager({
    onData: (id, data) => send('pty:data', { id, data }),
    onExit: (id, code) => send('pty:exit', { id, code }),
  });
  registerIpc();
  applyLoginItem();
  createWindow();
});

app.on('window-all-closed', () => {
  ptys?.killAll();
  app.quit();
});

app.on('before-quit', () => ptys?.killAll());
