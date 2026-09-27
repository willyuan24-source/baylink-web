import assert from 'node:assert/strict';
import test from 'node:test';
import { DISTRICT, LAND, STATIONS, at, ccw, frameAt, polygonArea, project, promenadeLength, stationOf, unproject } from '../src/opus-bay/data/district';
import {
  blockers, blockersNear, buildNavGrid, canStand, groundAt, heightAt, isLand, isWater, nearestWalkable, pointInPolygon,
  pushOutOfBlockers, surfaceAt, terrainGrid, zoneAt,
} from '../src/opus-bay/core/terrain';
import type { LandmarkKind, Polygon, Vec2 } from '../src/opus-bay/core/types';

const REQUIRED_ANCHORS = [
  'ferry-gate', 'ferry-clock', 'weekly-board', 'farmers-market', 'ferry-back-plaza',
  'pier14-end', 'pier7-end', 'exploratorium-front', 'pier33-landing', 'pier39-entrance', 'pier39-carousel', 'sea-lion-viewpoint',
  'levis-plaza', 'filbert-steps-bottom', 'filbert-steps-mid', 'coit-summit', 'coit-view',
  'streetcar-ferry', 'streetcar-green', 'streetcar-pier39',
  'npc-vendor', 'npc-fisher', 'npc-jogger-a', 'npc-jogger-b', 'npc-family', 'npc-streetcar',
  'postcard-ferry-building-dawn', 'postcard-pier7-sunset', 'postcard-exploratorium', 'postcard-filbert-steps', 'postcard-coit-tower',
  'postcard-bay-bridge-night', 'postcard-sea-lions', 'postcard-streetcar',
];
const anchor = (name: string): Vec2 => { const p = DISTRICT.anchors[name]; assert.ok(p, `anchor ${name}`); return p; };
const signedArea = (p: Polygon) => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j].x * p[i].z - p[i].x * p[j].z; return s / 2; };

test('every DESIGN §11 anchor exists, is walkable, clear of blockers, and the spawn can stand', () => {
  for (const name of REQUIRED_ANCHORS) anchor(name);
  for (const [name, p] of Object.entries(DISTRICT.anchors)) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), name);
    assert.ok(canStand(p.x, p.z, 0.4), `${name} (${p.x}, ${p.z}) must be standable`);
    assert.equal(blockersNear(p.x, p.z, 0.4).length, 0, `${name} inside a blocker`);
    assert.ok(surfaceAt(p.x, p.z), `${name} has a surface`);
  }
  assert.ok(canStand(DISTRICT.spawn.x, DISTRICT.spawn.z, 0.4), 'spawn');
  assert.ok(Math.hypot(DISTRICT.spawn.x - anchor('ferry-gate').x, DISTRICT.spawn.z - anchor('ferry-gate').z) < 0.01, 'spawn at the ferry gate');
  assert.ok(isWater(DISTRICT.ferryDock.x, DISTRICT.ferryDock.z), 'ferry dock is open water');
});

test('nav grid connects ferry gate, Pier 39, Coit summit, Pier 7 end, sea-lion viewpoint and every other anchor (4-connected BFS)', () => {
  const nav = buildNavGrid(0.5);
  const idx = (p: Vec2) => {
    const c = Math.floor((p.x - nav.minX) / nav.cell), r = Math.floor((p.z - nav.minZ) / nav.cell);
    return r * nav.cols + c;
  };
  const start = idx(anchor('ferry-gate'));
  assert.equal(nav.walkable[start], 1, 'ferry gate cell walkable');
  const seen = new Uint8Array(nav.cols * nav.rows);
  const queue = new Int32Array(nav.cols * nav.rows);
  let head = 0, tail = 0;
  queue[tail++] = start; seen[start] = 1;
  while (head < tail) {
    const i = queue[head++], c = i % nav.cols, r = (i - c) / nav.cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= nav.cols || rr >= nav.rows) continue;
      const j = rr * nav.cols + cc;
      if (!seen[j] && nav.walkable[j]) { seen[j] = 1; queue[tail++] = j; }
    }
  }
  for (const name of ['pier39-entrance', 'coit-summit', 'pier7-end', 'sea-lion-viewpoint', 'coit-view', 'pier14-end', 'levis-plaza', 'pier33-landing']) {
    assert.equal(seen[idx(anchor(name))], 1, `${name} reachable from ferry-gate`);
  }
  for (const [name, p] of Object.entries(DISTRICT.anchors)) assert.equal(seen[idx(p)], 1, `${name} reachable`);
  // the reachable area is the district, not a sliver: > 6000 m² of 0.25 u² cells
  assert.ok(tail * nav.cell * nav.cell > 6000, `reachable area ${tail * nav.cell * nav.cell}`);
});

