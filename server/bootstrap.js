import { existsSync } from 'fs';
import { spawnSync } from 'child_process';

const viteBin = new URL('../node_modules/vite/bin/vite.js', import.meta.url);

function run(label, command, args) {
  console.log(label);
  const r = spawnSync(command, args, { stdio: 'inherit', windowsHide: false });
  if (r.error) {
    console.error(`${label} failed: ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`${label} exited with code ${r.status}`);
    process.exit(r.status || 1);
  }
}

if (!existsSync(new URL('../node_modules/express/package.json', import.meta.url))) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  run('Dependencies missing — running npm install...', npm, ['install']);
}

// Run the sync/build programs directly. This avoids the Windows npm.cmd
// child-process issue that was causing `npm run live` to return immediately.
run('Syncing original Battle-Tank frontend...', process.execPath, [new URL('../scripts/sync-frontend.mjs', import.meta.url).pathname]);
run('Building original Battle-Tank frontend...', process.execPath, [viteBin.pathname, 'build']);

await import('./index.js');
