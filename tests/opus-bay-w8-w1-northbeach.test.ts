import assert from 'node:assert/strict';
import test from 'node:test';
import { DISTRICT } from '../src/opus-bay/data/district';
import { ROUTE_PATHS } from '../src/opus-bay/data/sf/routePaths';
import { sfRoute } from '../src/opus-bay/data/sf/routes';
import { NB_SQUARE } from '../src/opus-bay/world/sf/cornersNB';
import { NB_BUDGET, NB_ROAD, buildNorthBeach, nbCafes, nbColumbusRoad, nbPoles } from '../src/opus-bay/world/sf/cornersNorthBeach';

/**
 * Wave 8 · lane W1 · W8-W13 North Beach leftovers: Columbus Ave's carriageway painted inside the hero slab (world/sf/
 * cornersNorthBeach.ts nbColumbusRoad), and route r1's two mid-street via points moved onto the junctions its walk
 * already turns at (data/sf/routes.ts; the static sweep: CORRIDOR → ok).
 */

type P = { x: number; z: number };
function inPoly(x: number, z: number, p: readonly P[]) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c; }
  return c;
}

test('W8-W13 Columbus Ave\'s asphalt: one run inside the slab, never on the lawn, the café tables and poles on the sidewalk, within the corner\'s budget', () => {
  const runs = nbColumbusRoad();
  assert.equal(runs.length, 1, 'one continuous street');
  const run = runs[0];
  assert.ok(run.length >= 100, `${run.length} samples (≈ 1 u apart)`);
  for (const s of run) {
    assert.ok(s.l >= 0.45 && s.l <= NB_ROAD.half + 1e-9 && s.r >= 0.45 && s.r <= NB_ROAD.half + 1e-9, 'half-widths');
    for (const o of [s.l, 0, -s.r]) {
      const x = s.x + s.nx * o, z = s.z + s.nz * o;
      assert.ok(inPoly(x, z, DISTRICT.slab), `(${x.toFixed(1)}, ${z.toFixed(1)}) inside the slab (the city draws Columbus outside it)`);
      assert.ok(!inPoly(x, z, NB_SQUARE), `(${x.toFixed(1)}, ${z.toFixed(1)}) off Washington Square's lawn`);
    }
  }
  // the café tables (r 0.3 + 0.15 of chair) and the poles stand clear of the asphalt's edge
  const edgeAt = (x: number, z: number) => {
    let best = { d: Infinity, half: 0 };
    for (let i = 1; i < run.length; i++) {
      const a = run[i - 1], b = run[i], dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L));
      const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
      if (d < best.d) best = { d, half: Math.max(a.l, a.r, b.l, b.r) };
    }
    return best.d - best.half;
  };
  const cafes = nbCafes();
  assert.ok(cafes.length >= 5);
  for (const c of cafes) assert.ok(edgeAt(c.x, c.z) >= 0.4, `café at ${c.x.toFixed(1)}, ${c.z.toFixed(1)}: ${edgeAt(c.x, c.z).toFixed(2)} u off the asphalt`);
  for (const p of nbPoles(cafes)) assert.ok(edgeAt(p.x, p.z) >= 0.5, `pole ${edgeAt(p.x, p.z).toFixed(2)} u off the asphalt`);
  const nb = buildNorthBeach();
  assert.ok(nb.triangles <= NB_BUDGET.triangles, `${nb.triangles} triangles`);
  nb.toy.geometry.dispose();
  nb.signs?.geometry.dispose();
});

test('W8-W13 route r1: via 1 and via 3 stand on the junctions the generated walk turns at (routePaths.ts unchanged by the move)', () => {
  const r1 = sfRoute('r1')!, stop = r1.stops.find(s => s.id === 'r1-washington-sq')!;
  assert.deepEqual(stop.via, [[2, 119], [-9.8, 110.7], [-34.1, 93.8], [-45.3, 86.0]]);
  const pts = ROUTE_PATHS.r1.points;
  for (const [x, z] of [stop.via![0], stop.via![2]]) {
    let d = Infinity;
    for (let i = 0; i < pts.length; i += 2) d = Math.min(d, Math.hypot(pts[i] - x, pts[i + 1] - z));
    assert.ok(d < 0.25, `via (${x}, ${z}) is a corner of the route's walk (${d.toFixed(2)} u)`);
  }
});
