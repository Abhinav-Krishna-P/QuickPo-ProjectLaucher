'use strict';
const os = require('os');
const pty = require('node-pty');

/**
 * Manages one PTY per project id and forwards output/exit to a sink.
 * sink.onData(id, data) / sink.onExit(id, code)
 */
class PtyManager {
  constructor(sink) {
    this.sink = sink;
    this.procs = new Map();
  }

  isRunning(id) {
    return this.procs.has(id);
  }

  spawn(id, { cwd, command, cols = 120, rows = 30 }) {
    if (this.procs.has(id)) throw new Error('Already running.');
    const shell = process.env.ComSpec || 'cmd.exe';
    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: { ...process.env, QUICKPO: '1' },
      useConpty: true,
    });
    this.procs.set(id, proc);
    proc.onData((data) => this.sink.onData(id, data));
    proc.onExit(({ exitCode }) => {
      this.procs.delete(id);
      this.sink.onExit(id, exitCode);
    });
    if (command) {
      // Give cmd a moment to print its banner, then run the project command.
      setTimeout(() => {
        if (this.procs.get(id) === proc) proc.write(command + '\r');
      }, 150);
    }
    return proc.pid;
  }

  write(id, data) {
    const proc = this.procs.get(id);
    if (proc) proc.write(data);
  }

  resize(id, cols, rows) {
    const proc = this.procs.get(id);
    if (proc && cols > 0 && rows > 0) {
      try {
        proc.resize(cols, rows);
      } catch {
        /* ignore resize races */
      }
    }
  }

  kill(id) {
    const proc = this.procs.get(id);
    if (!proc) return;
    this.procs.delete(id);
    // Kill the whole tree (cmd.exe + dev server children).
    if (os.platform() === 'win32') {
      try {
        require('child_process').execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
      } catch {
        /* already gone */
      }
    }
    try {
      proc.kill();
    } catch {
      /* already gone */
    }
  }

  killAll() {
    for (const id of [...this.procs.keys()]) this.kill(id);
  }
}

module.exports = { PtyManager };
