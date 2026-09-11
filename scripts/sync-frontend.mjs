import { existsSync, rmSync, cpSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const cache = join(root, '.battle-tank-frontend');
const repo = 'https://github.com/avrag28-gif/Battle-Tank.git';

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status || 1);
}

if (!existsSync(join(cache, '.git'))) {
  rmSync(cache, { recursive: true, force: true });
  mkdirSync(dirname(cache), { recursive: true });
  console.log('Syncing frontend from Battle-Tank...');
  run('git', ['clone', '--depth', '1', repo, cache], root);
} else {
  console.log('Updating frontend from Battle-Tank...');
  run('git', ['pull', '--ff-only'], cache);
}

// Keep the Battle-Tank frontend intact. Only the server folder is excluded;
// Node-Battle supplies its own JavaScript backend.
for (const name of ['src', 'index.html', 'vite.config.ts', 'tsconfig.json']) {
  const src = join(cache, name);
  const dst = join(root, name);
  if (name === 'src') {
    rmSync(dst, { recursive: true, force: true });
    cpSync(src, dst, { recursive: true, filter: (s) => !s.replaceAll('\\', '/').includes('/src/server') });
  } else {
    cpSync(src, dst);
  }
}

console.log('Battle-Tank frontend synced unchanged; Node-Battle owns the backend.');