test('promenade: continuous, real curvature, 260–320 u from the Ferry clock to the Pier 39 entrance', () => {
  const a = stationOf(anchor('ferry-clock')).st, b = stationOf(anchor('pier39-entrance')).st;
  const len = promenadeLength(a, b);
  assert.ok(len >= 260 && len <= 320, `walk length ${len.toFixed(1)}`);
  // orientation contract: Ferry Building east (+x), Pier 39 west (−x), Bay north (−z)
  const ferry = DISTRICT.landmarks.find(l => l.kind === 'ferry-building')!, p39 = DISTRICT.landmarks.find(l => l.kind === 'pier39')!;
  assert.ok(ferry.position.x > 100 && p39.position.x < -130, 'Ferry east, Pier 39 west');
  for (let st = STATIONS.ferryClock; st <= STATIONS.pier39; st += 10) {
    const f = frameAt(st);
    assert.ok(f.nz < -0.3, `bay is to −z at station ${st}`);
    // walkable across ≥ 8 u (away from obstacles the whole 10 u strip is paved)
    let width = 0;
    for (let d = -6; d <= 6; d += 0.25) { const p = at(st, d); if (surfaceAt(p.x, p.z)) width += 0.25; }
    assert.ok(width >= 8, `promenade width ${width} at station ${st}`);
  }
  // real curvature: the middle of the waterfront bulges toward the Bay (north) versus both ends
  const mid = at(230), ends = [at(STATIONS.ferryClock), at(STATIONS.pier39)];
  assert.ok(mid.z < ends[0].z - 10 && mid.z < ends[1].z - 10, 'waterfront arc bulges north');
});

test('ramps: Filbert Steps → Pioneer Park path → Coit stairs climb monotonically from Levi\'s Plaza (0) to the summit (~20)', () => {
  const ids = DISTRICT.ramps.map(r => r.id);
  assert.deepEqual(ids, ['filbert-steps', 'pioneer-park-path', 'coit-stairs']);
  for (const r of DISTRICT.ramps) {
    assert.equal(r.points.length, r.heights.length, r.id);
    for (let i = 1; i < r.heights.length; i++) assert.ok(r.heights[i] > r.heights[i - 1], `${r.id} heights increase at ${i}`);
    for (let i = 1; i < r.points.length; i++) {
      const run = Math.hypot(r.points[i].x - r.points[i - 1].x, r.points[i].z - r.points[i - 1].z), rise = r.heights[i] - r.heights[i - 1];
      assert.ok(rise / run < (r.surface === 'stairs' ? 0.75 : 0.35), `${r.id} segment ${i} slope ${(rise / run).toFixed(2)}`);
    }
  }
  const [steps, path, stairs] = DISTRICT.ramps;
  assert.equal(steps.surface, 'stairs');
  assert.equal(steps.heights[0], 0);
  assert.equal(path.heights[0], steps.heights[steps.heights.length - 1]);
  assert.equal(stairs.heights[0], path.heights[path.heights.length - 1]);
  const summit = stairs.heights[stairs.heights.length - 1];
  assert.ok(summit >= 18 && summit <= 22, `summit ${summit}`);
  // heightAt follows the corridor and the summit plateau
  const top = anchor('coit-summit'), bottom = anchor('filbert-steps-bottom'), mid = anchor('filbert-steps-mid');
  assert.ok(Math.abs(heightAt(top.x, top.z) - summit) < 0.05, 'summit plaza flat');
  assert.ok(heightAt(bottom.x, bottom.z) < 0.5, 'steps start at street level');
  assert.ok(heightAt(mid.x, mid.z) > 3 && heightAt(mid.x, mid.z) < 15, 'mid steps are halfway up');
  assert.equal(surfaceAt(mid.x, mid.z), 'stairs');
  const hill = DISTRICT.hills.find(h => h.id === 'telegraph-hill')!;
  assert.ok(hill.height >= 15 && hill.height <= 22);
  // walking up the corridor never jumps more than 0.6 u between 0.25 u samples
  for (const r of DISTRICT.ramps) {
    let prev = heightAt(r.points[0].x, r.points[0].z);
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25);
      for (let k = 1; k <= n; k++) {
        const h = heightAt(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n);
        assert.ok(Math.abs(h - prev) < 0.6, `${r.id} step ${h - prev}`);
        prev = h;
      }
    }
  }
});

