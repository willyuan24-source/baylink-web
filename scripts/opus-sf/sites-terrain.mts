// Bakes the ground of the wave-4 sites (lane L) into src/opus-bay/world/sf/landmarks/siteTerrain.ts from the published
// city (public/opus-bay/sf/<current>): per site the numeric base (the lowest walked ground inside its exclusion, 0.5 u
// samples + the polygon's corners, rounded down to 0.01 u) and the local ground heights over its `w4.terrain` box on a
// 3 u grid (1/100 u above the base). Deterministic; re-run after changing a site's exclusion or terrain box.
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/sites-terrain.mts [--site <id>] [--check]
//
// --site regenerates one site and keeps the others; --check only prints the differences (exit 1 when any).
import fs from 'node:fs';
import path from 'node:path';
import { type GroundRaster, groundRaster, rasterHeight } from '../../src/opus-bay/core/sfTerrain';
import type { Vec2 } from '../../src/opus-bay/core/types';
import { landmarkToWorld } from '../../src/opus-bay/world/sf/landmarks/index';
import { SITE_TERRAIN, type SiteTerrainGrid } from '../../src/opus-bay/world/sf/landmarks/siteTerrain';
import { W4_SITES } from '../../src/opus-bay/world/sf/landmarks/w4sites';
import { sfDisk } from '../../tests/opus-bay-sf-disk';

const args = process.argv.slice(2);
const only = args.includes('--site') ? args[args.indexOf('--site') + 1] : null;
const check = args.includes('--check');
const STEP = 2;
const sf = sfDisk();
const rasters = new Map<string, GroundRaster | null>();
async function walked(x: number, z: number): Promise<number> {
  const cx = Math.floor(x / 128), cz = Math.floor(z / 128), k = `${cx}_${cz}`;
  if (!rasters.has(k)) { const c = await sf.chunk(cx, cz); rasters.set(k, c ? groundRaster(c) : null); }
  const r = rasters.get(k);
  if (!r) throw new Error(`no chunk ${k} for (${x.toFixed(1)}, ${z.toFixed(1)})`);
  return rasterHeight(r, x, z);
}
const inPoly = (p: Vec2, poly: Vec2[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

const out: Record<string, SiteTerrainGrid> = { ...SITE_TERRAIN };
let diffs = 0;
for (const s of W4_SITES) {
  if (only && s.id !== only) continue;
  if (!('poly' in s.exclude)) throw new Error(`${s.id}: wave-4 sites use a polygon exclusion`);
  const ex = s.exclude.poly;
  let lo = Infinity;
  const xs = ex.map(p => p.x), zs = ex.map(p => p.z);
  for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.5) for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.5) {
    if (inPoly({ x, z }, ex)) lo = Math.min(lo, await walked(x, z));
  }
  for (const p of ex) lo = Math.min(lo, await walked(p.x, p.z));
  const base = Math.floor(lo * 100) / 100;
  const [x0, z0, x1, z1] = s.w4.terrain;
  const cols = Math.ceil((x1 - x0) / STEP) + 1, rows = Math.ceil((z1 - z0) / STEP) + 1, h: number[] = [];
  // each grid height is the HIGHEST walked ground within ±STEP/2 (0.5 u samples): draped plazas and furniture
  // interpolated between the grid points never sink into a bump (kerb embankments, the corridor flattening)
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let hi = -Infinity;
    for (let dv = -STEP / 2; dv <= STEP / 2 + 1e-9; dv += 0.5) for (let du = -STEP / 2; du <= STEP / 2 + 1e-9; du += 0.5) {
      const w = landmarkToWorld(s, { x: x0 + i * STEP + du, z: z0 + j * STEP + dv });
      hi = Math.max(hi, await walked(w.x, w.z));
    }
    h.push(Math.round((hi - base) * 100));
  }
  const grid: SiteTerrainGrid = { base, x0, z0, step: STEP, cols, rows, h };
  const old = SITE_TERRAIN[s.id];
  const changed = !old || JSON.stringify(old) !== JSON.stringify(grid);
  if (changed) diffs++;
  console.log(`${s.id.padEnd(22)} base ${base.toFixed(2)}  grid ${cols}×${rows}  ground ${(Math.min(...h) / 100).toFixed(2)}…${(Math.max(...h) / 100).toFixed(2)} u${changed ? (old ? `  CHANGED (base was ${old.base})` : '  NEW') : ''}`);
  out[s.id] = grid;
}
if (check) process.exit(diffs ? 1 : 0);
const ids = Object.keys(out).filter(id => W4_SITES.some(s => s.id === id)).sort();
const body = ids.map(id => {
  const g = out[id];
  const rows: string[] = [];
  for (let j = 0; j < g.rows; j++) rows.push(`      ${g.h.slice(j * g.cols, (j + 1) * g.cols).join(', ')},`);
  return `  '${id}': {\n    base: ${g.base}, x0: ${g.x0}, z0: ${g.z0}, step: ${g.step}, cols: ${g.cols}, rows: ${g.rows},\n    h: [\n${rows.join('\n')}\n    ],\n  },`;
}).join('\n');
const file = path.resolve(import.meta.dirname, '../../src/opus-bay/world/sf/landmarks/siteTerrain.ts');
const src = fs.readFileSync(file, 'utf8');
const head = src.slice(0, src.indexOf('export const SITE_TERRAIN'));
fs.writeFileSync(file, `${head}export const SITE_TERRAIN: Readonly<Record<string, SiteTerrainGrid>> = {\n${body}\n};\n`);
console.log(`wrote ${file} (${ids.length} sites)`);
