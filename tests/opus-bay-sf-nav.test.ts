import assert from 'node:assert/strict';
import test from 'node:test';
import { canStand, nearestWalkable, setCityTerrain, standAt } from '../src/opus-bay/core/terrain';
import { createCityTerrain, landmarkWalkInputs } from '../src/opus-bay/core/sfTerrain';
import { LEG_MAX, NODE_BUCKET, RouteSearch, findGraphPath, findGraphPathAsync, polylineLength, splitLegs } from '../src/opus-bay/core/walkGraph';
import {
  NAV_WINDOW, RouteWalker, arrivalSpot, findPath, graphNodeCost, graphNodeFilter, lineOfSight, navGrid, navWindowStats, routeTo, setWalkGraph,
} from '../src/opus-bay/actors/nav';
import { DISTRICT } from '../src/opus-bay/data/district';
import { SF_LANDMARKS, landmarkToWorld, sfLandmark } from '../src/opus-bay/world/sf/landmarks/index';
import { sfDisk } from './opus-bay-sf-disk';

// Navigation (lane B, plan §5.7): the city walking graph (real graph.obc), time-sliced A*, legs, and the local grid
// A* on a window of the city + hero rasters.

const sf = sfDisk();
const LMS = landmarkWalkInputs(SF_LANDMARKS);
const FERRY = DISTRICT.anchors['ferry-gate'];
const TARGETS = {
  'twin-peaks': { x: 140.08, z: 946.9 },
  'ocean-beach': { x: -430.99, z: 1474.99 },
  'ggb-south-anchorage': landmarkToWorld(sfLandmark('golden-gate-bridge')!, { x: -160.33, z: 0 }),
};
const onSfLand = (p: { x: number; z: number }) => p.x > -900 && p.x < 1400 && p.z > -700 && p.z < 2050;

test('walk graph index: nearest node from 32 u buckets equals a brute-force scan', async () => {
  const ix = await sf.graphIndex();
  assert.equal(NODE_BUCKET, 32);
  assert.equal(ix.nodeCount, sf.manifest.graph.nodes);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let t = 0; t < 300; t++) {
    const x = -800 + rnd() * 2000, z = -200 + rnd() * 2100;
    let bd = Infinity;
    for (let i = 0; i < ix.nodeCount; i++) bd = Math.min(bd, (ix.x(i) - x) ** 2 + (ix.z(i) - z) ** 2);
    const got = ix.nearestNode(x, z, 60);
    if (Math.sqrt(bd) > 60) assert.equal(got, -1);
    else assert.ok(got >= 0 && Math.abs(((ix.x(got) - x) ** 2 + (ix.z(got) - z) ** 2) - bd) < 1e-6, `nearest at ${x.toFixed(1)},${z.toFixed(1)}`);
  }
});

test('graph routes from the Ferry Building to Twin Peaks, Ocean Beach and the GGB south anchorage exist and are plausible', async () => {
  const ix = await sf.graphIndex();
  const accept = graphNodeFilter(ix), nodeCost = graphNodeCost(ix);
  const a = ix.nearestNode(FERRY.x, FERRY.z, 60, accept);
  assert.ok(a >= 0, 'ferry snaps to the graph');
  for (const [name, to] of Object.entries(TARGETS)) {
    const b = ix.nearestNode(to.x, to.z, 60, accept);
    assert.ok(b >= 0 && Math.hypot(ix.x(b) - to.x, ix.z(b) - to.z) < 30, `${name} snaps to the graph`);
    const p = findGraphPath(ix, a, b, { nodeCost });
    assert.ok(p, `${name}: route exists`);
    const direct = Math.hypot(to.x - FERRY.x, to.z - FERRY.z);
    const ratio = p.length / direct;
    assert.ok(ratio > 1 && ratio < 1.5, `${name}: route ${p.length.toFixed(0)} u vs ${direct.toFixed(0)} u straight (×${ratio.toFixed(2)})`);
    assert.ok(p.cost >= p.length * 0.99, `${name}: cost ≥ length`);
    assert.ok(p.points.every(onSfLand), `${name}: stays in San Francisco`);
    for (let k = 1; k < p.nodes.length; k++) {
      const u = p.nodes[k - 1], v = p.nodes[k];
      let edge = false;
      for (let e = ix.graph.offsets[u]; e < ix.graph.offsets[u + 1]; e++) if (ix.graph.targets[e] === v) edge = true;
      assert.ok(edge, `${name}: consecutive nodes ${u} → ${v} share an edge`);
      assert.ok(Math.hypot(ix.x(v) - ix.x(u), ix.z(v) - ix.z(u)) < 60, 'no teleport hops');
    }
  }
});

