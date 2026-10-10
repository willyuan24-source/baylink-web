#!/usr/bin/env node
// Codemod: drop the hand-written `srcSet` from the media records that src/data/guide-media.ts registers (WEB-IMAGES, D8).
//
//   node scripts/codemods/registry-srcset.mjs           remove them and print what changed
//   node scripts/codemods/registry-srcset.mjs --check   exit 1 if a registered media record still carries one
//
// Re-runnable and idempotent; after a rebase conflict in one of these JSON files, take the other side and re-run.
// Every registered image's srcset now comes from the image ladder (src/data/image-ladder.ts, `npm run images:variants`),
// and the stale-table fallback rebuilds the old `-small` 480w + original pair from `src` and `width`, so the per-record
// strings only added bytes to every page that loads the image registry (about 2.4 KB gzip). Scope: the JSON files
// guide-media.ts imports. Other registries (Little Bay, Opus Bay landmark photos) keep their own srcsets.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const CHECK = process.argv.includes('--check');
const registry = readFileSync(`${root}src/data/guide-media.ts`, 'utf8');
const files = [...registry.matchAll(/from '\.\/([\w-]+\.json)'/g)].map(match => match[1]).filter(file => file !== 'media-rights-overlay.json');

const strip = value => {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'srcSet').map(([key, item]) => [key, strip(item)]));
  return value;
};

let changedFiles = 0;
let removed = 0;
for (const file of files) {
  const path = `${root}src/data/${file}`;
  const before = readFileSync(path, 'utf8');
  const count = (before.match(/"srcSet"\s*:/g) || []).length;
  if (!count) continue;
  if (CHECK) { console.log(`${file}: ${count} srcSet`); changedFiles += 1; removed += count; continue; }
  const eol = before.includes('\r\n') ? '\r\n' : '\n';
  const lines = before.split(eol);
  const kept = [];
  for (const line of lines) {
    if (/^\s*"srcSet"\s*:\s*"[^"]*",?\s*$/.test(line)) {
      // The last property of an object: the property before it loses its trailing comma.
      if (!line.trimEnd().endsWith(',') && kept.length) kept[kept.length - 1] = kept[kept.length - 1].replace(/,(\s*)$/, '$1');
      continue;
    }
    kept.push(line.replace(/,\s*"srcSet"\s*:\s*"[^"]*"/g, '').replace(/"srcSet"\s*:\s*"[^"]*"\s*,\s*/g, ''));
  }
  const after = kept.join(eol);
  if (JSON.stringify(JSON.parse(after)) !== JSON.stringify(strip(JSON.parse(before)))) throw new Error(`${file}: removing srcSet changed other data; edit it by hand`);
  if (/"srcSet"\s*:/.test(after)) throw new Error(`${file}: a srcSet is left in an unexpected layout`);
  writeFileSync(path, after);
  changedFiles += 1;
  removed += count;
  console.log(`${file}: removed ${count}`);
}
if (CHECK && removed) { console.error(`${removed} registered media records in ${changedFiles} files still carry srcSet; run node scripts/codemods/registry-srcset.mjs`); process.exit(1); }
console.log(CHECK ? 'No registered media record carries srcSet.' : `Removed ${removed} srcSet strings from ${changedFiles} files.`);
