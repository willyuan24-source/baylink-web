// The setting ground of a San Francisco landmark (lane D2, D2-09), measured on the published city: landmark-settings.ts
// writes src/opus-bay/world/sf/landmarks/settingData.ts from it, and the landmark-context test re-measures a few rows to
// keep that table honest. See landmark-settings.ts for what is measured.
import { DISTRICT } from '../../../src/opus-bay/data/district';
import { type ChunkContext, buildL1, chunkContext } from '../../../src/opus-bay/world/sf/build';
import { ROAD_CLASSES, ROAD_FLAG } from '../../../src/opus-bay/world/sf/format';
import { clipOutside, clipPolyline } from '../../../src/opus-bay/world/sf/mesh';
import { inPoly } from '../../../src/opus-bay/world/sf/raster';
import { type SfLandmark, landmarkToWorld, worldToLandmark } from '../../../src/opus-bay/world/sf/landmarks/index';
import { CitySites } from '../../../src/opus-bay/world/sf/sites';
import type { SettingData } from '../../../src/opus-bay/world/sf/landmarks/settingData';
import { sfDisk } from '../../../tests/opus-bay-sf-disk';

const STEP = 2;
const POOL = 0.5;
/** the restored street follows its own centreline height at the exclusion edge and the sunk ground this far inside */
const RAMP = 2;
/** the Bay's surface (the district water datum) where the city has no chunk */
const WATER = -0.6;
/** classes the city draws on the ground (world/sf/build.ts streetsL0) */
const DRAWN = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'pedestrian', 'footway', 'path', 'cycleway', 'steps', 'track', 'tram', 'rail']);
/**
 * The local box of a setting's ground grid when the exclusion's bounds are not the place: the bridge's exclusion is
 * 430 u of deck over the strait, its setting the south approach on the Presidio bluff and the Fort Point pylons.
 */
const BOX: Record<string, [number, number, number, number]> = {
  'golden-gate-bridge': [-250, -12, -224, 12],
  // the lantern strings over Grant Ave north of the gate
  'dragon-gate': [-6, -12, 6, 3],
};

/** the landmarks whose modules read their setting (settingGround / streetStrips): the table keeps only their rows */
export const SETTING_IDS = [
  'golden-gate-bridge', 'city-hall', 'de-young-tower', 'palace-of-fine-arts', 'twin-peaks', 'painted-ladies', 'dragon-gate',
  'conservatory-of-flowers', 'dutch-windmill', 'mission-dolores', 'fort-point', 'castro-theatre', 'oracle-park', 'peace-pagoda', 'chase-center',
];

const sf = sfDisk();
const EX = new CitySites().excludes();
const init = { palettes: sf.manifest.palettes, slab: DISTRICT.slab, excludes: EX };
const ctxs = new Map<string, ChunkContext | null>();
async function ctxAt(cx: number, cz: number): Promise<ChunkContext | null> {
  const k = `${cx}_${cz}`;
  if (!ctxs.has(k)) { const c = await sf.chunk(cx, cz); ctxs.set(k, c ? chunkContext(c, init) : null); }
  return ctxs.get(k)!;
}
/** the drawn city ground at (x, z); no chunk = open water */
export async function drawn(x: number, z: number): Promise<number> {
  const c = await ctxAt(Math.floor(x / 128), Math.floor(z / 128));
  return c ? c.height(x, z) : WATER;
}
const r2 = (v: number) => Math.round(v * 100) / 100 + 0;

function exclusionPoly(l: SfLandmark) {
  const e = EX.find(q => q.id === l.id)!;
  return e.poly ?? Array.from({ length: 32 }, (_, k) => ({ x: l.x + Math.sin((k / 32) * Math.PI * 2) * e.r!, z: l.z + Math.cos((k / 32) * Math.PI * 2) * e.r! }));
}

/** distance from (x, z) to the polygon's outline */
function edgeDist(x: number, z: number, poly: { x: number; z: number }[]) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)) : 0;
    d = Math.min(d, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return d;
}

