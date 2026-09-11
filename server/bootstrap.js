import { existsSync } from 'fs';
import { spawnSync } from 'child_process';

if (!existsSync(new URL('../node_modules/express/package.json', import.meta.url))) {
  console.log('Dependencies missing — running npm install...');
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install'], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
await import('./index.js');