test('A* is time-sliced: ≤ ~2 ms per step, several slices on long routes, same result as the one-shot search', async () => {
  const ix = await sf.graphIndex();
  const nodeCost = graphNodeCost(ix);
  const a = ix.nearestNode(FERRY.x, FERRY.z, 60, graphNodeFilter(ix)), b = ix.nearestNode(TARGETS['ocean-beach'].x, TARGETS['ocean-beach'].z, 60);
  const once = findGraphPath(ix, a, b, { nodeCost })!;
  const s = new RouteSearch(ix, a, b, { nodeCost });
  let steps = 0;
  while (!s.step(0.25)) steps++;
  assert.ok(steps >= 2, `sliced into ${steps + 1} steps`);
  assert.ok(s.maxSliceMs < 0.25 + 3, `longest slice ${s.maxSliceMs.toFixed(2)} ms`);
  assert.deepEqual(s.nodes, once.nodes);
  let scheduled = 0;
  const p = await findGraphPathAsync(ix, a, b, { nodeCost, budgetMs: 0.25, schedule: fn => { scheduled++; setImmediate(fn); } });
  assert.ok(p && scheduled >= 1, `async search used ${scheduled} extra frames`);
  assert.deepEqual(p.nodes, once.nodes);
  const aborted = await findGraphPathAsync(ix, a, b, { budgetMs: 0.05, schedule: fn => setImmediate(fn), signal: { aborted: true } });
  assert.equal(aborted, null);
  // a 2 ms budget (the default) finishes the cross-city route in a handful of frames
  const d = new RouteSearch(ix, a, b, { nodeCost });
  let frames = 0;
  while (!d.step()) frames++;
  assert.ok(frames < 30 && d.maxSliceMs < 5, `default slices: ${frames + 1} frames, max ${d.maxSliceMs.toFixed(2)} ms`);
});

test('legs: ≤ 60 u, continuous, same total length', () => {
  const pts = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 150 }, { x: 40, z: 190 }, { x: 41, z: 191 }];
  const legs = splitLegs(pts, LEG_MAX);
  assert.equal(LEG_MAX, 60);
  assert.ok(legs.length >= 4);
  let total = 0;
  legs.forEach((l, i) => {
    const L = polylineLength(l);
    total += L;
    assert.ok(L <= 60 + 1e-6, `leg ${i} ${L}`);
    if (i > 0) assert.deepEqual(l[0], legs[i - 1][legs[i - 1].length - 1]);
  });
  assert.ok(Math.abs(total - polylineLength(pts)) < 1e-6);
  assert.deepEqual(legs[legs.length - 1][legs[legs.length - 1].length - 1], { x: 41, z: 191 });
});

test('district findPath is unchanged by registering / clearing a city provider', () => {
  const a = DISTRICT.anchors['ferry-gate'], b = DISTRICT.anchors['sea-lion-viewpoint'];
  const before = findPath(a, b)!;
  const city = createCityTerrain(sf.manifest);
  setCityTerrain(city);
  setCityTerrain(null);
  const after = findPath(a, b)!;
  assert.deepEqual(after, before);
  assert.equal(navGrid().cell, 0.75);
});

test('city mode: local A* window leaves the hero through the Ferry crosswalk to Market St; routeTo + RouteWalker cross the city', async () => {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, 130, 60, 260, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  const ix = await sf.graphIndex();
  setWalkGraph(ix);
  try {
    const market = { x: 170, z: 150 };
    const p = findPath(FERRY, market, 8);
    assert.ok(p && !p.snapped, 'ferry gate → Market St (outside the slab)');
    const pts = [FERRY, ...p.points];
    assert.ok(polylineLength(pts) < 260, `local path ${polylineLength(pts).toFixed(0)} u (crosses at the Ferry crosswalk, not around the slab end)`);
    for (let k = 1; k < pts.length; k++) {
      const A = pts[k - 1], B = pts[k], L = Math.hypot(B.x - A.x, B.z - A.z);
      for (let t = 0; t <= L; t += 0.5) { const x = A.x + ((B.x - A.x) * t) / (L || 1), z = A.z + ((B.z - A.z) * t) / (L || 1); assert.ok(canStand(x, z, 0.3), `path point (${x.toFixed(1)}, ${z.toFixed(1)}) walkable`); }
    }
    assert.equal(navGrid().cols * navGrid().cell, NAV_WINDOW);
    assert.ok(navWindowStats.builds >= 1 && navWindowStats.lastMs < 200, `window build ${navWindowStats.lastMs.toFixed(1)} ms`);
    assert.ok(lineOfSight({ x: 170, z: 140 }, { x: 170, z: 150 }), 'line of sight inside the window');
    // a goal beyond the window is clamped (snapped), never null while the way is open
    const far = findPath(market, { x: 150, z: 700 }, 8);
    assert.ok(far && far.snapped, 'far goal clamped into the window');
    // routeTo: the Ferry → Twin Peaks route via the graph, legs ≤ 60 u, the walker refines the first leg locally
    const route = await routeTo(FERRY, TARGETS['twin-peaks'], { schedule: fn => setImmediate(fn) });
    assert.ok(route && route.via === 'graph' && !route.snapped, 'graph route');
    assert.ok(route.legs.every(l => polylineLength(l) <= LEG_MAX + 1e-6));
    assert.ok(route.length > 968 && route.length < 1400, `route length ${route.length.toFixed(0)}`);
    const w = new RouteWalker(route);
    const first = w.update(FERRY);
    assert.ok(first && first.length > 0, 'first leg refined');
    const end = first[first.length - 1];
    assert.ok(Math.hypot(end.x - w.target()!.x, end.z - w.target()!.z) < 14, 'local path reaches (near) the leg end');
    // a short hop is answered by the local grid alone
    const hop = await routeTo(FERRY, DISTRICT.anchors['pier7-end']);
    assert.ok(hop && hop.via === 'local');
    // hero graph nodes on the Embarcadero roadway are not usable snap targets; inland hero streets are
    const accept = graphNodeFilter(ix);
    let roadway = 0, inland = 0;
    for (let i = 0; i < ix.nodeCount; i++) {
      if (!ix.isHero(i)) continue;
      const q = ix.pos(i);
      if (standAt(q.x, q.z) !== 1 && !nearestWalkable(q, 1.5)) { roadway++; assert.equal(accept(i), false); } else inland++;
    }
    assert.ok(roadway > 0 && inland > roadway, `hero nodes usable ${inland}, barrier ${roadway}`);
  } finally { setCityTerrain(null); setWalkGraph(null); }
});