test('no anchor, spawn or POI spot overlaps a collider; colliders exist for the hero landmarks', () => {
  const list = blockers();
  assert.ok(list.length > 200);
  for (const [name, p] of Object.entries(DISTRICT.anchors)) {
    for (const b of list) {
      if (b.kind === 'circle') assert.ok(Math.hypot(p.x - b.x, p.z - b.z) >= b.r + 0.3, `${name} too close to circle blocker`);
      else assert.ok(!pointInPolygon(p, b.polygon), `${name} inside polygon blocker`);
    }
  }
  for (const kind of ['ferry-building', 'coit-tower', 'pier39-carousel', 'weekly-board', 'levis-plaza', 'transamerica', 'salesforce-tower', 'cruise-terminal', 'streetcar-stop', 'telescope'] as LandmarkKind[]) {
    const lm = DISTRICT.landmarks.filter(l => l.kind === kind);
    assert.ok(lm.length > 0 && lm.every(l => l.collider), `${kind} has collider`);
  }
  const all: LandmarkKind[] = ['ferry-building', 'pier14', 'pier7', 'exploratorium', 'levis-plaza', 'filbert-steps', 'coit-tower', 'pier33', 'cruise-terminal', 'pier39', 'pier39-carousel', 'sea-lion-docks', 'weekly-board', 'farmers-market', 'transamerica', 'salesforce-tower', 'streetcar-stop', 'telescope'];
  for (const k of all) assert.ok(DISTRICT.landmarks.some(l => l.kind === k), `landmark ${k}`);
  // pushing out of a building lands outside it
  const shed = DISTRICT.piers.find(p => p.id === 'pier15')!.shed!.footprint;
  const c = shed.reduce((acc, p) => ({ x: acc.x + p.x / shed.length, z: acc.z + p.z / shed.length }), { x: 0, z: 0 });
  const out = pushOutOfBlockers(c.x, c.z, 0.4);
  assert.equal(blockersNear(out.x, out.z, 0.39).length, 0);
});

test('slab contains everything walkable; land, water and decks are classified', () => {
  const inside = (p: Vec2) => pointInPolygon(p, DISTRICT.slab);
  for (const w of DISTRICT.walk) for (const p of w.polygon) assert.ok(inside(p), `${w.id} vertex in slab`);
  for (const p of DISTRICT.piers) if (p.walkable) for (const q of p.deck) assert.ok(inside(q), `${p.id} deck in slab`);
  for (const r of DISTRICT.ramps) for (const q of r.points) assert.ok(inside(q), `${r.id} in slab`);
  for (const [name, p] of Object.entries(DISTRICT.anchors)) assert.ok(inside(p), `${name} in slab`);
  // every walkable cell of the grid is inside the slab
  const g = terrainGrid();
  let walkCells = 0;
  for (let i = 0; i < g.surface.length; i++) if (g.surface[i]) { walkCells++; assert.notEqual(g.kind[i], 0); }
  assert.ok(walkCells > 20000);
  assert.ok(isLand(anchor('levis-plaza').x, anchor('levis-plaza').z));
  assert.ok(isLand(anchor('ferry-clock').x, anchor('ferry-clock').z));
  assert.ok(!isLand(anchor('pier7-end').x, anchor('pier7-end').z) && !isWater(anchor('pier7-end').x, anchor('pier7-end').z), 'pier deck');
  const kdock = DISTRICT.landmarks.find(l => l.kind === 'sea-lion-docks')!.position;
  assert.ok(isWater(kdock.x, kdock.z), 'K-Dock floats sit in the water');
  assert.ok(polygonArea(LAND) > 30000);
});

