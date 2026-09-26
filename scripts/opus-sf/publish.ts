// Publish a built candidate to public/opus-bay/sf/<version>/ and point current.json at it.
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/publish.ts <candidate dir> <version>
//
// Never overwrites a published version (the GTA_SZ rebuild lesson): build a new candidate and publish it as v2, v3 …
import fs from 'node:fs';
import path from 'node:path';

const [src, version] = process.argv.slice(2);
if (!src || !/^v\d+$/.test(version ?? '')) throw new Error('usage: publish.ts <candidate dir> <vN>');
const REPO = path.resolve(import.meta.dirname, '../..');
const root = path.join(REPO, 'public/opus-bay/sf');
const dest = path.join(root, version);
if (fs.existsSync(dest)) throw new Error(`${dest} exists — published versions are immutable; publish as a new version`);
const manifest = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8')) as { version: string; chunks: { k: string }[] };
const report = JSON.parse(fs.readFileSync(path.join(src, 'report.json'), 'utf8')) as { budgetsPass: boolean };
if (manifest.version !== version) throw new Error(`candidate was built as ${manifest.version}, not ${version}`);
if (!report.budgetsPass) throw new Error('candidate failed its budgets');
fs.mkdirSync(path.join(dest, 'c'), { recursive: true });
for (const f of ['manifest.json', 'far.obc', 'graph.obc', 'transit.json', 'places.json', 'report.json', 'ATTRIBUTION.md']) fs.copyFileSync(path.join(src, f), path.join(dest, f));
for (const c of manifest.chunks) fs.copyFileSync(path.join(src, 'c', `${c.k}.obc`), path.join(dest, 'c', `${c.k}.obc`));
fs.writeFileSync(path.join(root, 'current.json'), `${JSON.stringify({ version })}\n`);
console.log(`published ${manifest.chunks.length} chunks + far/graph/transit/places → ${dest}; current.json → ${version}`);
