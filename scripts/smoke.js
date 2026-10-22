// Headless end-to-end check: starts QuickPo in smoke mode, which launches a test project
// and exits 0 when its output arrives. Usage: npm run smoke
const { spawnSync } = require('child_process');

const res = spawnSync('npx', ['electron', '.'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, QUICKPO_SMOKE: '1' },
});
process.exit(res.status ?? 1);
