// W9-E · the old-Safari syntax scan of a production build (review 2026-10-01 R§5 #2): Safari / WKWebView before 16.4
// (iOS 15, iOS 16.0–16.3, and WeChat on those iPhones) throws a SyntaxError on a regex look-behind, `(?<=…)` or `(?<!…)`.
// esbuild cannot lower one: for a literal it emits `new RegExp("…")`, which throws when the module is evaluated — the
// 2026-10-01 bundle stopped the whole site at index-CBvX8zQb.js:116 (src/lib/named-event-search.ts, now rewritten). This
// scan is the gate: it reads every dist/assets/*.js (and *.mjs) and fails on any look-behind it finds. It also counts
// class static blocks (`static{`, Safari 16.4+), which vite.config.ts build.target lowers — a warning, not a gate (a
// string could contain the text).
//
// Usage:  node scripts/opus-sf/qa/dist-syntax.mjs [--dist <dir>] [--json <file>]
//   --dist  the build's output folder (default ./dist): `npx vite build --config vite.opus.config.ts --outDir <dir>`
//   --json  also write the result as JSON
// Exit code: 0 = no look-behind in any chunk; 1 = look-behind found (each hit printed with its chunk, offset and the
// text round it); 2 = no chunks found (wrong --dist). W9-Z runs it on the go-live build.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const dist = path.resolve(arg('dist', 'dist'));
const assets = path.join(dist, 'assets');
const files = fs.existsSync(assets) ? fs.readdirSync(assets).filter(f => /\.m?js$/.test(f)).sort() : [];
if (!files.length) { console.error(`dist-syntax: no chunks in ${assets}`); process.exit(2); }

const LOOK_BEHIND = /\(\?<[=!]/g;
const STATIC_BLOCK = /\bstatic\{/g;
const around = (text, at) => text.slice(Math.max(0, at - 60), at + 60).replace(/\s+/g, ' ');
const hits = [], statics = [];
let bytes = 0;
for (const f of files) {
  const text = fs.readFileSync(path.join(assets, f), 'utf8');
  bytes += text.length;
  for (const m of text.matchAll(LOOK_BEHIND)) hits.push({ file: f, at: m.index, text: around(text, m.index) });
  for (const m of text.matchAll(STATIC_BLOCK)) statics.push({ file: f, at: m.index, text: around(text, m.index) });
}
const result = { dist, chunks: files.length, bytes, lookBehind: hits.length, staticBlocks: statics.length, hits, statics };
for (const h of hits) console.log(`LOOK-BEHIND  ${h.file}:${h.at}  …${h.text}…`);
for (const s of statics) console.log(`static block (warning)  ${s.file}:${s.at}  …${s.text}…`);
console.log(`dist-syntax: ${files.length} chunks, ${(bytes / 1e6).toFixed(2)} MB — look-behind ${hits.length}, class static blocks ${statics.length} → ${hits.length ? 'FAIL' : 'PASS'}`);
const out = arg('json', '');
if (out) fs.writeFileSync(out, JSON.stringify(result, null, 1));
process.exit(hits.length ? 1 : 0);
