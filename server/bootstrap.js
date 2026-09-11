import { existsSync } from 'fs';
import { spawnSync } from 'child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (!existsSync(new URL('../node_modules/express/package.json', import.meta.url))) {
  console.log('Dependencies missing — running npm install...');
  const r = spawnSync(npm, ['install'], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}

console.log('Building the original Battle-Tank frontend...');
const build = spawnSync(npm, ['run', 'build'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);

await import('./index.js');
