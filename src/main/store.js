'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_PROJECTS = 5;

const DEFAULTS = { projects: [], settings: { startWithWindows: false } };

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

class Store {
  constructor(file) {
    this.file = file;
    const raw = readJson(file, DEFAULTS);
    this.data = {
      projects: Array.isArray(raw.projects) ? raw.projects.map((p) => ({ ...p })) : [],
      settings: { ...DEFAULTS.settings, ...(raw.settings || {}) },
    };
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  list() {
    return this.data.projects.map((p) => ({ ...p }));
  }

  get(id) {
    return this.data.projects.find((p) => p.id === id) || null;
  }

  add({ name, path: root, command, autoStart = false }) {
    if (this.data.projects.length >= MAX_PROJECTS) {
      throw new Error(`You can add up to ${MAX_PROJECTS} projects.`);
    }
    if (!root || !fs.existsSync(root)) throw new Error('Project folder does not exist.');
    if (this.data.projects.some((p) => p.path.toLowerCase() === root.toLowerCase())) {
      throw new Error('That folder is already added.');
    }
    const project = {
      id: crypto.randomUUID(),
      name: (name || path.basename(root)).trim(),
      path: root,
      command: (command || '').trim(),
      autoStart: !!autoStart,
    };
    this.data.projects.push(project);
    this.save();
    return { ...project };
  }

  update(id, patch) {
    const p = this.get(id);
    if (!p) throw new Error('Project not found.');
    if (patch.name !== undefined) p.name = String(patch.name).trim() || p.name;
    if (patch.command !== undefined) p.command = String(patch.command).trim();
    if (patch.autoStart !== undefined) p.autoStart = !!patch.autoStart;
    if (patch.path !== undefined) {
      if (!fs.existsSync(patch.path)) throw new Error('Project folder does not exist.');
      p.path = patch.path;
    }
    this.save();
    return { ...p };
  }

  remove(id) {
    const before = this.data.projects.length;
    this.data.projects = this.data.projects.filter((p) => p.id !== id);
    if (this.data.projects.length !== before) this.save();
  }

  getSettings() {
    return { ...this.data.settings };
  }

  setSettings(patch) {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
    return this.getSettings();
  }
}

module.exports = { Store, MAX_PROJECTS };
