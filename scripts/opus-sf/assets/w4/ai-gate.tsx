// Lane V (wave 4, part 2) · the AI swap gate for the wave-4 sites, dev server only (nothing imports this file; `vite
// build` never sees it). Lane D2's decision gate (SoloView ?solo=<id>&ai=0|1, golden hour, the 64 px far view) plus the
// same site in the streaming city, for sites that are not registered yet:
//
//   /scripts/opus-sf/assets/w4/ai-gate.html?sites=geary-west&ai=1&solo=all&sheet=0&time=golden      SoloView
//   /scripts/opus-sf/assets/w4/ai-gate.html?sites=geary-west&ai=0&world=city&start=free&time=golden  in the city
//
// - `sites`: wave-4 site ids (world/sf/landmarks/w4list.ts). With `solo`, the registry holds ONLY these sites (so
//   SoloView's `solo=all` mode is the turntable of just them, `__opusSolo.select(i)` picks one); without it they are
//   appended to the registry before the city boots (as lane L's scripts/opus-sf/sites-preview.tsx does).
// - Each listed site with a row in data/sf/w4Swaps.ts (W4_SWAPS: the exact rows for the integration) gets
//   `swap = { parts: [w4SwapPart(row, g.at)], build: remainder, ship: ai }` and, with `ai=1`, the row's walk blockers
//   and fade: `ai=1` draws the AI model the way the city will after the integration (the D2 swap path of
//   world/sf/sites.ts and SoloView), `ai=0` the procedural site.
// - The four wave-4 models (data/sf/w4Models.ts) are added to ASSETS.models (not registered anywhere else yet);
//   `hv=<file>` / `pv=<file>` load another GLB under /opus-bay/models/sf/ for sf-holy-virgin / sf-chinese-pavilion
//   (candidate re-fits, compared before one is published); `hvs=sx,sy,sz` / `pvs=…` override their part's scale.
import { Suspense, createElement, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { ASSETS } from '../../../../src/opus-bay/data/assets';
import { W4_MODELS, type W4ModelId } from '../../../../src/opus-bay/data/sf/w4Models';
import { w4Swap, w4SwapPart, w4SwapPlinth } from '../../../../src/opus-bay/data/sf/w4Swaps';
import type { BatchLike } from '../../../../src/opus-bay/world/builder';
import { BOX, M } from '../../../../src/opus-bay/world/builder';
import { SF_LANDMARKS } from '../../../../src/opus-bay/world/sf/landmarks/index';
import { NONE, box, lathe } from '../../../../src/opus-bay/world/sf/landmarks/kit';
import { siteGround } from '../../../../src/opus-bay/world/sf/landmarks/siteKit';
import { W4_SITES } from '../../../../src/opus-bay/world/sf/landmarks/w4list';

const q = new URLSearchParams(location.search);
const ai = q.get('ai') !== '0';
const solo = q.has('solo');
const only = (q.get('sites') ?? '').split(',').filter(Boolean);

/** Candidate GLBs for the two re-fittable models (?hv= / ?pv=). */
const override: Partial<Record<W4ModelId, string | null>> = { 'sf-holy-virgin': q.get('hv'), 'sf-chinese-pavilion': q.get('pv') };
for (const id of Object.keys(W4_MODELS) as W4ModelId[]) {
  const file = override[id];
  ASSETS.models[id] = file ? { ...W4_MODELS[id], url: `/opus-bay/models/sf/${file}` } : W4_MODELS[id];
}

/** Blue Heron Lake's procedural remainder under the AI pavilion: lane L's stone base and the two causeways
 *  (blue-heron-lake.ts; the floor platform, columns, beams, roof and finial are the model's). */
const BHL = { BASE: 0.45, R_FLOOR: 2.4, STONE: '#c9c1b2', CAUSEWAYS: [[0, 2.8, 1.3, 0], [-2.75, -1.05, 1.6, -1.48]] as const };
function blueHeronRemainder(b: BatchLike) {
  lathe(b, [[BHL.R_FLOOR + 0.15, -1.2], [BHL.R_FLOOR + 0.15, 0]], 0, BHL.BASE, 0, BHL.STONE, NONE, 8);
  for (const [x, z, len, ry] of BHL.CAUSEWAYS) b.add(BOX(), M(x, BHL.BASE - 1.2, z, ry, 1.3, 1.4, len), BHL.STONE);
}

const scaleOf = (key: string, def: readonly [number, number, number]): readonly [number, number, number] => {
  const v = (q.get(key) ?? '').split(',').map(Number);
  return v.length === 3 && v.every(n => Number.isFinite(n) && n > 0) ? [v[0], v[1], v[2]] : def;
};
/** the procedural remainder each site keeps under its AI part (lane L's code at the integration; W4SwapRow.remainder) */
/** Holy Virgin's remainder: the plinth under the body and porch where the lot falls away toward the back (review 2) */
function gearyWestRemainder(b: BatchLike) {
  for (const p of w4SwapPlinth(w4Swap('geary-west')!, siteGround('geary-west', 10.1).at)) box(b, p.x, p.y, p.z, p.w, p.h, p.d, p.color);
}
const REMAINDER: Record<string, (b: BatchLike) => void> = { 'geary-west': gearyWestRemainder, 'blue-heron-lake': blueHeronRemainder };
const SCALE_KEY: Partial<Record<W4ModelId, string>> = { 'sf-holy-virgin': 'hvs', 'sf-chinese-pavilion': 'pvs' };

const picked = W4_SITES.filter(s => only.includes(s.id));
for (const s of picked) {
  const row = w4Swap(s.id);
  const build = REMAINDER[s.id];
  if (!row || !build) continue;
  const part = w4SwapPart(row, siteGround(s.id, s.base).at);
  const key = SCALE_KEY[row.model];
  const site = s as { swap?: unknown; walk?: { blockers: unknown[]; surfaces?: unknown[] }; fade?: unknown };
  site.swap = { parts: [{ ...part, scale: key ? scaleOf(key, part.scale) : part.scale }], build, ship: ai, note: row.note };
  // the walk data and fade the row asks for while the AI part ships (as lane L's record will carry them)
  if (ai) { site.walk = { ...(site.walk ?? {}), blockers: row.blockers }; if (row.fade) site.fade = row.fade; }
}
if (solo) SF_LANDMARKS.splice(0, SF_LANDMARKS.length, ...picked);
else SF_LANDMARKS.push(...picked);
(window as unknown as { __aiGate?: unknown }).__aiGate = { sites: picked.map(s => s.id), ai, override };

// (createElement, not JSX: a PascalCase lazy component in a file without exports trips react-refresh's lint rule)
const page = lazy(() => import('../../../../src/opus-bay/OpusBayPage'));
createRoot(document.getElementById('root')!).render(createElement(Suspense, { fallback: null }, createElement(page)));
