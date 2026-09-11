import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const syncScript = fileURLToPath(new URL('../scripts/sync-frontend.mjs', import.meta.url));

function run(label, command, args) {
  console.log(label);
  const r = spawnSync(command, args, { stdio: 'inherit', windowsHide: false, shell: false });
  if (r.error) {
    console.error(`${label} failed: ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`${label} exited with code ${r.status}`);
    process.exit(r.status || 1);
  }
}

const depsReady =
  existsSync(new URL('../node_modules/express/package.json', import.meta.url)) &&
  existsSync(new URL('../node_modules/vite/bin/vite.js', import.meta.url)) &&
  existsSync(new URL('../node_modules/react/package.json', import.meta.url));

if (!depsReady) {
  // npm.cmd can return EINVAL when spawned directly on Windows.
  // Resolve it through cmd.exe, matching the normal Windows npm invocation.
  run('Dependencies incomplete — running npm install...', process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm install']);
}

run('Syncing original Battle-Tank frontend...', process.execPath, [syncScript]);
run('Building original Battle-Tank frontend...', process.execPath, [viteBin, 'build']);

await import('./index.js');
