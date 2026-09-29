import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 5 · lane R (W5-R6): Fleet Week over the Bay (realsf/jets.ts) — the window from the organiser's air-show days only,
// four jets on phones, the triangle / call budget, a loop over open water that never meets the bridge, Alcatraz, the
// ferry or the other jets, the pelican's soft boxes, the photo spot on the walking network, the lines.

// --- headless canvas stub (world modules create label atlases at import time; same as the events test) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { parseBayDate, __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const J = await import('../src/opus-bay/realsf/jets');
const { venueById, SOUVENIR_IDS, EVENT_SAY } = await import('../src/opus-bay/realsf/eventVenues');
const { projectCity } = await import('../src/opus-bay/core/geo');

const bay = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return d!; };
const zhLen = (s: string) => [...s].length;

test('W5-R6 window: the jets fly only Oct 9–11, 12:00–16:00 Bay time (the organiser air-show days; not the Thursday practice, not 2027)', () => {
  assert.equal(J.JETS_SOURCE.sourceUrl, 'https://fleetweeksf.org/air-show/');
  assert.deepEqual(J.jetWindows(), venueById('marina-green')!.hours![J.JETS_EVENT], 'one source of truth: the Marina Green venue row');
  const on = ['2026-10-09T12:00', '2026-10-09T12:40', '2026-10-10T15:59', '2026-10-11T13:00'];
  const off = ['2026-10-08T12:30', '2026-10-09T11:59', '2026-10-09T16:00', '2026-10-11T16:30', '2026-10-12T13:00', '2026-10-04T13:00', '2027-10-09T13:00', '2026-09-28T13:00'];
  for (const s of on) assert.equal(J.jetsUp(bay(s)), true, s);
  for (const s of off) assert.equal(J.jetsUp(bay(s)), false, s);
  // the show day (the morning line and the photo spot) is the window's date
  const w = J.jetWindowOn(bay('2026-10-10T08:00'))!;
  assert.equal(w.open, bay('2026-10-10T12:00').getTime());
  assert.equal(w.close, bay('2026-10-10T16:00').getTime());
  assert.equal(J.jetWindowOn(bay('2026-10-12T08:00')), null);
  // through the Bay clock (?date= in DEV / QA builds; tests stub it)
  __setBayNowForTests('2026-10-09T12:40');
  try { assert.equal(J.jetsUp(), true); } finally { __setBayNowForTests(null); }
});

test('W5-R6 budget: six jets at quality high, four on phones (mid / low); ≤ 2.5k triangles in ≤ 2 draw calls; toy paint, own materials', async () => {
  const THREE = await import('three');
  assert.equal(J.jetCount('high'), 6);
  assert.equal(J.jetCount('mid'), 4);
  assert.equal(J.jetCount('low'), 4);
  const geo = J.buildJetGeometry();
  const jetTris = (geo.index?.count ?? geo.getAttribute('position').count) / 3;
  for (const a of ['position', 'normal', 'color', 'aInfo']) assert.ok(geo.getAttribute(a), a);
  const smoke = J.buildSmokeGeometry();
  const smokeTris = (smoke.index!.count / 3) / J.FORMATION.length;
  const total = 6 * jetTris + 6 * smokeTris;
  assert.ok(total <= 2500, `${total} triangles at quality high`);
  assert.ok(4 * jetTris + 4 * smokeTris < total);
  // the smoke draws only the jets that fly (a phone draws 4 ribbons)
  J.writeSmoke(smoke, bay('2026-10-09T12:40').getTime(), 4, new THREE.Vector3(-380, 10, 290));
  assert.equal(smoke.drawRange.count, 4 * J.SMOKE_INDEX_PER_JET);
  // no lettering or insignia: a handful of flat toy colours only
  const col = geo.getAttribute('color');
  const colours = new Set<string>();
  for (let i = 0; i < col.count; i++) colours.add(`${col.getX(i).toFixed(2)},${col.getY(i).toFixed(2)},${col.getZ(i).toFixed(2)}`);
  assert.ok(colours.size <= 5, `${colours.size} colours`);
  // one material instance per object kind: the jets key the TOY_INST program (nothing new), the smoke is its own
  const a = J.makeJetMaterial(), b = J.makeJetMaterial();
  assert.notEqual(a, b);
  assert.equal(a.customProgramCacheKey(), 'ob-toy-inst');
  const s = J.makeSmokeMaterial();
  assert.ok(s instanceof THREE.MeshBasicMaterial && s.transparent && !s.depthWrite);
  // the souvenir: an append-only id with a short name for the notebook
  // bit 17 of play.g.souvenir (append-only: W6-S appended the autumn catalog's events after it)
  assert.equal(SOUVENIR_IDS.indexOf(J.JETS_SOUVENIR), 17);
  assert.ok(EVENT_SAY[J.JETS_SOUVENIR]);
});

