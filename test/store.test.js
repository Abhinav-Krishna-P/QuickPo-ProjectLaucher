const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store, MAX_PROJECTS } = require('../src/main/store');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'quickpo-'));
}

test('add, list, update, remove round-trips through disk', () => {
  const dir = tmp();
  const file = path.join(dir, 'projects.json');
  const s = new Store(file);
  const p = s.add({ path: dir, command: 'npm run dev' });
  assert.equal(p.name, path.basename(dir));
  assert.equal(new Store(file).list().length, 1);
  s.update(p.id, { name: 'Renamed', autoStart: true });
  assert.equal(new Store(file).get(p.id).name, 'Renamed');
  assert.equal(new Store(file).get(p.id).autoStart, true);
  s.remove(p.id);
  assert.equal(new Store(file).list().length, 0);
});

test('rejects more than MAX_PROJECTS and duplicate paths', () => {
  const dir = tmp();
  const s = new Store(path.join(dir, 'p.json'));
  for (let i = 0; i < MAX_PROJECTS; i++) {
    const sub = path.join(dir, 'p' + i);
    fs.mkdirSync(sub);
    s.add({ path: sub });
  }
  assert.throws(() => s.add({ path: dir }), /up to 5/);
  s.remove(s.list()[0].id);
  assert.throws(() => s.add({ path: path.join(dir, 'p1') }), /already/);
});

test('rejects missing folder and keeps settings', () => {
  const dir = tmp();
  const s = new Store(path.join(dir, 'p.json'));
  assert.throws(() => s.add({ path: path.join(dir, 'nope') }), /does not exist/);
  s.setSettings({ startWithWindows: true });
  assert.equal(new Store(s.file).getSettings().startWithWindows, true);
});
