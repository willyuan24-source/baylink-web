// Wave 4 · lane T (W4-T3): rebuild the transit data with the three wave-4 lines, without touching the chunks.
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/transit-sidecar.ts [--out <dir>] [--write-w4] [--publish]
//
// Same inputs as the build (opus-qa/sf-data: raw OSM railways + highways, the DEM → terrain lattice, the hero DISTRICT):
//   - the N Judah and M Ocean View from their OSM route relations (lib/metro.ts, W4-T1),
//   - the sightseeing loop baked on the car-legal street graph (lib/busLoop.ts, W4-T2),
//   - the published wave-2 lines (powell-hyde, powell-mason, california, f-line) copied byte for byte.
// Every line passes `transitLineProblems` and the frozen sf-data constraints (checkW4Lines) or nothing is written.
// Deterministic: the same inputs give the same bytes (no timestamps in the data).
//
// Outputs (always): <out>/transit.json (the full file: wave-2 + wave-4 lines), <out>/transit-w4.json (the three new
// lines only), <out>/report.txt. Default <out> = C:/Users/willy/opus-qa/w4/w4-t/sidecar.
//   --write-w4  also writes public/opus-bay/sf/v1/transit-w4.json (a NEW file the wave-4 modules and tests read during
//               the early phase; nothing at runtime imports it yet)
//   --publish   also overwrites public/opus-bay/sf/v1/transit.json (integration phase only: the manifest names the file
//               without a hash, the chunks are untouched)
import fs from 'node:fs';
import path from 'node:path';
import { type TransitFile, type TransitLine, transitLineProblems } from '../../src/opus-bay/world/sf/format';
import { W4_LINES } from '../../src/opus-bay/data/sf/stationNames';
import { bakeLoop } from './lib/busLoop';
import { loadDem } from './lib/io';
import { buildMetroLines } from './lib/metro';
import { buildTerrain } from './lib/terrain';

const REPO = path.resolve(import.meta.dirname, '../..');
const PUBLISHED = path.join(REPO, 'public/opus-bay/sf/v1/transit.json');
const W4_FILE = path.join(REPO, 'public/opus-bay/sf/v1/transit-w4.json');
const arg = (name: string, def: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def; };
const flag = (name: string) => process.argv.includes(`--${name}`);

/** The wave-2 line ids (published before wave 4) and the frozen sf-data expectations for the wave-4 ids. */
export const WAVE2_IDS = ['powell-hyde', 'powell-mason', 'california', 'f-line'] as const;
export const W4_EXPECT: Record<string, { length: number; kind: TransitLine['kind']; loop: boolean }> = {
  'sf-loop': { length: 6522, kind: 'bus', loop: true },
  'n-judah': { length: 1580, kind: 'light-rail', loop: false },
  'm-ocean-view': { length: 2028, kind: 'light-rail', loop: false },
};

