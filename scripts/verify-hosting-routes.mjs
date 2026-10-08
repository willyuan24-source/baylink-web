import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// vercel.json is generated from the content catalogs (scripts/sync-public-routes.ts).
// `pretest` and `prebuild` rewrite it, so a test run passes even when the committed
// copy is stale, and Vercel serves the committed routes: a new event, offer or guide
// id then 404s on direct load. Regenerate it and require no difference from git
// (from the checked-out file when there is no git checkout, as on Vercel).
const before = readFileSync('vercel.json', 'utf8');
const sync = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--tsconfig', 'tsconfig.app.json', 'scripts/sync-public-routes.ts'], { stdio: 'inherit' });
if (sync.status !== 0) throw new Error('Unable to regenerate vercel.json hosting routes');
const diff = spawnSync('git', ['diff', '--exit-code', '--stat', '--', 'vercel.json'], { encoding: 'utf8' });
const fix = 'Run `npm run sync:public-routes` and commit vercel.json (generated; never edit its routes by hand).';
if (!diff.error && diff.status === 1) {
  console.error(`${diff.stdout}vercel.json differs from its committed copy after regenerating the hosting routes. ${fix}`);
  process.exitCode = 1;
} else if (!diff.error && diff.status === 0) {
  console.log('Hosting routes in vercel.json match the content catalogs (git diff --exit-code vercel.json).');
} else {
  const normalize = text => text.replace(/\r\n/g, '\n');
  if (normalize(readFileSync('vercel.json', 'utf8')) !== normalize(before)) {
    console.error(`vercel.json changed when its hosting routes were regenerated. ${fix}`);
    process.exitCode = 1;
  } else console.log('Hosting routes in vercel.json match the content catalogs (no git checkout; compared with the checked-out file).');
}