export async function measureSetting(l: SfLandmark): Promise<SettingData> {
  const e = EX.find(q => q.id === l.id)!, poly = exclusionPoly(l), sink = e.sink ?? 0;
  // the base: numeric, or the chunk's buildL1 base (the lowest drawn ground in the exclusion's circle) + baseLift
  let base: number;
  if (typeof l.base === 'number') base = l.base;
  else {
    const c = await ctxAt(Math.floor(l.x / 128), Math.floor(l.z / 128));
    const b = c && buildL1(c).bases.find(q => q.id === l.id);
    if (!b) throw new Error(`${l.id}: no base from its chunk`);
    base = b.y + (l.baseLift ?? 0);
  }
  // local box: the exclusion's local bounds + 1 u (or BOX), on the 2 u grid
  const loc = poly.map(p => worldToLandmark(l, p));
  const [x0, z0, x1, z1] = BOX[l.id] ?? [
    Math.floor(Math.min(...loc.map(p => p.x)) - 1), Math.floor(Math.min(...loc.map(p => p.z)) - 1),
    Math.ceil(Math.max(...loc.map(p => p.x)) + 1), Math.ceil(Math.max(...loc.map(p => p.z)) + 1),
  ];
  const cols = Math.ceil((x1 - x0) / STEP) + 1, rows = Math.ceil((z1 - z0) / STEP) + 1, h: number[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let hi = -Infinity;
    for (let dv = -POOL; dv <= POOL + 1e-9; dv += 0.25) for (let du = -POOL; du <= POOL + 1e-9; du += 0.25) {
      const w = landmarkToWorld(l, { x: x0 + i * STEP + du, z: z0 + j * STEP + dv });
      hi = Math.max(hi, await drawn(w.x, w.z));
    }
    h.push(Math.round((hi - base) * 100) + 0);
  }
  // the clipped streets: each chunk's own square (as streetsL0 cuts them), the parts inside the exclusion
  const streets: SettingData['streets'][number][] = [];
  const xs = poly.map(p => p.x), zs = poly.map(p => p.z);
  for (let cz = Math.floor(Math.min(...zs) / 128); cz <= Math.floor(Math.max(...zs) / 128); cz++) for (let cx = Math.floor(Math.min(...xs) / 128); cx <= Math.floor(Math.max(...xs) / 128); cx++) {
    const c = await ctxAt(cx, cz);
    if (!c) continue;
    const rd = c.chunk.roads;
    for (let i = 0; i < rd.count; i++) {
      const cls = ROAD_CLASSES[rd.cls[i]];
      if (!DRAWN.has(cls) || rd.flags[i] & (ROAD_FLAG.bridge | ROAD_FLAG.deckOnly)) continue;
      for (const sq of clipPolyline(rd.xyz, rd.pStart[i], rd.pStart[i + 1], cx * 128, cz * 128, cx * 128 + 128, cz * 128 + 128)) {
        let pieces = [sq];
        if (c.hero) pieces = pieces.flatMap(q => clipOutside(q, DISTRICT.slab, (x, z) => inPoly(x, z, DISTRICT.slab)));
        pieces = pieces.flatMap(q => clipOutside(q, poly, (x, z) => !inPoly(x, z, poly)));
        for (const piece of pieces) {
          // resampled to ≤ 2 u, local; y down to the sunk ground inside, never under the drawn ground across the
          // street's width (a freeway strip is not a corridor: the ground beside it can stand higher)
          const ws: { x: number; y: number; z: number }[] = [];
          for (let k = 0; k + 3 < piece.length; k += 3) {
            const ax = piece[k], ay = piece[k + 1], az = piece[k + 2], bx = piece[k + 3], by = piece[k + 4], bz = piece[k + 5];
            const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
            for (let s = k === 0 ? 0 : 1; s <= n; s++) {
              const t = s / n;
              ws.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, z: az + (bz - az) * t });
            }
          }
          const pts: number[] = [];
          for (let k = 0; k < ws.length; k++) {
            const { x, y, z } = ws[k], a = ws[Math.max(0, k - 1)], b = ws[Math.min(ws.length - 1, k + 1)];
            const L = Math.hypot(b.x - a.x, b.z - a.z) || 1, px = (-(b.z - a.z) / L) * (rd.width[i] / 2), pz = ((b.x - a.x) / L) * (rd.width[i] / 2);
            const ground = Math.max(await drawn(x, z), await drawn(x + px, z + pz), await drawn(x - px, z - pz));
            const p = worldToLandmark(l, { x, z }), ramp = Math.min(1, edgeDist(x, z, poly) / RAMP);
            pts.push(r2(p.x), r2(Math.max(y - sink * ramp, ground) - base), r2(p.z));
          }
          let len = 0;
          for (let k = 3; k < pts.length; k += 3) len += Math.hypot(pts[k] - pts[k - 3], pts[k + 2] - pts[k - 1]);
          if (len >= 0.3) streets.push({ c: cls, w: r2(rd.width[i]), p: pts });
        }
      }
    }
  }
  return { base: r2(base), sink, grid: { x0, z0, step: STEP, cols, rows, h }, streets };
}