/** The frozen sf-data test's rules for the wave-4 lines (tests/opus-bay-sf-data.test.ts), as a list of problems. */
export function checkW4Lines(lines: TransitLine[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    out.push(...transitLineProblems(l));
    const w = W4_EXPECT[l.id];
    if (!w) { out.push(`${l.id}: not a wave-4 line`); continue; }
    if (l.kind !== w.kind) out.push(`${l.id}: kind ${l.kind}`);
    if ((l.loop === true) !== w.loop) out.push(`${l.id}: loop ${l.loop}`);
    if (!(Math.abs(l.length - w.length) < w.length * 0.2)) out.push(`${l.id}: length ${l.length} outside ${w.length} ± 20 %`);
    if (!l.short) out.push(`${l.id}: no short name`);
    if (l.stops.length < 10) out.push(`${l.id}: ${l.stops.length} stops`);
    for (let i = 1; i < l.path.length; i += 3) if (!(l.path[i] >= -30 && l.path[i] < 60)) { out.push(`${l.id}: y ${l.path[i]}`); break; }
    if (l.kind === 'light-rail') {
      if (!l.doubleEnded) out.push(`${l.id}: not double-ended`);
      if (!(l.tunnels?.length && l.tunnels[0].fromAt <= 1)) out.push(`${l.id}: does not start underground`);
      if (!/openstreetmap\.org\/relation\//.test(l.sourceUrl)) out.push(`${l.id}: source ${l.sourceUrl}`);
    } else {
      if (l.tunnels?.length) out.push(`${l.id}: the loop has tunnels`);
      if (!/^https:\/\//.test(l.sourceUrl)) out.push(`${l.id}: source ${l.sourceUrl}`);
    }
  }
  return out;
}

function main() {
  const t0 = Date.now();
  const OUT = path.resolve(arg('out', 'C:/Users/willy/opus-qa/w4/w4-t/sidecar'));
  const lines: string[] = [];
  const log = (s: string) => { const l = `[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`; console.log(l); lines.push(l); };
  const published = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8')) as TransitFile;
  const wave2 = published.lines.filter(l => (WAVE2_IDS as readonly string[]).includes(l.id));
  if (wave2.length !== WAVE2_IDS.length) throw new Error(`published transit.json lacks a wave-2 line (${wave2.map(l => l.id)})`);
  const terrain = buildTerrain(loadDem(), log);
  const metro = buildMetroLines(terrain, log);
  const loop = bakeLoop(terrain, log);
  // the loop carries its speed spans (an additive field the runtime reads; lead request: `speeds?` on TransitLine)
  const loopLine = { ...loop.line, speeds: loop.speeds } as TransitLine & { speeds: [number, number, number][] };
  const w4 = [loopLine, ...metro.lines].sort((a, b) => Object.keys(W4_LINES).indexOf(a.id) - Object.keys(W4_LINES).indexOf(b.id));
  const problems = checkW4Lines(w4);
  for (const r of [...metro.report, ...loop.report]) log(r);
  if (problems.length) { for (const p of problems) console.error(`PROBLEM ${p}`); throw new Error(`${problems.length} problems: nothing written`); }
  const source = `${published.source}; wave 4: the sightseeing loop designed on the car-legal OSM street graph, Muni Metro N / M from OSM route relations 3435877 / 3433314 (underground heights interpolated between the portals)`;
  const full: TransitFile = { version: published.version, source, lines: [...wave2, ...w4] };
  const onlyW4: TransitFile = { version: published.version, source, lines: w4 };
  fs.mkdirSync(OUT, { recursive: true });
  const fullJson = JSON.stringify(full), w4Json = JSON.stringify(onlyW4);
  // the wave-2 lines must come out byte-identical (copied, never rebuilt)
  for (const l of wave2) if (JSON.stringify(l) !== JSON.stringify(published.lines.find(p => p.id === l.id))) throw new Error(`${l.id} changed`);
  fs.writeFileSync(path.join(OUT, 'transit.json'), fullJson);
  fs.writeFileSync(path.join(OUT, 'transit-w4.json'), w4Json);
  for (const l of w4) log(`${l.id}: ${l.kind}, ${l.length} u, ${l.stops.length} stops, ${l.path.length / 3} vertices, tunnels ${JSON.stringify((l.tunnels ?? []).map(u => [u.fromAt, u.toAt]))}`);
  log(`transit.json ${(fullJson.length / 1024).toFixed(1)} KB (published ${(fs.statSync(PUBLISHED).size / 1024).toFixed(1)} KB); transit-w4.json ${(w4Json.length / 1024).toFixed(1)} KB → ${OUT}`);
  if (flag('write-w4')) { fs.writeFileSync(W4_FILE, w4Json); log(`wrote ${W4_FILE}`); }
  if (flag('publish')) { fs.writeFileSync(PUBLISHED, fullJson); log(`published ${PUBLISHED}`); }
  fs.writeFileSync(path.join(OUT, 'report.txt'), `${lines.join('\n')}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