test('streetcar: stops sit on the track next to their boarding anchors', () => {
  const path = DISTRICT.streetcar.path;
  assert.ok(path.length > 20);
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
  const pointAt = (t: number) => {
    const L = cum[cum.length - 1] * t;
    for (let i = 1; i < path.length; i++) if (cum[i] >= L) { const k = (L - cum[i - 1]) / (cum[i] - cum[i - 1]); return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * k, z: path[i - 1].z + (path[i].z - path[i - 1].z) * k }; }
    return path[path.length - 1];
  };
  const ids = DISTRICT.streetcar.stops.map(s => s.id);
  for (const id of ['ferry', 'green', 'pier39']) assert.ok(ids.includes(id), id);
  let prev = -1;
  for (const s of DISTRICT.streetcar.stops) {
    assert.ok(s.at > prev && s.at >= 0 && s.at <= 1, `${s.id} ordered`);
    prev = s.at;
    const a = anchor(`streetcar-${s.id}`), q = pointAt(s.at);
    assert.ok(Math.hypot(a.x - q.x, a.z - q.z) < 3, `${s.id} anchor next to the car (${Math.hypot(a.x - q.x, a.z - q.z).toFixed(2)})`);
    let dmin = Infinity;
    for (const p of path) dmin = Math.min(dmin, Math.hypot(p.x - a.x, p.z - a.z));
    assert.ok(dmin < 3.2, `${s.id} anchor near track`);
    assert.ok(s.name.zh && s.name.en);
  }
});

test('real geography: projection round-trips and key landmarks keep their real relative positions', () => {
  const coit = project(37.80238, -122.40583);
  const back = unproject(coit);
  assert.ok(Math.abs(back.lat - 37.80238) < 1e-6 && Math.abs(back.lng + 122.40583) < 1e-6);
  assert.equal(DISTRICT.projection.unitsPerMeter, 0.14);
  const lm = (kind: LandmarkKind) => DISTRICT.landmarks.find(l => l.kind === kind)!.position;
  // order along the waterfront, east → west
  const order = ['ferry-building', 'pier7', 'exploratorium', 'cruise-terminal', 'pier33', 'pier39'] as LandmarkKind[];
  for (let i = 1; i < order.length; i++) assert.ok(stationOf(lm(order[i])).st > stationOf(lm(order[i - 1])).st, `${order[i]} west of ${order[i - 1]}`);
  // Levi's Plaza faces Piers 19–23, Coit is inland (south) of the promenade, Transamerica south of the Ferry Building
  const levis = stationOf(lm('levis-plaza'));
  assert.ok(levis.st > STATIONS.pier17 && levis.st < STATIONS.pier27 && levis.d < -24);
  assert.ok(stationOf(lm('coit-tower')).d < -55);
  assert.ok(lm('transamerica').z > lm('ferry-building').z + 60);
  // Ferry clock tower looks down Market St
  assert.ok(Math.abs(lm('ferry-building').x - 132.7) < 4);
  // Pier 39: sea-lion docks on the west side (farther along the waterfront than the pier axis)
  assert.ok(stationOf(lm('sea-lion-docks')).st > stationOf(lm('pier39')).st);
});

