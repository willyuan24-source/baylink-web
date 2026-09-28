// Prints each tier-3 site's lod-0 model top over its base (the `w4.height.top` the records carry; the test re-measures
// it) and its triangle counts (model, ground, lod 2), for authoring (lane L3, W4-L9).
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/sites3-tops.mts [--site <id>]
import { buildLandmark } from '../../src/opus-bay/world/sf/landmarks/index';
import { W4_SITES_T3_ALL as W4_SITES_T3 } from '../../src/opus-bay/world/sf/landmarks/w4list3';

const args = process.argv.slice(2);
const only = args.includes('--site') ? args[args.indexOf('--site') + 1] : null;
const tris = (g: ReturnType<typeof buildLandmark>) => (g.getIndex()?.count ?? g.getAttribute('position').count) / 3;
for (const s of W4_SITES_T3) {
  if (only && s.id !== only) continue;
  const g0 = buildLandmark(s, 0, 0), g2 = buildLandmark(s, 2, 0);
  g0.computeBoundingBox();
  const ground = (s.ground ?? []).reduce((a, q) => a + Math.max(0, q.poly.length - 2), 0);
  console.log(`${s.id.padEnd(30)} top ${g0.boundingBox!.max.y.toFixed(2)} (record ${s.w4.height.top})  lod0 ${tris(g0)} + ground ${ground}  lod2 ${tris(g2)}`);
}