test('W5-R6 the loop: over open water with clearance, ≥ 150 u from the bridge towers and Alcatraz, above the running ferry, jets never touch', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { heightAt, isWater, canStand, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { DISTRICT } = await import('../src/opus-bay/data/district');
  const { FERRY_ROUTES } = await import('../src/opus-bay/data/ferry');
  const t = J.pathTable();
  assert.ok(t.length > 900 && t.length < 1500, `${t.length.toFixed(0)} u`);
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (let i = 0; i < t.n; i += 20) await sf.attachAround(city, t.pos[i * 3], t.pos[i * 3 + 2], 48, lms);
  await sf.attachAround(city, J.WATCH.x, J.WATCH.z, 40, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const ggb = [projectCity(37.8117, -122.4776), projectCity(37.8255, -122.4791)];
    const alcatraz = projectCity(37.8262, -122.4222);
    const ferry = FERRY_ROUTES.filter(r => r.running).flatMap(r => r.loop);
    let pose = J.poseAt(t, 0);
    let minClear = Infinity;
    for (let i = 0; i < t.n; i++) {
      const c = { x: t.pos[i * 3], z: t.pos[i * 3 + 2] };
      for (const q of ggb) assert.ok(Math.hypot(c.x - q.x, c.z - q.z) >= 150, `the bridge tower at sample ${i}`);
      assert.ok(Math.hypot(c.x - alcatraz.x, c.z - alcatraz.z) >= 150, `Alcatraz at sample ${i}`);
      const s = (i / t.n) * t.length;
      for (const [b, side, lift] of J.FORMATION) {
        pose = J.poseAt(t, s - b * J.BACK, side * J.SIDE, lift, pose);
        const { x, y, z } = pose.p;
        assert.ok(isWater(x, z), `over open water at (${x.toFixed(0)}, ${z.toFixed(0)})`);
        minClear = Math.min(minClear, y - Math.max(0, heightAt(x, z)));
        for (const f of ferry) if (Math.hypot(x - f.x, z - f.z) < 40) assert.ok(y >= 12, `over the ferry's loop at (${x.toFixed(0)}, ${z.toFixed(0)}): ${y.toFixed(1)} u`);
      }
    }
    assert.ok(minClear >= 5, `${minClear.toFixed(1)} u above the water at the lowest`);
    // the formation over a whole lap: never closer than a jet's length
    let sep = Infinity;
    const lapMs = (t.length / J.JET_SPEED) * 1000;
    for (let ms = 0; ms < lapMs; ms += 200) {
      const ps = J.jetPoses(ms, 6, t);
      for (let i = 0; i < 6; i++) for (let k = i + 1; k < 6; k++) sep = Math.min(sep, ps[i].p.distanceTo(ps[k].p));
    }
    assert.ok(sep >= 12, `${sep.toFixed(1)} u between two jets`);
    // the photo spot at Marina Green's seawall: standable and on ferry-gate's walking network
    assert.ok(canStand(J.WATCH.x, J.WATCH.z), 'the photo spot stands');
    const ix = await sf.graphIndex();
    const home = ix.component(ix.nearestNode(DISTRICT.anchors['ferry-gate'].x, DISTRICT.anchors['ferry-gate'].z, 60));
    const n = ix.nearestNode(J.WATCH.x, J.WATCH.z, 16);
    assert.ok(n >= 0 && ix.component(n) === home, 'reachable from ferry-gate');
    // the low pass comes close to the spot (the show is seen from the lawn)
    let near = Infinity;
    for (let i = 0; i < t.n; i++) near = Math.min(near, Math.hypot(t.pos[i * 3] - J.WATCH.x, t.pos[i * 3 + 2] - J.WATCH.z));
    assert.ok(near < 80, `${near.toFixed(0)} u from the spot at the nearest`);
  } finally { setCityTerrain(null); }
});

test('W5-R6 the pelican: small soft boxes hold every jet of a lap, never the Marina Green lawn or the photo spot', () => {
  const t = J.pathTable();
  const boxes = J.softBoxes(t);
  assert.ok(boxes.length >= 8 && boxes.length <= 24, `${boxes.length} boxes`);
  for (const b of boxes) assert.ok(b.maxX - b.minX < 170 && b.maxZ - b.minZ < 170, 'each box hugs its stretch of the loop');
  const inside = (x: number, y: number, z: number) => boxes.some(b => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && y >= b.minY);
  for (let ms = 0; ms < (t.length / J.JET_SPEED) * 1000; ms += 250) {
    for (const p of J.jetPoses(ms, 6, t)) assert.ok(inside(p.p.x, p.p.y, p.p.z), `a jet at (${p.p.x.toFixed(0)}, ${p.p.y.toFixed(0)}, ${p.p.z.toFixed(0)}) is in a box`);
  }
  const lawn = venueById('marina-green')!;
  for (const q of [lawn, J.WATCH]) assert.ok(!boxes.some(b => q.x >= b.minX && q.x <= b.maxX && q.z >= b.minZ && q.z <= b.maxZ), 'the lawn is free to land on');
  assert.equal(J.SOFT_BOX_LINE.zh, '我们在旁边看就好～');
});

test('W5-R6 lines ≤ 45 zh characters; the loop runs on the Bay clock (the same pass for everyone); the roar fades out by 600 u', () => {
  for (const l of [J.JETS_DAY_LINE, J.JETS_NOW_LINE, J.JETS_NEAR_LINE, J.JETS_PHOTO_LINE, J.SOFT_BOX_LINE]) {
    assert.ok(zhLen(l.zh) <= 45, l.zh);
    assert.ok(l.en.length > 10);
  }
  assert.equal(J.JETS_DAY_LINE.zh, '今天中午到下午四点，湾上有飞行表演，去码头绿地看！');
  const t = J.pathTable();
  const ms = bay('2026-10-09T12:40').getTime();
  const lap = (t.length / J.JET_SPEED) * 1000;
  const d = Math.abs(J.leadArc(ms + lap, t) - J.leadArc(ms, t));
  assert.ok(d < 0.01 || Math.abs(d - t.length) < 0.01, 'one lap later: the same place');
  assert.equal(J.roarGain(50), 1);
  assert.equal(J.roarGain(J.HEAR_FAR), 0);
  let last = 1;
  for (let x = J.HEAR_FULL; x <= J.HEAR_FAR; x += 20) { const v = J.roarGain(x); assert.ok(v <= last + 1e-9 && v >= 0); last = v; }
});
