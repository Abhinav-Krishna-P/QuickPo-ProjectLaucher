const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { detectCommand, guessCommand } = require('../src/main/detect');

function proj(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quickpo-d-'));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return dir;
}

test('quickpo.json wins over guesses', () => {
  const dir = proj({ 'quickpo.json': '{"command":"make serve"}', 'package.json': '{"scripts":{"dev":"x"}}' });
  assert.equal(detectCommand(dir), 'make serve');
});

test('package.json dev script with pnpm lock', () => {
  const dir = proj({ 'package.json': '{"scripts":{"dev":"x"}}', 'pnpm-lock.yaml': '' });
  assert.equal(guessCommand(dir), 'pnpm run dev');
});

test('npm start when only start script', () => {
  const dir = proj({ 'package.json': '{"scripts":{"start":"x"}}' });
  assert.equal(guessCommand(dir), 'npm start');
});

test('laravel, django, docker, unknown', () => {
  assert.equal(guessCommand(proj({ artisan: '' })), 'php artisan serve');
  assert.equal(guessCommand(proj({ 'manage.py': '' })), 'python manage.py runserver');
  assert.equal(guessCommand(proj({ 'docker-compose.yml': '' })), 'docker compose up');
  assert.equal(guessCommand(proj({})), '');
});

test('stack detection', () => {
  const { detectStack } = require('../src/main/detect');
  assert.equal(detectStack(proj({ 'package.json': '{"dependencies":{"react":"1"}}' })), 'react');
  assert.equal(detectStack(proj({ 'package.json': '{"devDependencies":{"vite":"1"}}' })), 'vite');
  assert.equal(detectStack(proj({ 'package.json': '{}' })), 'node');
  assert.equal(detectStack(proj({ artisan: '' })), 'laravel');
  assert.equal(detectStack(proj({ 'go.mod': '' })), 'go');
  assert.equal(detectStack(proj({})), 'generic');
});
