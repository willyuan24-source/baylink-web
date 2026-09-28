// Bakes the ground of the signature corners (lane L, W5-L4 / W5-L5) into src/opus-bay/world/sf/landmarks/cornerGround.ts
// from the published city (public/opus-bay/sf/<current>): per corner (landmarks/corners.ts CORNERS) the WORLD height of
// the walked ground on a 1 u grid over its `box`, in the LOCAL frame of the site it dresses (1/100 u), each point the
// highest walked ground within ±0.25 u (a stall's feet never sink into a kerb). Deterministic; re-run after changing a
// corner's box.
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/corners-ground.mts [--check]
//
// --check only prints the differences (exit 1 when any).
import fs from 'node:fs';
import path from 'node:path';
import { type GroundRaster, groundRaster, rasterHeight } from '../../src/opus-bay/core/sfTerrain';
import { cornerToWorld } from '../../src/opus-bay/world/sf/landmarks/cornerKit';
import { CORNER_GROUND, type CornerGroundGrid } from '../../src/opus-bay/world/sf/landmarks/cornerGround';
import { CORNERS } from '../../src/opus-bay/world/sf/landmarks/corners';
import { sfDisk } from '../../tests/opus-bay-sf-disk';

const check = process.argv.includes('--check');
const STEP = 1, POOL = 0.25;
const sf = sfDisk();
const rasters = new Map<string, GroundRaster | null>();
async function walked(x: number, z: number): Promise<number> {
  const cx = Math.floor(x / 128), cz = Math.floor(z / 128), k = `${cx}_${cz}`;
  if (!rasters.has(k)) { const c = await sf.chunk(cx, cz); rasters.set(k, c ? groundRaster(c) : null); }
  const r = rasters.get(k);
  if (!r) throw new Error(`no chunk ${k} for (${x.toFixed(1)}, ${z.toFixed(1)})`);
  return rasterHeight(r, x, z);
}

/** One corner's grid. */
async function bakeCorner(id: string): Promise<CornerGroundGrid> {
  const def = CORNERS.find(c => c.id === id)!;
  const [x0, z0, x1, z1] = def.box;
  const cols = Math.ceil((x1 - x0) / STEP) + 1, rows = Math.ceil((z1 - z0) / STEP) + 1, h: number[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let hi = -Infinity;
    for (let dv = -POOL; dv <= POOL + 1e-9; dv += 0.25) for (let du = -POOL; du <= POOL + 1e-9; du += 0.25) {
      const w = cornerToWorld(def, { x: x0 + i * STEP + du, z: z0 + j * STEP + dv });
      hi = Math.max(hi, await walked(w.x, w.z));
    }
    h.push(Math.round(hi * 100));
  }
  return { x0, z0, step: STEP, cols, rows, h };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('corners-ground.mts')) {
  const out: Record<string, CornerGroundGrid> = {};
  let diffs = 0;
  // (a corner drawn on its site's own ground, a shopping block's boards, needs no grid)
  for (const c of CORNERS.filter(q => !q.ground)) {
    const grid = await bakeCorner(c.id);
    const old = CORNER_GROUND[c.id];
    const changed = !old || JSON.stringify(old) !== JSON.stringify(grid);
    if (changed) diffs++;
    console.log(`${c.id.padEnd(14)} grid ${grid.cols}×${grid.rows}  ground ${(Math.min(...grid.h) / 100).toFixed(2)}…${(Math.max(...grid.h) / 100).toFixed(2)} u${changed ? (old ? '  CHANGED' : '  NEW') : ''}`);
    out[c.id] = grid;
  }
  if (check) process.exit(diffs ? 1 : 0);
  const body = Object.keys(out).sort().map(id => {
    const g = out[id];
    const rows: string[] = [];
    for (let j = 0; j < g.rows; j++) rows.push(`      ${g.h.slice(j * g.cols, (j + 1) * g.cols).join(', ')},`);
    return `  '${id}': {\n    x0: ${g.x0}, z0: ${g.z0}, step: ${g.step}, cols: ${g.cols}, rows: ${g.rows},\n    h: [\n${rows.join('\n')}\n    ],\n  },`;
  }).join('\n');
  const file = path.resolve(import.meta.dirname, '../../src/opus-bay/world/sf/landmarks/cornerGround.ts');
  const src = fs.readFileSync(file, 'utf8');
  const head = src.slice(0, src.indexOf('export const CORNER_GROUND'));
  fs.writeFileSync(file, `${head}export const CORNER_GROUND: Readonly<Record<string, CornerGroundGrid>> = {\n${body}\n};\n`);
  console.log(`wrote ${file} (${Object.keys(out).length} corners)`);
}