test('city fabric, props and zones are dense but bounded', () => {
  assert.ok(DISTRICT.blocks.length >= 120 && DISTRICT.blocks.length <= 260, `lots ${DISTRICT.blocks.length}`);
  const victorian = DISTRICT.blocks.filter(b => b.style === 'victorian');
  assert.ok(victorian.length >= 40, `victorians ${victorian.length}`);
  assert.ok(victorian.some(b => (b.baseY ?? 0) > 5), 'houses step up Telegraph Hill');
  for (const b of DISTRICT.blocks) {
    assert.ok(b.height > 2 && b.footprint.length >= 3 && polygonArea(b.footprint) > 5, b.id);
    for (const w of DISTRICT.walk) for (const p of w.polygon) assert.ok(!pointInPolygon(p, b.footprint), `${b.id} covers walk ${w.id}`);
  }
  const palms = DISTRICT.props.filter(p => p.kind === 'palm');
  assert.ok(palms.length >= 30);
  for (const kind of ['lamp', 'bench', 'bollard', 'planter', 'bike-rack', 'bin', 'stall', 'telescope', 'mailbox', 'cone', 'crate', 'flag', 'buoy'] as const) {
    assert.ok(DISTRICT.props.some(p => p.kind === kind), `prop ${kind}`);
  }
  assert.ok(DISTRICT.props.some(p => p.pushable && p.kind === 'cone') && DISTRICT.props.some(p => p.pushable && p.kind === 'crate'));
  for (const kind of ['bay-bridge', 'yerba-buena', 'alcatraz', 'angel-island', 'east-bay-hills', 'marin-hills', 'skyline']) assert.ok(DISTRICT.backdrop.some(b => b.kind === kind), kind);
  const labels = DISTRICT.piers.map(p => p.label);
  for (const l of ['PIER 1', 'PIER 3', 'PIER 5', 'PIER 9', 'PIER 15', 'PIER 17', 'PIER 19', 'PIER 23', 'PIER 27', 'PIER 29', 'PIER 31', 'PIER 33', 'PIER 35', 'PIER 39', 'PIER 7', 'PIER 14']) assert.ok(labels.includes(l), l);
  for (const p of DISTRICT.piers) if (p.shed) assert.ok(!p.walkable && p.shed.height >= 6 && p.shed.height <= 10 && p.shed.facade, p.id);
  // zones label the key places, default last
  const zoneIds = DISTRICT.zones.map(z => z.id);
  assert.equal(zoneIds[zoneIds.length - 1], 'embarcadero');
  assert.equal(zoneAt(anchor('coit-view').x, anchor('coit-view').z)?.id, 'coit');
  assert.equal(zoneAt(anchor('ferry-clock').x, anchor('ferry-clock').z)?.id, 'ferry');
  assert.equal(zoneAt(anchor('sea-lion-viewpoint').x, anchor('sea-lion-viewpoint').z)?.id, 'pier39');
  assert.equal(zoneAt(anchor('pier7-end').x, anchor('pier7-end').z)?.id, 'pier7');
  assert.equal(zoneAt(anchor('levis-plaza').x, anchor('levis-plaza').z)?.id, 'levis');
  assert.equal(zoneAt(anchor('filbert-steps-mid').x, anchor('filbert-steps-mid').z)?.id, 'filbert');
  assert.equal(zoneAt(anchor('exploratorium-front').x, anchor('exploratorium-front').z)?.id, 'exploratorium');
  assert.equal(zoneAt(anchor('pier33-landing').x, anchor('pier33-landing').z)?.id, 'pier33');
  assert.equal(zoneAt(anchor('pier14-end').x, anchor('pier14-end').z)?.id, 'pier14');
  assert.equal(zoneAt(at(250).x, at(250).z)?.id, 'embarcadero');
});

test('polygons are counter-clockwise from above and queries are O(1)-fast', () => {
  const polys: Polygon[] = [DISTRICT.slab, LAND, ...DISTRICT.walk.map(w => w.polygon), ...DISTRICT.piers.map(p => p.deck), ...DISTRICT.blocks.map(b => b.footprint)];
  for (const p of polys) assert.ok(signedArea(p) < 0, 'CCW viewed from above (negative shoelace in x,z)');
  assert.deepEqual(ccw(DISTRICT.slab), DISTRICT.slab);
  const t0 = performance.now();
  let n = 0;
  for (let i = 0; i < 200000; i++) {
    const x = -200 + (i % 400), z = -90 + ((i * 7) % 200);
    if (canStand(x, z, 0.4)) n++;
    heightAt(x + 0.3, z + 0.7);
  }
  const ms = performance.now() - t0;
  assert.ok(n > 0);
  assert.ok(ms < 1500, `200k canStand+heightAt took ${ms.toFixed(0)} ms`);
  const g = groundAt(anchor('pier7-end').x, anchor('pier7-end').z);
  assert.equal(g.surface, 'wood');
  assert.equal(g.height, 0);
  const near = nearestWalkable({ x: anchor('pier7-end').x + 20, z: anchor('pier7-end').z });
  assert.ok(near && canStand(near.x, near.z, 0.4));
  assert.equal(nearestWalkable({ x: 0, z: 400 }, 5), null);
});

test('integration: the Ferry clock tower face is solid (the tower stands ~0.8u proud of the building body)', () => {
  // tower shaft front (world/landmarks.ts): building centre d = 17.5, tower at local z 2.9, half-width 2.06 → face at d ≈ 12.55
  for (const st of [64.4, 66, 67.6]) assert.equal(canStand(at(st, 12.8).x, at(st, 12.8).z, 0.3), false, `inside the tower at st ${st}`);
  // the bell spot in front of it stays walkable
  assert.equal(canStand(at(66, 11.4).x, at(66, 11.4).z, 0.45), true);
});