test('pockets and separate networks: a goal in a sealed backyard snaps to the nearest reachable cell, arrivals avoid pockets, routes to park-trail places go through the street network', async () => {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, 0, 420, 250, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  const ix = await sf.graphIndex();
  setWalkGraph(ix);
  try {
    // graph components: one street network and a few isolated trail networks
    const main = ix.mainComponent();
    assert.equal(ix.componentSize(main), 31658);
    let others = 0;
    for (let i = 0; i < ix.nodeCount; i++) if (ix.component(i) !== main) others++;
    assert.ok(others > 500 && others < 1500, `nodes off the main network: ${others}`);
    // find sealed pockets (small open areas) in the window around (0, 420)
    const start = arrivalSpot({ x: 0, z: 420 }, 20)!;
    assert.ok(start && canStand(start.x, start.z, 0.4), 'arrival spot stands');
    const g = navGrid();
    const at = (i: number) => ({ x: g.minX + ((i % g.cols) + 0.5) * g.cell, z: g.minZ + (Math.floor(i / g.cols) + 0.5) * g.cell });
    const seen = new Uint8Array(g.cols * g.rows), pockets: number[] = [];
    for (let s0 = 0; s0 < seen.length && pockets.length < 40; s0++) {
      if (seen[s0] || g.walkable[s0] !== 1) continue;
      const st = [s0], cells = [s0]; seen[s0] = 1;
      while (st.length) {
        const u = st.pop()!, c = u % g.cols;
        for (const v of [c > 0 ? u - 1 : -1, c < g.cols - 1 ? u + 1 : -1, u - g.cols, u + g.cols]) if (v >= 0 && v < seen.length && !seen[v] && g.walkable[v] === 1) { seen[v] = 1; st.push(v); cells.push(v); }
      }
      const p = at(cells[0]);
      if (cells.length >= 4 && cells.length < 60 && Math.hypot(p.x - start.x, p.z - start.z) < 120) pockets.push(cells[0]);
    }
    assert.ok(pockets.length >= 5, `sealed pockets near (0, 420): ${pockets.length}`);
    let snappedOk = 0;
    for (const pk of pockets.slice(0, 8)) {
      const goal = at(pk);
      const p = findPath(start, goal, 12);
      if (!p) continue; // nothing reachable within 12 u of that pocket
      snappedOk++;
      const end = p.points[p.points.length - 1];
      assert.ok(end.x !== goal.x || end.z !== goal.z, 'moved out of the pocket (snapped, or onto a cell diagonal to it)');
      assert.ok(Math.hypot(end.x - goal.x, end.z - goal.z) <= 12 + 1, 'ends near the pocket');
      assert.ok(canStand(end.x, end.z, 0.3), 'ends on reachable ground');
    }
    assert.ok(snappedOk >= 3, `pocket goals answered: ${snappedOk}`);
    for (const pk of pockets.slice(0, 5)) {
      const s = arrivalSpot(at(pk), 30)!;
      assert.ok(s, 'an arrival spot near every pocket');
      assert.ok(findPath(start, s, 1), 'the arrival spot is reachable from the street');
    }
    // a place on an isolated trail network (not the main one) still gets a route from the ferry
    const trail = (() => { for (let i = 0; i < ix.nodeCount; i++) if (ix.component(i) !== main && ix.componentSize(ix.component(i)) > 50) { const p = ix.pos(i); if (ix.nearestNode(p.x, p.z, 180, j => ix.component(j) === main) >= 0) return p; } return null; })();
    assert.ok(trail, 'a trail node near the street network');
    const route = await routeTo(FERRY, trail, { schedule: fn => setImmediate(fn) });
    assert.ok(route && route.via === 'graph', `route to the trail network at (${trail.x.toFixed(0)}, ${trail.z.toFixed(0)})`);
    assert.deepEqual(route.points[route.points.length - 1], trail);
  } finally { setCityTerrain(null); setWalkGraph(null); }
});
