'use strict';
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = 'quickpo.json';

function exists(root, name) {
  return fs.existsSync(path.join(root, name));
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Returns the command from quickpo.json in the project root, or null. */
function readConfig(root) {
  const cfg = readJson(path.join(root, CONFIG_FILE));
  if (cfg && typeof cfg.command === 'string' && cfg.command.trim()) return cfg.command.trim();
  return null;
}

/** Best-effort guess of a start command from well-known project markers. */
function guessCommand(root) {
  if (exists(root, 'docker-compose.yml') || exists(root, 'docker-compose.yaml') || exists(root, 'compose.yaml')) {
    return 'docker compose up';
  }
  if (exists(root, 'package.json')) {
    const pkg = readJson(path.join(root, 'package.json')) || {};
    const scripts = pkg.scripts || {};
    const runner = exists(root, 'pnpm-lock.yaml') ? 'pnpm' : exists(root, 'yarn.lock') ? 'yarn' : 'npm';
    for (const s of ['dev', 'start', 'serve']) {
      if (scripts[s]) return s === 'start' && runner === 'npm' ? 'npm start' : runner + ' run ' + s;
    }
    return runner + ' start';
  }
  if (exists(root, 'artisan')) return 'php artisan serve';
  if (exists(root, 'manage.py')) return 'python manage.py runserver';
  if (exists(root, 'pom.xml')) return 'mvn spring-boot:run';
  if (exists(root, 'build.gradle') || exists(root, 'build.gradle.kts')) return 'gradlew bootRun';
  if (exists(root, 'go.mod')) return 'go run .';
  if (exists(root, 'Cargo.toml')) return 'cargo run';
  if (exists(root, 'Gemfile')) return 'bundle exec rails server';
  if (exists(root, 'app.py')) return 'python app.py';
  if (exists(root, 'main.py')) return 'python main.py';
  return '';
}

/** Config file wins; otherwise guess. */
function detectCommand(root) {
  return readConfig(root) || guessCommand(root);
}

module.exports = { detectCommand, readConfig, guessCommand, CONFIG_FILE };
