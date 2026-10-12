'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quickpo', {
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    max: () => ipcRenderer.invoke('projects:max'),
    add: (data) => ipcRenderer.invoke('projects:add', data),
    update: (id, patch) => ipcRenderer.invoke('projects:update', id, patch),
    remove: (id) => ipcRenderer.invoke('projects:remove', id),
    pickFolder: () => ipcRenderer.invoke('projects:pickFolder'),
    detect: (root) => ipcRenderer.invoke('projects:detect', root),
    writeConfig: (root, command) => ipcRenderer.invoke('projects:writeConfig', root, command),
    openFolder: (root) => ipcRenderer.invoke('projects:openFolder', root),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
  },
  pty: {
    launch: (id, size) => ipcRenderer.invoke('pty:launch', id, size),
    stop: (id) => ipcRenderer.invoke('pty:stop', id),
    running: () => ipcRenderer.invoke('pty:running'),
    input: (id, data) => ipcRenderer.send('pty:input', id, data),
    resize: (id, cols, rows) => ipcRenderer.send('pty:resize', id, cols, rows),
    onData: (cb) => ipcRenderer.on('pty:data', (_e, m) => cb(m)),
    onExit: (cb) => ipcRenderer.on('pty:exit', (_e, m) => cb(m)),
  },
});
