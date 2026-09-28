import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';

/**
 * Wave 5 · lane A · the activities (plan sf-w5-plan.md §4.11 tests `w5-play-acts`): the 16 view spots (append-only
 * ids, facts with a source, standable on the published city, facing an open view, clear of the other prompts), the
 * first flight's course (inside the model, every ring inside the glide's envelope over what is under it, a flyable
 * spacing), the local course from every unlock viewpoint, and the chunks (the core ≤ 6 KB gzip, each activity chunk ≤ 5
 * KB, the folder outside GameRoot's static graph).
 */

// --- headless canvas stub (world modules create label atlases at import time) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const views = await import('../src/opus-bay/play/viewSpots');
const flight = await import('../src/opus-bay/play/firstFlight');
const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
const { CITY_POIS } = await import('../src/opus-bay/data/sf/cityPois');
const { CITY_DISTRICT_POIS } = await import('../src/opus-bay/data/pois');
/** Every POI prompt the city builds (game/interactables.ts: the district's POIs in the city too, and the city's own). */
const CITY_POI_PROMPTS = [...CITY_DISTRICT_POIS, ...CITY_POIS].filter(p => p.position && p.interaction).map(p => ({ id: `poi ${p.id}`, x: p.position.x, z: p.position.z, r: Math.max(1.5, p.radius || 3) }));
const { PLACE_CARDS } = await import('../src/opus-bay/data/sf/placeCards');
const { PLACE_CARDS_2 } = await import('../src/opus-bay/data/sf/placeCards2');
const { CITY_POSTCARDS } = await import('../src/opus-bay/data/sf/postcards');
const { project } = await import('../src/opus-bay/core/geo');
const T = await import('../src/opus-bay/core/terrain');
const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
const siteContext = await import('../src/opus-bay/world/sf/landmarks/context');
const { GLIDE, terrainGlideWorld } = await import('../src/opus-bay/actors/glide');
const { heroTall, bayBridgeTall } = await import('../src/opus-bay/actors/glideTall');
const { sfDisk } = await import('./opus-bay-sf-disk');

const ROOT = path.resolve(import.meta.dirname, '..');
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const width = (text: string) => [...text].reduce((s, ch) => s + (ch === ' ' ? 0 : ch.charCodeAt(0) < 128 ? 0.5 : 1), 0);
const sf = sfDisk();
const LMS = landmarkWalkInputs(SF_SITES);

async function cityAround(points: { x: number; z: number }[], r: number) {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  for (const p of points) await sf.attachAround(city, p.x, p.z, r, LMS);
  T.setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
}

test('W5-A1 view spots: 16 append-only ids, bilingual names and short lines, a checked source, the MF8 areas', () => {
  // APPEND-ONLY: this list only grows (lane E's notebook and the play save's `view` bitset are indexed by it)
  assert.deepEqual([...views.VIEW_SPOT_IDS], [
    'twin-peaks', 'bernal-heights', 'grand-view', 'ina-coolbrith', 'alta-plaza', 'dolores-park', 'lands-end', 'sutro-heights',
    'wave-organ', 'crissy-beach', 'coit', 'buena-vista', 'mount-davidson', 'corona-heights', 'marina-green', 'aquatic-park',
  ]);
  assert.equal(new Set(views.VIEW_SPOT_IDS).size, 16);
  const attractionIds = new Set(ATTRACTIONS.map(a => a.id));
  for (const s of views.VIEW_SPOTS) {
    assert.match(s.id, /^[a-z0-9-]{1,30}$/);
    assert.match(views.viewReward(s.id), /^view:[a-z0-9-]+$/);
    for (const t of [s.name, s.line]) {
      assert.ok(t.zh.trim() && t.en.trim() && /[一-鿿]/.test(t.zh) && !/[一-鿿]/.test(t.en), `${s.id}: bilingual`);
    }
    assert.ok(width(s.line.zh) <= 20, `${s.id}: the caption line fits (${width(s.line.zh)})`);
    assert.ok(width(`看风景 · ${s.name.zh}`) <= 20, `${s.id}: the caption title fits`);
    assert.match(s.source, /^https:\/\//);
    assert.equal(s.verifiedAt, '2026-09-28');
    if (s.attraction) {
      assert.ok(attractionIds.has(s.attraction), `${s.id}: attraction ${s.attraction}`);
      const a = ATTRACTIONS.find(x => x.id === s.attraction)!;
      assert.ok(dist(s, a) < 70, `${s.id}: ${dist(s, a).toFixed(1)} u from ${a.id} (the Lands End trail runs ≈ 60 u from its lookout)`);
    }
    assert.equal(views.viewSpotIndex(s.id), views.VIEW_SPOT_IDS.indexOf(s.id));
  }
  // something to look at in every part of the city the plan counts (MF8), five attraction areas
  assert.deepEqual([...new Set(views.VIEW_SPOTS.map(s => s.area))].sort(), ['bridge-presidio', 'coast', 'north-downtown', 'park-sunset', 'twin-peaks-mission']);
  assert.equal(views.VIEW_SIT_SECONDS, 5);
  assert.equal(views.VIEW_LOOK_SECONDS, 20);
  assert.equal(views.VIEW_COINS, 5);
});

test('W5-A4 view spots on the published city: standable, facing an open view, clear of every other prompt', async () => {
  await cityAround(views.VIEW_SPOTS, 110);
  const prompts = [
    ...CITY_POI_PROMPTS,
    ...[...PLACE_CARDS, ...PLACE_CARDS_2].filter(c => c.lat !== undefined && c.lng !== undefined).map(c => ({ id: `card ${c.id}`, ...project(c.lat!, c.lng!) })),
    ...CITY_POSTCARDS.map(c => ({ id: `postcard ${c.id}`, ...c.position })),
  ];
  const roofNear = (x: number, z: number) => { let top = -Infinity; T.forEachBlockerNear(x, z, 1, b => { const t = (b as { top?: number }).top; if (typeof t === 'number' && t > top) top = t; }); return top; };
  try {
    for (const s of views.VIEW_SPOTS) {
      assert.ok(T.canStand(s.x, s.z, 0.45), `${s.id}: standable`);
      const h = views.viewHeading(s);
      // the view: from eye height, nothing (ground or a roof) rises over a line dropping 4 % over the first 80 u
      const eye = T.heightAt(s.x, s.z) + 1.6;
      for (let d = 4; d <= 80; d += 2) {
        const x = s.x + Math.sin(h) * d, z = s.z + Math.cos(h) * d;
        const top = Math.max(T.heightAt(x, z), roofNear(x, z));
        assert.ok(top < eye + 0.04 * d + 0.5, `${s.id}: blocked ${d} u ahead (${top.toFixed(1)} over eye ${eye.toFixed(1)})`);
      }
      // the 坐下看风景 prompt never sits on another prompt
      for (const p of prompts) assert.ok(dist(s, p) >= views.VIEW_RADIUS + 1, `${s.id}: ${dist(s, p).toFixed(1)} u from ${p.id}`);
      for (const o of views.VIEW_SPOTS) if (o !== s) assert.ok(dist(s, o) > 20, `${s.id} vs ${o.id}`);
    }
  } finally { T.setCityTerrain(null); }
});

test('W5-A4 / CP-9 view spots reached on foot: a nav path from the walk graph, ≥ 3 of 4 directions move ≥ 3 u (the walk sweep\'s rule)', async () => {
  const { findPath } = await import('../src/opus-bay/actors/nav');
  const { openHeading } = await import('../src/opus-bay/actors/faceOpen');
  const { PlayerController } = await import('../src/opus-bay/actors/controller');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  await cityAround(views.VIEW_SPOTS, 60);
  const ix = await sf.graphIndex(), main = ix.mainComponent();
  const c = new PlayerController(), p = runtime.player, keep = { x: p.x, y: p.y, z: p.z, heading: p.heading };
  const DT = 1 / 30;
  // scripts/opus-sf/qa/sweep-static.mts: the real controller pushed 1.5 s from the spot, the most open way first, then 90° steps
  const push = (x: number, z: number, heading: number) => {
    p.x = x; p.z = z; p.y = T.heightAt(x, z); p.heading = heading; p.pathTarget = null; p.locked = false;
    c.sync();
    runtime.input.moveX = 0; runtime.input.moveY = 1; runtime.input.run = false; runtime.input.jump = false;
    const yaw = Math.atan2(-Math.sin(heading), -Math.cos(heading));
    for (let i = 0; i < 1.5 / DT; i++) c.step({ dt: DT, now: i * DT, cameraYaw: yaw, frozen: false, riding: false });
    runtime.input.moveY = 0;
    return Math.hypot(p.x - x, p.z - z);
  };
  try {
    for (const s of views.VIEW_SPOTS) {
      const n = ix.nearestNode(s.x, s.z, 60, k => ix.component(k) === main);
      assert.ok(n >= 0, `${s.id}: a walk-graph node within 60 u`);
      const res = findPath({ x: ix.x(n), z: ix.z(n) }, { x: s.x, z: s.z }, 8);
      const e = res?.points[res.points.length - 1];
      assert.ok(res && (!e || Math.hypot(e.x - s.x, e.z - s.z) <= 1.1), `${s.id}: a walk reaches it`);
      const first = openHeading(s.x, s.z, 0).heading;
      const moved = [0, 1, 2, 3].map(k => push(s.x, s.z, first + (k * Math.PI) / 2));
      assert.ok(moved.filter(m => m >= 3).length >= 3, `${s.id}: moves ${moved.map(m => m.toFixed(1)).join(' / ')}`);
    }
  } finally {
    Object.assign(p, keep, { pathTarget: null });
    T.setCityTerrain(null);
  }
});

test('W5-A5 first flight, the Coit course: inside the model, every ring inside the glide envelope over what is under it, flyable spacing', async () => {
  const course = flight.COIT_COURSE;
  assert.equal(course.length, 8);
  await cityAround(course, 90);
  try {
    const tall = [...siteContext.landmarkTallStructures(l => (typeof l.base === 'number' ? l.base : T.heightAt(l.x, l.z))), ...heroTall(), ...bayBridgeTall()];
    const world = terrainGlideWorld(tall);
    let len = 0;
    course.forEach((r, i) => {
      assert.ok(T.inWorld(r.x, r.z), `ring ${i + 1}: in the model`);
      // the floor the data carries is at least what the glide sees there (ground, roofs, towers within the ring's reach)
      const floor = Math.max(world.heightAt(r.x, r.z), world.roofAt(r.x, r.z, GLIDE.floorR + flight.RING_R));
      assert.ok(r.floor >= floor - 1e-6, `ring ${i + 1}: floor ${r.floor} under the glide's ${floor.toFixed(1)}`);
      // the envelope: the lowest ring height clears the glide's soft floor (+6) by 2 u, the highest stays under the ceiling
      assert.ok(flight.ringY(r.floor, -1e9) >= floor + GLIDE.floorClear + 2);
      assert.ok(flight.ringY(r.floor, 1e9) <= GLIDE.ceiling);
      if (i) {
        const d = dist(r, course[i - 1]);
        assert.ok(d >= 40 && d <= 120, `ring ${i}→${i + 1}: ${d.toFixed(0)} u`);
        len += d;
      }
    });
    const seconds = len / GLIDE.cruise;
    assert.ok(seconds > 30 && seconds < 60, `≈ ${seconds.toFixed(0)} s at cruise`);
    // it starts at Coit and ends at PIER 39
    const coit = ATTRACTIONS.find(a => a.id === 'coit-tower')!, pier = ATTRACTIONS.find(a => a.id === 'pier-39')!;
    assert.ok(dist(course[0], coit) < 70 && dist(course[7], pier) < 40);
    // every ring pays once through lane E: its own source in the reward grammar
    const { REWARD_SOURCE } = await import('../src/opus-bay/core/events');
    for (let i = 0; i < 8; i++) assert.match(flight.ringSource(i), REWARD_SOURCE);
    assert.equal(new Set(course.map((_, i) => flight.ringSource(i))).size, 8);
  } finally { T.setCityTerrain(null); }
});

test('W5-A5 first flight elsewhere: a local course from every unlock viewpoint stays inside the model', async () => {
  const from = ATTRACTIONS.filter(a => a.panorama).map(a => ({ id: a.id, x: a.arrival?.x ?? a.x, z: a.arrival?.z ?? a.z }));
  assert.ok(from.length >= 6, `${from.length} panorama viewpoints`);
  await cityAround(from, 60);
  try {
    for (const p of from) for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const c = flight.localCourse(p, heading);
      assert.equal(c.length, 8, `${p.id} @ ${heading.toFixed(2)}: 8 rings`);
      c.forEach((r, i) => {
        assert.ok(T.inWorld(r.x, r.z), `${p.id}: ring ${i + 1} in the model`);
        assert.ok(Math.abs(dist(r, i ? c[i - 1] : p) - flight.LOCAL_STEP) < 1e-6);
      });
    }
  } finally { T.setCityTerrain(null); }
  // the ring height rule
  assert.equal(flight.ringY(20, 0), 28);
  assert.equal(flight.ringY(20, 40), 40);
  assert.equal(flight.ringY(20, 500), 65);
});

test('W5-A1 chunks: the play core ≤ 6 KB gzip, each activity chunk ≤ 5 KB, nothing of play/ in GameRoot\'s static graph', async () => {
  const { build } = await import('esbuild');
  const dir = path.join(ROOT, 'src/opus-bay/play');
  // what Vite splits: the core (index.ts and its static closure inside play/), then each lazily imported module
  const lazyOnes = ['EmoteWheel.tsx', 'pet.ts', 'sit.ts', 'firstFlight.ts', 'rings.ts', 'FlightChip.tsx', 'ResultCard.tsx', 'zones.ts', 'PlayChip.tsx'];
  // part b: the activities load behind the zones chunk (its modules are already there)
  const behindZones = ['slides.ts', 'stairs.ts', 'bell.ts', 'BellPad.tsx'];
  const closure = (entry: string) => {
    const seen = new Set<string>();
    const walk = (f: string) => {
      if (seen.has(f)) return;
      seen.add(f);
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/^\s*import\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?['"](\.\/[^'"]+)['"]/gm)) {
        const base = path.resolve(path.dirname(f), m[1]);
        const hit = [base, `${base}.ts`, `${base}.tsx`].find(c => fs.existsSync(c) && fs.statSync(c).isFile());
        if (hit && !hit.endsWith('.css')) walk(hit);
      }
    };
    walk(entry);
    return seen;
  };
  const core = closure(path.join(dir, 'index.ts'));
  const size = async (entry: string, shared: Set<string>) => {
    const r = await build({
      entryPoints: [entry], bundle: true, write: false, minify: true, format: 'esm', jsx: 'automatic', target: 'es2022', logLevel: 'silent',
      plugins: [{
        name: 'play-only',
        setup(b) {
          b.onResolve({ filter: /.*/ }, args => {
            if (args.kind === 'entry-point') return undefined;
            if (args.kind === 'dynamic-import' || !args.path.startsWith('.')) return { path: args.path, external: true };
            const base = path.resolve(args.resolveDir, args.path);
            const hit = [base, `${base}.ts`, `${base}.tsx`].find(c => fs.existsSync(c) && fs.statSync(c).isFile());
            if (!hit || !hit.startsWith(dir) || hit.endsWith('.css') || (shared.has(hit) && hit !== entry)) return { path: args.path, external: true };
            return { path: hit };
          });
        },
      }],
    });
    return zlib.gzipSync(r.outputFiles[0].contents).length;
  };
  const coreBytes = await size(path.join(dir, 'index.ts'), new Set());
  assert.ok(coreBytes <= 6 * 1024, `core ${coreBytes} B`);
  if (process.env.OPUS_PLAY_SIZES) console.log(`core ${coreBytes} B`);
  for (const f of lazyOnes) {
    const bytes = await size(path.join(dir, f), core);
    assert.ok(bytes <= 5 * 1024, `${f}: ${bytes} B`);
    if (process.env.OPUS_PLAY_SIZES) console.log(`${f} ${bytes} B`);
  }
  const zonesShared = new Set([...core, ...closure(path.join(dir, 'zones.ts'))]);
  for (const f of behindZones) {
    const bytes = await size(path.join(dir, f), zonesShared);
    assert.ok(bytes <= 5 * 1024, `${f}: ${bytes} B`);
    if (process.env.OPUS_PLAY_SIZES) console.log(`${f} ${bytes} B`);
  }
  // part c: the should activities share their props, sounds and helpers (play/toyMesh.ts, sounds3.ts, partc.ts: one chunk Vite splits
  // out for the activities that import it), each activity behind the zones and that shared chunk
  const partC = ['marshmallow.ts', 'heave.ts', 'crests.ts', 'CrestSnap.tsx', 'sealions.ts', 'SeaLionBadges.tsx', 'frisbee.ts', 'ball.ts', 'sled.ts', 'crooked.ts'];
  const propsEntry = path.join(dir, 'toyMesh.ts');
  const propsShared = new Set([...closure(propsEntry), ...closure(path.join(dir, 'sounds3.ts')), ...closure(path.join(dir, 'partc.ts'))]);
  for (const f of propsShared) {
    const bytes = await size(f, zonesShared);
    assert.ok(bytes <= 5 * 1024, `${path.basename(f)}: ${bytes} B`);
    if (process.env.OPUS_PLAY_SIZES) console.log(`${path.basename(f)} ${bytes} B`);
  }
  const zones3 = path.join(dir, 'zones3.ts');
  const z3 = await size(zones3, zonesShared);
  assert.ok(z3 <= 5 * 1024, `zones3.ts: ${z3} B`);
  if (process.env.OPUS_PLAY_SIZES) console.log(`zones3.ts ${z3} B`);
  const partCShared = new Set([...zonesShared, ...closure(zones3), ...propsShared]);
  for (const f of partC) {
    const bytes = await size(path.join(dir, f), partCShared);
    assert.ok(bytes <= 5 * 1024, `${f}: ${bytes} B`);
    if (process.env.OPUS_PLAY_SIZES) console.log(`${f} ${bytes} B`);
  }
  // only dynamic imports reach play/ from outside the folder (w5Features' loader; lane C / E may import play modules lazily)
  const src = path.join(ROOT, 'src/opus-bay');
  const files: string[] = [];
  const list = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) list(p); else if (/\.tsx?$/.test(e.name)) files.push(p); } };
  list(src);
  for (const f of files) {
    if (f.startsWith(dir) || f.includes(`${path.sep}economy${path.sep}`)) continue;
    const text = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(text, /^\s*(?:import|export)\s+(?!type\s)[^;]*?from\s+['"][^'"]*\/play\//m, `${path.relative(src, f)} imports play/ statically`);
  }
});

// --- the activities in node (stub body: lane F's charApi recorded) -------------------------------------------------------

const { runtime } = await import('../src/opus-bay/core/runtime');
const { game } = await import('../src/opus-bay/core/store');
const { emit, onEvent, REWARD_SOURCE } = await import('../src/opus-bay/core/events');
const charApiMod = await import('../src/opus-bay/actors/charApi');
const moveApi = await import('../src/opus-bay/actors/moveApi');
const { lockHeld, lockReport } = await import('../src/opus-bay/game/playerLock');
const { cinemaActive, cinemaKind, skipCinema, stepCinema } = await import('../src/opus-bay/game/cinema');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { setInteractables, interactables } = await import('../src/opus-bay/game/interactables');
const { flow } = await import('../src/opus-bay/game/flowStore');
const slots = await import('../src/opus-bay/ui/slots');
const kit = await import('../src/opus-bay/play/kit');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const { mock } = await import('node:test');

type Ev = import('../src/opus-bay/core/events').GameEvent;
function record() { const events: Ev[] = []; const off = onEvent(e => { events.push(e); }); return { events, off }; }
function stubBody() {
  const calls: string[] = [];
  charApiMod.setCharApi({
    emote: (who, name) => { calls.push(`${who}:${name}`); },
    sitGround: pose => { calls.push(`sit:${pose.heading.toFixed(2)}`); return true; },
    stand: () => { calls.push('stand'); },
    attach: () => undefined, tint: () => undefined, vehiclePaint: () => undefined,
    glideSoftBox: (key, box) => { calls.push(`box:${key}:${box ? 'on' : 'off'}`); },
  });
  return calls;
}
function playing() {
  game.set({ phase: 'playing', mode: 'free', photoMode: false, dialogue: { nodeId: null } });
  runtime.move.mode = 'foot';
  runtime.player.locked = false;
  runtime.player.moving = false;
  runtime.player.speed = 0;
  runtime.player.grounded = true;
}
const PLAZA = DISTRICT.anchors['ferry-gate'];

test('W5-A2 emotes: wave (the event the crowd answers), dance with BAYBAY, lie only on grass, the selfie two-shot into photo mode', async () => {
  const emotes = await import('../src/opus-bay/play/emotes');
  playing();
  runtime.player.x = PLAZA.x; runtime.player.z = PLAZA.z; runtime.player.heading = 0;
  const { events, off } = record();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    // without lane F's body: the wave still works (the actors play it from the event), dance and lie wait
    charApiMod.setCharApi(null);
    assert.equal(emotes.doEmote('dance'), false);
    assert.equal(emotes.doEmote('lie'), false);
    assert.equal(emotes.doEmote('wave'), true);
    assert.ok(events.some(e => e.type === 'emote' && e.who === 'player' && e.emote === 'wave'));
    mock.timers.tick(600);
    assert.ok(events.some(e => e.type === 'emote' && e.who === 'baybay' && e.emote === 'wave'), 'BAYBAY waves back');
    const calls = stubBody();
    assert.equal(emotes.doEmote('dance'), true);
    assert.deepEqual(calls.splice(0), ['player:dance', 'baybay:dance']);
    // the plaza is no lawn: she suggests grass and nothing lies down
    assert.equal(emotes.doEmote('lie'), false);
    assert.deepEqual(calls, []);
    assert.equal(flow.get().bubble?.text.zh, '找块草地再躺吧～');
    // the selfie: the feet held for the camera swing, then photo mode with both posing; the distance comes back after
    runtime.camera.distance = 15;
    // BAYBAY still walking to your side: the shutter waits for her (at most 2.5 s)
    runtime.guide.arrived = false;
    runtime.guide.x = runtime.player.x + 6; runtime.guide.z = runtime.player.z;
    emotes.selfie();
    assert.ok(lockReport().some(h => h.source === 'activity' && h.key === 'selfie'));
    assert.equal(runtime.camera.distance, emotes.SELFIE_DISTANCE);
    mock.timers.tick(950);
    assert.ok(lockHeld(), 'waiting for her');
    assert.equal(game.get().photoMode, false);
    runtime.guide.arrived = true; runtime.guide.x = runtime.player.x + 2;
    mock.timers.tick(160);
    assert.equal(lockHeld(), false);
    assert.equal(game.get().photoMode, true);
    assert.deepEqual(calls.splice(0), ['player:pose', 'baybay:pose']);
    game.set({ photoMode: false });
    assert.equal(runtime.camera.distance, 15);
    // nothing runs mid-dialogue or while riding
    game.set({ dialogue: { nodeId: 'x' } });
    assert.equal(emotes.doEmote('wave'), false);
    game.set({ dialogue: { nodeId: null } });
    runtime.move.mode = 'bike';
    assert.equal(emotes.doEmote('dance'), false);
    assert.deepEqual(emotes.WHEEL.map(s => `${s.key}:${s.label.zh}`), ['1:挥手', '2:跳舞', '3:躺草地', '4:自拍']);
  } finally { mock.timers.reset(); off(); charApiMod.setCharApi(null); emotes.clearEmoteTimers(); playing(); }
});

test('W5-A3 pet BAYBAY: in reach only, hearts + a line, her own line when petted a lot; the shoreline float needs water near and quiet', async () => {
  const pet = await import('../src/opus-bay/play/pet');
  playing();
  const calls = stubBody();
  try {
    runtime.player.x = 0; runtime.player.z = 0;
    runtime.guide.x = 10; runtime.guide.z = 0;
    assert.equal(pet.petAllowed(), false);
    assert.equal(pet.pet(0), false);
    runtime.guide.x = 2;
    assert.equal(pet.pet(1), true);
    assert.deepEqual(calls.splice(0), ['baybay:pet', 'player:pet']);
    assert.ok(Math.abs(runtime.player.heading - Math.PI / 2) < 1e-9, 'the player turns to her');
    assert.equal(flow.get().bubble?.text.zh, pet.PET_LINES[0].zh);
    pet.pet(2); pet.pet(3); pet.pet(4);
    assert.equal(flow.get().bubble?.text.zh, pet.PET_SPAM_LINE.zh, 'the fourth pet in 12 s');
    for (const l of [...pet.PET_LINES, pet.PET_SPAM_LINE, pet.FLOAT_LINE]) assert.ok(width(l.zh) <= 45, l.zh);
    // water near: any of 16 samples on two rings
    assert.equal(pet.waterNear(0, 0, 10, () => false), false);
    assert.equal(pet.waterNear(0, 0, 10, (x, z) => x > 9 && Math.abs(z) < 1), true);
    // the float watcher: still for FLOAT_IDLE s, a coin flip, water by her
    runtime.guide.x = PLAZA.x; runtime.guide.z = PLAZA.z - 60;
    const off = pet.startFloatWatch(() => 0);
    try {
      for (let i = 0; i < 12; i++) stepFrameSystems(1, 1000 * (i + 1));
      assert.equal(calls.includes('baybay:float'), pet.waterNear(runtime.guide.x, runtime.guide.z), 'floats exactly when water is near');
    } finally { off(); }
  } finally { charApiMod.setCharApi(null); playing(); }
});

test('W5-A4 sit: 坐下 offered only to a still player on a sittable surface with nothing else in reach; moving stands up at no cost', async () => {
  const index = await import('../src/opus-bay/play/index');
  const sit = await import('../src/opus-bay/play/sit');
  playing();
  const base = interactables();
  runtime.player.x = PLAZA.x; runtime.player.z = PLAZA.z;
  const { events, off } = record();
  try {
    charApiMod.setCharApi(null);
    assert.equal(index.sitOffer(5), false, 'no body to sit with yet');
    const calls = stubBody();
    assert.equal(index.sitOffer(0.5), false, 'not still long enough');
    assert.equal(index.sitOffer(5), true);
    // a card in reach wins; BAYBAY at your side does not count
    setInteractables([{ id: 'test-card', source: 'poi', action: 'info', verb: { zh: '看', en: 'Look' }, name: { zh: '卡', en: 'Card' }, x: PLAZA.x + 1, z: PLAZA.z, radius: 2 }]);
    assert.equal(index.sitOffer(5), false);
    setInteractables([{ id: 'baybay', source: 'baybay', action: 'talk', verb: { zh: '聊', en: 'Talk' }, name: { zh: 'B', en: 'B' }, x: PLAZA.x + 1, z: PLAZA.z, radius: 2.4 }]);
    assert.equal(index.sitOffer(5), true);
    // sit, then push the stick: stand up, `play` cancel, nothing paid
    runtime.player.heading = 1;
    assert.equal(sit.sitHere(), true);
    assert.deepEqual(calls.splice(0), ['sit:1.00']);
    assert.ok(sit.seated());
    stepFrameSystems(0.5, 0);
    runtime.input.moveY = 1;
    stepFrameSystems(0.1, 0);
    runtime.input.moveY = 0;
    assert.equal(sit.seated(), null);
    assert.deepEqual(calls, ['stand']);
    assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && `${e.activity}:${e.what}`), ['sit:start', 'sit:cancel']);
    assert.equal(events.filter(e => e.type === 'reward').length, 0);
  } finally { off(); setInteractables(base); sit.resetSit(); charApiMod.setCharApi(null); runtime.input.moveY = 0; playing(); }
});

test('W5-A4 view spot: seated 5 s, then the 20 s slow look (a cinematic); the first time pays view:<id> and finds it; skipping keeps it', async () => {
  const sit = await import('../src/opus-bay/play/sit');
  playing();
  const spot = views.viewSpotById('twin-peaks')!;
  runtime.player.x = spot.x; runtime.player.z = spot.z;
  const { events, off } = record();
  try {
    // no body yet: the spot still works standing, facing the view
    charApiMod.setCharApi(null);
    assert.equal(sit.sitAtSpot(spot), true);
    assert.ok(Math.abs(runtime.player.heading - views.viewHeading(spot)) < 1e-9);
    for (let i = 0; i < 4; i++) stepFrameSystems(1, 0);
    assert.equal(cinemaActive(), false, 'not before 5 s');
    stepFrameSystems(1.1, 0);
    assert.equal(cinemaKind(), 'viewpoint');
    assert.ok(lockReport().some(h => h.source === 'cinema'));
    const shots = sit.lookShots(0, 0, 0, 0, spot);
    const total = shots.reduce((s, x) => s + x.duration + (x.hold ?? 0), 0);
    assert.ok(Math.abs(total - views.VIEW_LOOK_SECONDS) < 1e-9, `${total} s`);
    assert.deepEqual(events.filter(e => e.type === 'find'), [{ type: 'find', kind: 'view', id: 'twin-peaks', first: true }]);
    const rewards = events.filter(e => e.type === 'reward');
    assert.deepEqual(rewards, [{ type: 'reward', source: 'view:twin-peaks', coins: 5, stamp: 'view:twin-peaks' }]);
    assert.match((rewards[0] as { source: string }).source, REWARD_SOURCE);
    skipCinema();
    assert.equal(lockHeld(), false);
    stepCinema(0.1);
    // stand up and sit again: the look plays again, never pays again
    sit.standUp();
    events.length = 0;
    sit.sitAtSpot(spot);
    for (let i = 0; i < 6; i++) stepFrameSystems(1, 0);
    assert.deepEqual(events.filter(e => e.type === 'find'), [{ type: 'find', kind: 'view', id: 'twin-peaks', first: false }]);
    assert.equal(events.filter(e => e.type === 'reward').length, 0);
    skipCinema();
  } finally { off(); sit.resetSit(); playing(); }
});

test('W5-A5 first flight run: rings pay once each in any order, a missed ring stays missed, the card counts them; 跳过 costs nothing', async () => {
  playing();
  const calls = stubBody();
  moveApi.setGlideUnlocked(true);
  kit.__resetKit();
  kit.__setBestWriter(null);
  const coit = flight.COIT_COURSE[0];
  runtime.player.x = coit.x - 20; runtime.player.z = coit.z + 5;
  const { events, off } = record();
  try {
    assert.equal(flight.startFirstFlight(), true);
    assert.equal(flight.startFirstFlight(), false, 'one at a time');
    let s = flight.flightState()!;
    assert.equal(s.phase, 'intro');
    assert.equal(s.course, 'coit');
    assert.ok(slots.openOverlays().some(o => o.id === flight.CHIP_OVERLAY), 'the chip is up');
    assert.ok(!calls.some(c => c.startsWith('box:')), 'no soft box (lane F soft boxes are places the pelican is turned away from)');
    // take off (G): flying
    runtime.move.mode = 'glide';
    runtime.glide.active = true;
    emit({ type: 'glide:start' });
    s = flight.flightState()!;
    assert.equal(s.phase, 'flying');
    for (const i of [0, 1, 3, 4, 5, 6, 7]) {
      const r = s.rings[i];
      runtime.glide.x = r.x + 3; runtime.glide.z = r.z; runtime.glide.y = r.y - 2;
      flight.step(1 / 30);
    }
    assert.equal(s.got, 7);
    assert.equal(s.rings[2].missed, true);
    const paid = events.filter(e => e.type === 'reward').map(e => e.type === 'reward' && `${e.source}:${e.coins}`);
    assert.deepEqual(paid.filter(p => String(p).startsWith('ring:')), [1, 2, 4, 5, 6, 7, 8].map(n => `ring:first-flight:${n}:3`));
    // the last ring ends it at once: the card (7 of 8 → 很好), the medals up to tier 2, the best; a landing after changes nothing
    assert.equal(flight.flightState(), null);
    emit({ type: 'glide:land', x: 0, z: 0 });
    const card = kit.lastResultShown()!;
    assert.equal(card.tier, 2);
    assert.deepEqual(card.detail, { zh: '穿过 7 / 8 个金圈', en: '7 of 8 rings' });
    assert.ok(!slots.openOverlays().some(o => o.id === flight.CHIP_OVERLAY), 'the chip went');
    assert.deepEqual(events.filter(e => e.type === 'reward' && e.source.startsWith('medal:')).map(e => e.type === 'reward' && e.source), ['medal:first-flight:1', 'medal:first-flight:2']);
    assert.equal(kit.bestOf('first-flight'), 7);
    // 跳过: nothing paid, no card, the run cancelled
    runtime.move.mode = 'foot'; runtime.glide.active = false;
    events.length = 0;
    assert.equal(flight.startFirstFlight(), true);
    flight.skipFirstFlight();
    assert.equal(flight.flightState(), null);
    assert.equal(kit.lastResultShown(), card);
    assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && e.what), ['start', 'cancel']);
    assert.equal(events.filter(e => e.type === 'reward').length, 0);
    // far from Coit the course is laid ahead of the player; walking off during the intro ends it quietly
    await cityAround([{ x: 126, z: 938 }], 300);
    try {
      runtime.player.x = 126; runtime.player.z = 938;
      assert.equal(flight.startFirstFlight(), true);
      assert.equal(flight.flightState()!.course, 'local');
      assert.equal(flight.flightState()!.rings.length, 8);
      runtime.player.x += 60;
      flight.step(0.1);
      assert.equal(flight.flightState(), null);
    } finally { T.setCityTerrain(null); }
    // not before the pelican is unlocked
    moveApi.setGlideUnlocked(false);
    assert.equal(flight.startFirstFlight(), false);
  } finally { off(); flight.skipFirstFlight(); charApiMod.setCharApi(null); runtime.move.mode = 'foot'; runtime.glide.active = false; kit.unregisterResultOverlay(); kit.__resetKit(); playing(); }
});

test('W5-A2 / A3 init: 做个动作 and 摸摸 BAYBAY on top of 问 BAYBAY, tapping yourself opens the wheel, a double tap on BAYBAY pets her', async () => {
  const index = await import('../src/opus-bay/play/index');
  const flowMod = await import('../src/opus-bay/game/flow');
  playing();
  const off = index.init();
  const calls = stubBody();
  try {
    assert.equal(typeof index.startFirstFlight, 'function', 'the live export lane C calls');
    flowMod.openCallMenu();
    const menu = flowMod.nodeById(game.get().dialogue.nodeId)!;
    assert.deepEqual(menu.choices!.slice(0, 2).map(c => c.label.zh), ['做个动作', '摸摸 BAYBAY']);
    flowMod.closeDialogue();
    // lane F's self-tap: your own character toggles the wheel
    emit({ type: 'self-tap', who: 'player', double: false });
    assert.ok(slots.openOverlays().some(o => o.id === 'play-emotes'));
    emit({ type: 'self-tap', who: 'player', double: false });
    assert.ok(!slots.openOverlays().some(o => o.id === 'play-emotes'));
    // not while riding
    runtime.move.mode = 'bike';
    assert.equal(index.openWheel(), false);
    runtime.move.mode = 'foot';
    // a double tap on BAYBAY in reach pets her (the pet chunk loads first)
    runtime.player.x = 0; runtime.player.z = 0; runtime.guide.x = 1.5; runtime.guide.z = 0;
    emit({ type: 'self-tap', who: 'baybay', double: true });
    for (let i = 0; i < 50 && !calls.includes('baybay:pet'); i++) await new Promise(r => setTimeout(r, 10));
    assert.ok(calls.includes('baybay:pet'));
    // the prompts: 坐下 and the 16 view spots are interactables (activity / find: their act() runs)
    const ids = index.viewIts.map(it => it.id);
    assert.equal(ids.length, 16);
    assert.ok(index.viewIts.every(it => it.source === 'find' && it.verb.zh === '坐下看风景' && typeof it.act === 'function'));
    assert.equal(index.sitHereIt.source, 'activity');
  } finally { off(); charApiMod.setCharApi(null); playing(); }
  assert.equal(index.startFirstFlight, undefined, 'teardown takes the export back');
  flowMod.openCallMenu();
  assert.ok(!flowMod.nodeById(game.get().dialogue.nodeId)!.choices!.some(c => c.action?.type === 'ask'));
  flowMod.closeDialogue();
});

// --- part b: the Seward slides (W5-A6), the bell riff and the lean-out (W5-A7), the stair races (W5-A8) ----------------

const { __setBayNowForTests, parseBayDate } = await import('../src/opus-bay/game/bayNow');
const { input } = await import('../src/opus-bay/core/input');
const THREE = await import('three');

test('W5-A6 slides: the chutes, sitting loses to BAYBAY and lying back beats her, the medals, the real hours (Tue–Sun 10–17, before sunset)', async () => {
  const slides = await import('../src/opus-bay/play/slides');
  const zones = await import('../src/opus-bay/play/zones');
  const { sunDay } = await import('../src/opus-bay/game/qa');
  const F = slides.SLIDE_PHYS;
  for (const c of [slides.PLAYER_CHUTE, slides.BAYBAY_CHUTE]) {
    const p = slides.chutePath(c, () => 20.7);
    assert.ok(p.bottom > 7 && p.bottom < 10 && p.len > p.bottom, `${c.id}: ${p.bottom.toFixed(2)} of ${p.len.toFixed(2)} u`);
    const mid = slides.pointAt(p, p.bottom * 0.6);
    assert.ok(mid.pitch > 0.2 && mid.pitch < 0.6, `${c.id}: nose down ${mid.pitch.toFixed(2)} rad in the chute`);
    assert.ok(Math.abs(c.heading - Math.PI) < 0.01, 'downhill toward Seward Street');
  }
  const P = slides.chutePath(slides.PLAYER_CHUTE, () => 20.7), B = slides.chutePath(slides.BAYBAY_CHUTE, () => 20.7);
  const sit = slides.slideTime(P, () => F.accel), tuck = slides.slideTime(P, () => F.accel + F.tuck);
  const bayLo = slides.slideTime(B, () => F.baybay * 0.97), bayHi = slides.slideTime(B, () => F.baybay * 1.03);
  assert.ok(sit > bayLo + 0.3, `sitting ${sit.toFixed(2)} s loses to BAYBAY ${bayLo.toFixed(2)}–${bayHi.toFixed(2)} s`);
  assert.ok(tuck < bayHi - 0.3, `lying back all the way ${tuck.toFixed(2)} s wins`);
  assert.ok(sit > 2.8 && sit < 4 && tuck > 2 && tuck < 3, 'a ride is a few seconds');
  assert.equal(slides.slideTier(sit, bayLo, tuck), 1);
  assert.equal(slides.slideTier(tuck, bayLo, tuck), 3);
  assert.equal(slides.slideTier(tuck + slides.GOLD_MARGIN + 0.05, bayHi, tuck), 2);
  assert.equal(slides.slideTier(Infinity, bayLo, tuck), 0);
  // sfrecpark.org (2026-09-28): Tuesday to Sunday 10–5, the park closes at sunset (Bay time)
  const at = (spec: string) => zones.slidesOpen(parseBayDate(spec)!);
  assert.equal(at('2026-09-29T11:00'), true, 'Tuesday morning');
  assert.equal(at('2026-09-28T11:00'), false, 'Monday');
  assert.equal(at('2026-09-29T09:59'), false);
  assert.equal(at('2026-09-29T17:00'), false);
  assert.equal(at('2026-10-04T16:59'), true, 'a Sunday afternoon');
  const dec = parseBayDate('2026-12-06T16:55')!;
  assert.equal(zones.slidesOpen(dec), dec.getTime() < sunDay('2026-12-06').sunset, 'December: sunset first');
  assert.equal(zones.slidesOpen(dec), false);
  for (const line of Object.values(slides.SLIDE_LINES)) assert.ok([...line.zh].length <= 45 && line.en.length > 0);
});

test('W5-A6 slides ride: holds the feet, both hop onto the chutes, 3 · 2 · 1 · 冲！, lying back wins, the card, both on the run-outs; 不滑了 costs nothing', async () => {
  const slides = await import('../src/opus-bay/play/slides');
  const zones = await import('../src/opus-bay/play/zones');
  const chip = await import('../src/opus-bay/play/chip');
  const puppet = await import('../src/opus-bay/play/puppet');
  playing();
  const calls = stubBody();
  kit.__resetKit();
  kit.__setBestWriter(null);
  slides.__resetSlides();
  const s0 = slides.PLAYER_CHUTE.start;
  const toDeck = () => { runtime.player.x = s0.x; runtime.player.z = s0.z + 0.3; runtime.player.heading = 0; runtime.guide.x = s0.x + 1; runtime.guide.z = s0.z + 1.5; };
  toDeck();
  const { events, off } = record();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    // closed on a Monday: BAYBAY says when, nothing starts
    __setBayNowForTests('2026-09-28T11:00');
    assert.equal(slides.startSlides(), false);
    assert.deepEqual(flow.get().bubble?.text, zones.SLIDES_CLOSED_LINE);
    __setBayNowForTests('2026-09-29T11:00');
    assert.equal(slides.startSlides(), true);
    assert.equal(slides.startSlides(), false, 'one ride at a time');
    assert.ok(lockReport().some(h => h.source === 'activity' && h.key === 'slides'), 'the feet are held');
    assert.equal(chip.chipState()?.id, 'slides');
    assert.ok(runtime.camera.shot, 'the camera takes the deck');
    assert.equal(zones.slidesIt.radius, 0, 'no prompt under the ride');
    assert.deepEqual(calls.splice(0), ['player:sit', 'baybay:sit']);
    const bigs: string[] = [];
    let n = 0;
    while (slides.slideState()?.phase !== 'slide' && n++ < 200) {
      stepFrameSystems(1 / 30, 0);
      const b = chip.chipState()?.big;
      if (b && bigs[bigs.length - 1] !== b) bigs.push(b);
    }
    assert.deepEqual(bigs, ['3', '2', '1', '冲！']);
    assert.ok(puppet.puppetPose('player') && puppet.puppetPose('baybay'), 'both bodies drawn on the chutes');
    // lie back (Space / pad B / 跳) all the way down
    input.jumpHeld = true;
    for (n = 0; slides.slideState() && n < 400; n++) stepFrameSystems(1 / 60, 0);
    input.jumpHeld = false;
    assert.equal(slides.slideState(), null);
    const card = kit.lastResultShown()!;
    assert.equal(card.activity, 'slides');
    assert.equal(card.tier, 3);
    assert.match(card.detail!.zh, /^你 2\.\d 秒 · BAYBAY \d\.\d 秒$/);
    assert.deepEqual(events.filter(e => e.type === 'reward').map(e => e.type === 'reward' && e.source), ['medal:slides:1', 'medal:slides:2', 'medal:slides:3']);
    assert.ok(calls.includes('player:lie'), 'lying back');
    assert.equal(lockHeld(), false);
    assert.ok(Math.abs(runtime.player.x - slides.PLAYER_CHUTE.runout.x) < 1e-6 && Math.abs(runtime.player.z - slides.PLAYER_CHUTE.runout.z) < 1e-6, 'on the run-out');
    assert.equal(puppet.puppetPose('player'), null);
    assert.equal(runtime.camera.shot, null);
    assert.equal(chip.chipState(), null);
    assert.equal(zones.slidesIt.radius, zones.SLIDES_PROMPT_R);
    assert.ok(kit.bestOf('slides')! < 2.8);
    // sitting all the way: BAYBAY wins (● 好), the best stays
    toDeck();
    events.length = 0;
    assert.equal(slides.startSlides(), true);
    for (n = 0; slides.slideState() && n < 600; n++) stepFrameSystems(1 / 60, 0);
    assert.equal(kit.lastResultShown()!.tier, 1);
    assert.equal(events.filter(e => e.type === 'reward').length, 0, 'tier 1 was paid already');
    // 不滑了 before 冲！: nothing paid, no card, the feet still on the deck, all let go
    toDeck();
    events.length = 0;
    const before = kit.lastResultShown();
    assert.equal(slides.startSlides(), true);
    for (let i = 0; i < 20; i++) stepFrameSystems(1 / 30, 0);
    chip.chipState()!.action!.run();
    assert.equal(slides.slideState(), null);
    assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && e.what), ['start', 'cancel']);
    assert.equal(kit.lastResultShown(), before);
    assert.ok(Math.abs(runtime.player.x - s0.x) < 1e-6, 'never left the deck');
    assert.equal(lockHeld(), false);
    assert.equal(puppet.puppetPose('baybay'), null);
  } finally { mock.timers.reset(); off(); input.jumpHeld = false; slides.__resetSlides(); __setBayNowForTests(null); charApiMod.setCharApi(null); kit.unregisterResultOverlay(); kit.__resetKit(); playing(); }
});

test('W5-A7 bell riff: three call-and-response rounds judged on the audio clock with the learnt offset, a swung freestyle, never failed; hopping off costs nothing', async () => {
  const bell = await import('../src/opus-bay/play/bell');
  const { RIFF_BEAT, RIFF_BAR, GROOVE_SECONDS } = await import('../src/opus-bay/play/sounds2');
  playing();
  kit.__resetKit();
  kit.__setBestWriter(null);
  bell.__resetBell();
  const ride = () => { game.set({ move: { mode: 'transit', line: 'powell-hyde', spot: 'rail' } }); flow.set({ ride: { stage: 'riding', from: 'powell-market', to: 'hyde-beach', line: 'powell-hyde', kind: 'cable-car' } }); };
  let now = 100;
  const clock = () => now;
  const { events, off } = record();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    // only on a cable car under way
    assert.equal(bell.startRiff(clock), false);
    flow.set({ ride: { stage: 'waiting', from: 'a', to: 'b', line: 'powell-hyde', kind: 'cable-car' } });
    game.set({ move: { mode: 'transit', line: 'powell-hyde', spot: 'rail' } });
    assert.equal(bell.startRiff(clock), false, 'not at the stop');
    ride();
    assert.equal(bell.startRiff(clock), true);
    assert.equal(bell.riffState()!.phase, 'call');
    // a tap during the gripman's bar rings and scores nothing
    now += 0.4; bell.tapBell(now);
    assert.equal(bell.riffState()!.hits, 0);
    // a player 0.2 s late all through (Bluetooth, a thumb): the offset is learnt from the first taps, every answer hits
    const LATE = 0.2, round = RIFF_BAR * 2 * RIFF_BEAT;
    for (let r = 0; r < bell.ROUNDS; r++) {
      const t0 = bell.riffState()!.t0;
      assert.equal(bell.riffState()!.round, r);
      for (const a of bell.answerTimes(r)) { now = t0 + a + LATE; bell.stepRiff(now); assert.equal(bell.riffState()!.phase, 'answer'); bell.tapBell(now); }
      now = t0 + round; bell.stepRiff(now);
    }
    assert.equal(bell.riffState()!.hits, bell.MAX_HITS);
    assert.equal(bell.riffState()!.phase, 'free');
    // the freestyle: on the beat or its swung "and" is jazzy; a third of a beat in is not; one per slot
    const tf = bell.riffState()!.t0;
    for (let k = 1; k <= 8; k++) { now = tf + k * RIFF_BEAT + LATE; bell.tapBell(now); }
    now = tf + 9 * RIFF_BEAT + (2 / 3) * RIFF_BEAT + LATE; bell.tapBell(now);
    now = tf + 10 * RIFF_BEAT + RIFF_BEAT / 3 + LATE; bell.tapBell(now);
    now = tf + 10 * RIFF_BEAT + RIFF_BEAT / 3 + LATE + 0.01; bell.tapBell(now);
    assert.equal(bell.riffState()!.jazzSlots.size, 9);
    now = tf + GROOVE_SECONDS; bell.stepRiff(now);
    assert.equal(bell.riffState(), null);
    const card = kit.lastResultShown()!;
    assert.equal(card.activity, 'bell');
    assert.equal(card.tier, 3, '12 + 9 = 21 ≥ 18');
    assert.equal(card.detail!.zh, '21 分：对上 12/12 · 即兴 9 下 · 爵士大师');
    assert.deepEqual(events.filter(e => e.type === 'reward').map(e => e.type === 'reward' && e.source), ['medal:bell:1', 'medal:bell:2', 'medal:bell:3']);
    assert.equal(kit.bestOf('bell'), 21);
    // hopping off mid-riff: nothing paid, no card
    events.length = 0;
    assert.equal(bell.startRiff(clock), true);
    flow.set({ ride: null });
    bell.stepRiff(now + 1);
    assert.equal(bell.riffState(), null);
    assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && e.what), ['start', 'cancel']);
    assert.equal(kit.lastResultShown(), card);
    // never failed: finishing is at least ● 好
    assert.equal(bell.riffScore(0, 0).tier, 1);
    assert.equal(bell.riffScore(10, 0).tier, 2);
    assert.equal(bell.riffScore(12, 6).tier, 3);
    assert.equal(bell.riffScore(40, 40).score, bell.MAX_HITS + bell.MAX_JAZZ);
    for (const line of [...Object.values(bell.BELL_LINES), ...bell.JAZZ_WORDS]) assert.ok([...line.zh].length <= 45);
  } finally { mock.timers.reset(); off(); bell.__resetBell(); flow.set({ ride: null }); game.set({ move: { mode: 'foot' } }); kit.unregisterResultOverlay(); kit.__resetKit(); playing(); }
});

test('W5-A7 lean-out: held on the running board the rider leans out over the street, the camera outside ahead of the car, the shutter once; off the board nothing', async () => {
  const bell = await import('../src/opus-bay/play/bell');
  const P = await import('../src/opus-bay/actors/platform');
  const { rideCamInfo } = await import('../src/opus-bay/actors/cameraModes');
  playing();
  bell.__resetBell();
  const spot = { x: 0, z: 0, heading: 0 };
  P.definePlatform('qa-cable', { floor: 0.4, deck: { minX: -0.8, maxX: 0.8, minZ: -3, maxZ: 3 }, rail: spot, seatLeft: spot, seatRight: spot, seatY: 0.4, railMirror: true, hangLean: 0.2, kind: 'cable-car' });
  P.setPlatformPose('qa-cable', { x: 10, y: 5, z: 20, heading: 0, roll: 0 }, 1 / 60);
  P.rider.platform = 'qa-cable'; P.rider.x = 1.1; P.rider.z = 0;
  rideCamInfo.side = 1;
  game.set({ move: { mode: 'transit', line: 'qa-cable', spot: 'rail' } });
  flow.set({ ride: { stage: 'riding', from: 'a', to: 'b', line: 'qa-cable', kind: 'cable-car' } });
  const scene = new THREE.Scene(), body = new THREE.Object3D();
  body.name = 'opus-player';
  scene.add(body);
  const { events, off } = record();
  try {
    assert.equal(bell.onRunningBoard(), true);
    bell.setLean(true, 'caption');
    for (let i = 0; i < 90; i++) { body.quaternion.identity(); P.setPlatformPose('qa-cable', { x: 10, y: 5, z: 20 + i * 0.05, heading: 0, roll: 0 }, 1 / 60); bell.stepLean(1 / 60, scene, null, 0.46); }
    // heading 0: the car's left (the ride camera's side +1) is world +x; the head goes out that way
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(body.quaternion);
    assert.ok(up.x > 0 && Math.abs(Math.acos(up.y) - bell.LEAN_EXTRA) < 1e-3, `leaning out ${(Math.acos(up.y) * 180 / Math.PI).toFixed(1)}°`);
    const shot = runtime.camera.shot!;
    assert.ok(shot && shot.position[0] > 10.5 && shot.position[2] > 20 + 89 * 0.05, 'outside the car on the rider\'s side, ahead of it');
    assert.equal(events.filter(e => e.type === 'shutter').length, 1, 'the shutter once per hold');
    bell.setLean(false);
    bell.stepLean(1 / 60, scene, null);
    assert.equal(runtime.camera.shot, null, 'the camera goes back');
    for (let i = 0; i < 30; i++) bell.stepLean(1 / 60, scene, null);
    assert.equal(bell.leanState().k, 0);
    // seated, or not on a cable car: 探出身 does nothing
    game.set({ move: { mode: 'transit', line: 'qa-cable', spot: 'seat' } });
    bell.setLean(true);
    assert.equal(bell.leanState().on, false);
  } finally { off(); bell.__resetBell(); P.platforms.delete('qa-cable'); P.rider.platform = null; runtime.camera.shot = null; flow.set({ ride: null }); game.set({ move: { mode: 'foot' } }); playing(); }
});

test('W5-A8 stair courses on the published city: standable, each leg a walk, the foot and the top open, par and BAYBAY\'s time, the step count', async () => {
  const stairs = await import('../src/opus-bay/play/stairs');
  const SC = await import('../src/opus-bay/play/stairCourses');
  const N = await import('../src/opus-bay/actors/nav');
  assert.deepEqual(SC.STAIR_COURSES.map(c => c.id), ['filbert', 'tiled']);
  await cityAround(SC.STAIR_COURSES.flatMap(c => [SC.courseFoot(c), SC.courseTop(c)]), 80);
  try {
    for (const c of SC.STAIR_COURSES) {
      const line = stairs.courseLine(c);
      for (let s = 0; s <= line.len; s += 0.5) { const p = stairs.linePoint(line, s); assert.ok(T.canStand(p.x, p.z, 0.3), `${c.id}: standable at ${s.toFixed(1)} u (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`); }
      for (let i = 1; i < line.pts.length; i++) {
        const a = line.pts[i - 1], b = line.pts[i];
        N.setNavFocus(a);
        const r = N.findPath(a, b, 3);
        assert.ok(r, `${c.id}: leg ${i} walks`);
        const walked = N.pathLength(a, r.points);
        assert.ok(walked <= dist(a, b) * 1.5 + 2, `${c.id}: leg ${i} ${walked.toFixed(1)} u for ${dist(a, b).toFixed(1)}`);
      }
      for (const p of [SC.courseFoot(c), SC.courseTop(c)]) assert.ok(T.canStand(p.x, p.z, 0.45), `${c.id}: open at (${p.x}, ${p.z})`);
      const rise = T.heightAt(SC.courseTop(c).x, SC.courseTop(c).z) - T.heightAt(SC.courseFoot(c).x, SC.courseFoot(c).z);
      assert.ok(rise > 8, `${c.id}: climbs ${rise.toFixed(1)} u`);
      // par to the finish circle; BAYBAY's time and the gold time after it
      const ideal = stairs.idealRun(line);
      const [lo, hi] = c.id === 'filbert' ? [9, 12] : [3.5, 5.5];
      assert.ok(ideal.par > lo && ideal.par < hi, `${c.id}: par ${ideal.par.toFixed(2)} s`);
      const bt = stairs.baybayTime(ideal.par), gold = ideal.par * stairs.GOLD_PACE + stairs.GOLD_START;
      assert.ok(gold < bt - 0.2 && bt - ideal.par > 0.8, `${c.id}: gold ${gold.toFixed(2)} < BAYBAY ${bt.toFixed(2)}`);
      assert.equal(stairs.raceTier(ideal.par + 0.3, bt, ideal.par), 3);
      assert.equal(stairs.raceTier(bt - 0.1, bt, ideal.par), 2);
      assert.equal(stairs.raceTier(bt + 1, bt, ideal.par), 1);
      // her schedule: still before her start, then forward only, at the finish circle on her time, at the top after
      assert.equal(stairs.scheduleAt(ideal, line.len, stairs.BAYBAY_START * 0.9), 0);
      let last = 0;
      for (let t = 0; t < bt + 3; t += 0.1) { const s = stairs.scheduleAt(ideal, line.len, t); assert.ok(s >= last - 1e-9); last = s; }
      assert.ok(Math.abs(stairs.scheduleAt(ideal, line.len, bt) - (line.len - stairs.FINISH_R)) < 0.3);
      assert.equal(last, line.len);
      // the step counter along the course (stairs only, up only): Filbert's toy stairs count ≈ its real 400
      let steps = 0;
      for (let s = 0.25; s <= line.len; s += 0.25) {
        const a = stairs.linePoint(line, s - 0.25), b = stairs.linePoint(line, s), dy = T.heightAt(b.x, b.z) - T.heightAt(a.x, a.z);
        if (dy > 0 && T.surfaceAt(b.x, b.z) === 'stairs') steps += dy * SC.STEPS_PER_U;
      }
      if (c.id === 'filbert') assert.ok(Math.abs(steps - c.steps) < 40, `filbert counts ${steps.toFixed(0)} steps`);
      else assert.ok(steps > 100 && steps < 260, `tiled counts ${steps.toFixed(0)} steps`);
      assert.ok([...c.fact.zh].length <= 45 && c.source.startsWith('https://') && c.verifiedAt === '2026-09-28');
    }
  } finally { T.setCityTerrain(null); }
});

test('W5-A8 stair race: 比赛？ holds the feet for 3 · 2 · 1 · 跑！, runs for you, a dialogue holds the clock, the card with BAYBAY\'s time; 放弃 and wandering off cost nothing', async () => {
  const stairs = await import('../src/opus-bay/play/stairs');
  const SC = await import('../src/opus-bay/play/stairCourses');
  const chip = await import('../src/opus-bay/play/chip');
  const c = SC.stairCourse('tiled')!;
  await cityAround([SC.courseFoot(c), SC.courseTop(c)], 60);
  playing();
  stubBody();
  kit.__resetKit();
  kit.__setBestWriter(null);
  stairs.__resetStairs();
  const line = stairs.courseLine(c);
  const toFoot = () => { const f = SC.courseFoot(c); runtime.player.x = f.x; runtime.player.z = f.z; runtime.player.y = T.heightAt(f.x, f.z); };
  const { events, off } = record();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    toFoot();
    assert.equal(stairs.startStairRace('tiled'), true);
    assert.equal(stairs.startStairRace('tiled'), false, 'one at a time');
    assert.ok(lockReport().some(h => h.source === 'activity' && h.key === 'stairs-tiled'), 'the countdown holds the feet');
    assert.ok(dist(runtime.guide, runtime.player) < 2.5, 'BAYBAY at your side');
    const bigs: string[] = [];
    let n = 0;
    while (stairs.raceState()?.phase === 'ready' && n++ < 200) { stepFrameSystems(1 / 30, 0); const b = chip.chipState()?.big; if (b && bigs[bigs.length - 1] !== b) bigs.push(b); }
    assert.deepEqual(bigs.slice(0, 3), ['3', '2', '1']);
    assert.equal(lockHeld(), false, '跑！ lets go');
    // run up the line at 6 u/s (the walker runs: the race holds Shift for you)
    let s = 0;
    const runTo = (until: number) => { while (s < until && stairs.raceState()) { s += 6 / 30; const p = stairs.linePoint(line, s); runtime.player.x = p.x; runtime.player.z = p.z; runtime.player.y = T.heightAt(p.x, p.z); stepFrameSystems(1 / 30, 0); } };
    runTo(8);
    assert.ok(input.keys.has('ShiftLeft'), 'running');
    assert.equal(chip.chipState()?.status?.zh, '你领先！');
    // a dialogue mid-race: the clock waits
    const clock = stairs.raceState()!.clock;
    game.set({ dialogue: { nodeId: 'flow.call' } });
    for (let i = 0; i < 30; i++) stepFrameSystems(1 / 30, 0);
    assert.equal(stairs.raceState()!.clock, clock);
    game.set({ dialogue: { nodeId: null } });
    runTo(line.len);
    assert.equal(stairs.raceState(), null);
    assert.ok(!input.keys.has('ShiftLeft'));
    const card = kit.lastResultShown()!;
    assert.equal(card.activity, 'stairs-tiled');
    const par = stairs.idealRun(line).par;
    assert.match(card.detail!.zh, new RegExp(`^你 \\d\\.\\d 秒 · BAYBAY ${stairs.baybayTime(par).toFixed(1)} 秒$`));
    assert.ok(card.tier >= 2, `won (${card.detail!.zh})`);
    assert.deepEqual(events.filter(e => e.type === 'reward').map(e => e.type === 'reward' && e.source), ['medal:stairs-tiled:1', 'medal:stairs-tiled:2', ...(card.tier === 3 ? ['medal:stairs-tiled:3'] : [])]);
    assert.ok(kit.bestOf('stairs-tiled')! > 0);
    // 放弃: nothing paid, no card
    toFoot();
    events.length = 0;
    assert.equal(stairs.startStairRace('tiled'), true);
    chip.chipState()!.action!.run();
    assert.equal(stairs.raceState(), null);
    assert.equal(lockHeld(), false);
    assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && e.what), ['start', 'cancel']);
    // wandering off the course ends it too
    assert.equal(stairs.startStairRace('tiled'), true);
    for (let i = 0; i < 100 && stairs.raceState()?.phase === 'ready'; i++) stepFrameSystems(1 / 30, 0);
    runtime.player.z += stairs.STRAY_R + 12;
    stepFrameSystems(1 / 30, 0);
    assert.equal(stairs.raceState(), null);
    assert.equal(events.filter(e => e.type === 'reward').length, 0);
    assert.equal(kit.lastResultShown(), card);
  } finally { mock.timers.reset(); off(); stairs.__resetStairs(); input.keys.delete('ShiftLeft'); T.setCityTerrain(null); charApiMod.setCharApi(null); kit.unregisterResultOverlay(); kit.__resetKit(); playing(); }
});

test('W5-A6–A8 zones: the prompts (滑下去 / 几点开？ by the hours, 比赛？ at each foot), the bell pad on a cable car under way, the chip overlay; the step counter', async () => {
  const zones = await import('../src/opus-bay/play/zones');
  const SC = await import('../src/opus-bay/play/stairCourses');
  const rideSlots = await import('../src/opus-bay/ui/rideSlots');
  const { buildInteractables } = await import('../src/opus-bay/game/interactables');
  playing();
  game.set({ worldMode: 'city' });
  zones.__resetSteps();
  kit.__resetKit();
  const written: Record<string, number> = {};
  kit.__setBestWriter((k, v) => { written[k] = v; });
  mock.timers.enable({ apis: ['setTimeout'] });
  const off = zones.initZones();
  try {
    assert.ok(slots.overlays.get('play-chip'), 'the chip overlay');
    const ids = new Set(buildInteractables().map(it => it.id));
    for (const id of ['play:slides', 'play:stairs:filbert', 'play:stairs:tiled']) assert.ok(ids.has(id), id);
    assert.ok(zones.stairsIts.every(it => it.source === 'activity' && it.verb.zh === '比赛？' && typeof it.act === 'function'));
    for (const c of SC.STAIR_COURSES) assert.ok(dist(zones.stairsIts.find(it => it.id === `play:stairs:${c.id}`)!, SC.courseFoot(c)) < 1e-9);
    // the verb follows the Bay clock
    __setBayNowForTests('2026-09-28T11:00');
    stepFrameSystems(0.3, 0);
    assert.equal(zones.slidesIt.verb.zh, '几点开？');
    __setBayNowForTests('2026-09-29T11:00');
    stepFrameSystems(0.3, 0);
    assert.equal(zones.slidesIt.verb.zh, '滑下去');
    // the bell pad: a cable car under way only
    const pad = rideSlots.ridePads().find(p => p.id === 'bell')!;
    assert.ok(pad);
    assert.equal(pad.visible({ stage: 'riding', from: 'a', to: 'b', kind: 'cable-car' }), true);
    assert.equal(pad.visible({ stage: 'waiting', from: 'a', to: 'b', kind: 'cable-car' }), false);
    assert.equal(pad.visible({ stage: 'riding', from: 'a', to: 'b', kind: 'bus' }), false);
    // the step counter: height gained on stairs only; today's count and the lifetime one; BAYBAY at 100
    flow.set({ bubble: null });
    zones.addStairRise(60 / SC.STEPS_PER_U);
    assert.equal(zones.stepsToday(), 60);
    assert.equal(flow.get().bubble, null);
    zones.addStairRise(45 / SC.STEPS_PER_U);
    assert.equal(zones.stepsToday(), 105);
    assert.equal(zones.stepsTotal(), 105);
    assert.equal(flow.get().bubble?.text.zh, '今天爬了 100 级台阶啦！');
    zones.addStairRise(-3);
    assert.equal(zones.stepsToday(), 105);
    // saved off the stairs (the ledger's play.b through the kit): the count, today's and its Bay day
    runtime.player.x = 1e6; runtime.player.z = 1e6;
    for (let i = 0; i < 12; i++) stepFrameSystems(0.3, 0);
    assert.equal(written.steps, 105);
    assert.equal(written['steps-today'], 105);
    assert.ok(written['steps-day'] > 20000);
    // a new Bay day starts today's count again
    __setBayNowForTests('2026-09-30T08:00');
    assert.equal(zones.stepsToday(), 0);
    assert.equal(zones.stepsTotal(), 105);
  } finally { off(); mock.timers.reset(); __setBayNowForTests(null); zones.__resetSteps(); kit.__setBestWriter(null); kit.__resetKit(); flow.set({ bubble: null }); game.set({ worldMode: 'district' }); playing(); }
  assert.ok(!rideSlots.ridePads().some(p => p.id === 'bell'), 'teardown removes the pad');
});

// --- part c: W5-A9 the should list ----------------------------------------------------------------------------------------

test('W5-A9 marshmallow: the toast (tiers, 金黄度, words, colours), the burning rings and their seats on the published city, the NPS season and hours', async () => {
  const M = await import('../src/opus-bay/play/marshmallow');
  const zones = await import('../src/opus-bay/play/zones3');
  const { oceanBeachFireRings, forceFireRings, resetFireRings } = await import('../src/opus-bay/world/sf/landmarks/ocean-beach-fire-rings');
  const T0 = M.TOAST;
  // the toast: golden in the middle, never failed
  assert.equal(M.toastTier(T0.centre, false), 3);
  assert.equal(M.toastTier(T0.centre + T0.star - 0.001, false), 3);
  assert.equal(M.toastTier(T0.centre + T0.star + 0.01, false), 2);
  assert.equal(M.toastTier(0.52, false), 2);
  assert.equal(M.toastTier(0.3, false), 1);
  assert.equal(M.toastTier(0.9, false), 1);
  assert.equal(M.toastTier(1, true), 1, 'a burnt one is still a marshmallow');
  assert.equal(M.toastScore(T0.centre, false), 100);
  assert.equal(M.toastScore(1, true), 0);
  assert.ok(M.toastScore(0.6, false) > M.toastScore(0.4, false));
  assert.deepEqual([0.1, 0.4, 0.6, 0.9].map(t => M.toastWord(t, false).zh), ['白白的', '微微黄', '金黄', '焦黄']);
  assert.equal(M.toastWord(1, true).zh, '着火啦！');
  // the colour darkens all the way (white to black)
  const lum = (t: number) => { const c = M.toastColor(t); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
  for (let t = 0.1; t <= 1; t += 0.1) assert.ok(lum(t) < lum(t - 0.1) + 1e-9, `darker at ${t.toFixed(1)}`);
  // a marshmallow held in the flame: golden after about 3 s, on fire after 5 s
  assert.ok(T0.lo / T0.rate > 2.4 && T0.lo / T0.rate < 3.2 && T0.burn / T0.rate >= 4.5);
  for (const line of Object.values(M.FIRE_LINES)) assert.ok([...line.zh].length <= 45 && line.en.length > 0, line.zh);
  for (const line of [zones.FIRE_INVITE_LINE, zones.FIRE_SEASON_LINE, zones.FIRE_HOURS_LINE]) assert.ok([...line.zh].length <= 45);
  // the rings that burn: lane L's odd rings (8 of 16), in the site's world frame, 9.6 u apart along the beach
  assert.equal(zones.FIRE_RINGS.length, 8);
  assert.deepEqual(zones.FIRE_RINGS.map(r => r.k), [1, 3, 5, 7, 9, 11, 13, 15]);
  for (let i = 1; i < zones.FIRE_RINGS.length; i++) assert.ok(Math.abs(dist(zones.FIRE_RINGS[i], zones.FIRE_RINGS[i - 1]) - 9.6) < 0.2);
  const c0 = zones.FIRE_RINGS[0], site = oceanBeachFireRings;
  assert.ok(Math.hypot(c0.ix, c0.iz) > 0.999 && Math.abs(c0.ix * c0.ax + c0.iz * c0.az) < 1e-9);
  assert.ok(dist(c0, { x: site.x, z: site.z }) < 40);
  // the NPS program on the Bay clock (realsf/seasons.ts): lit in season 06:00-21:30, cold from November
  try {
    forceFireRings(null);
    const cases: [string, boolean][] = [['2026-10-03T20:00', true], ['2026-10-31T21:29', true], ['2026-10-31T21:30', false], ['2026-10-03T05:59', false], ['2026-11-05T19:00', false], ['2027-03-01T12:00', true]];
    for (const [spec, lit] of cases) {
      __setBayNowForTests(spec); resetFireRings();
      assert.equal(zones.fireLit(), lit, spec);
    }
    __setBayNowForTests('2026-11-05T19:00');
    assert.deepEqual(zones.fireClosedLine(), zones.FIRE_SEASON_LINE);
    __setBayNowForTests('2026-10-03T22:00');
    assert.deepEqual(zones.fireClosedLine(), zones.FIRE_HOURS_LINE);
  } finally { __setBayNowForTests(null); resetFireRings(); }
  // on the published city: both seats on the sand beside each burning ring, the prompts clear of every other prompt
  await cityAround(zones.FIRE_RINGS, 60);
  try {
    const prompts: { id: string; x: number; z: number }[] = [
      ...CITY_POI_PROMPTS,
      ...[...PLACE_CARDS, ...PLACE_CARDS_2].filter(c => c.lat !== undefined && c.lng !== undefined).map(c => ({ id: `card ${c.id}`, ...project(c.lat!, c.lng!) })),
      ...CITY_POSTCARDS.map(c => ({ id: `postcard ${c.id}`, ...c.position })),
      ...views.VIEW_SPOTS.map(v => ({ id: `view ${v.id}`, x: v.x, z: v.z })),
    ];
    for (const r of zones.FIRE_RINGS) {
      const seats = M.fireSeats(r);
      for (const who of ['player', 'baybay'] as const) {
        const p = seats[who];
        assert.ok(T.canStand(p.x, p.z, 0.3), `ring ${r.k}: the ${who} seat is standable`);
        assert.ok(dist(p, r) > 1.1 && dist(p, r) < 2, `ring ${r.k}: ${who} beside the ring`);
        assert.ok(Math.abs(Math.atan2(r.x - p.x, r.z - p.z) - p.heading) < 1e-9, 'facing the fire');
      }
      assert.ok(dist(seats.player, seats.baybay) > 2.5, `ring ${r.k}: BAYBAY across the fire, out of her talk reach`);
      assert.equal(T.surfaceAt(seats.player.x, seats.player.z), 'sand', `ring ${r.k}: on the sand`);
      for (const p of prompts) assert.ok(dist(r, p) >= zones.FIRE_PROMPT_R + 1, `ring ${r.k}: ${dist(r, p).toFixed(1)} u from ${p.id}`);
    }
  } finally { T.setCityTerrain(null); }
});

test('W5-A9 marshmallow round: holds the feet, hold to toast and let go at golden, the burnt one swaps with BAYBAY, the card and the best; closed out of season; 不烤了 and moving cost nothing', async () => {
  const M = await import('../src/opus-bay/play/marshmallow');
  const zones = await import('../src/opus-bay/play/zones3');
  const chip = await import('../src/opus-bay/play/chip');
  const puppet = await import('../src/opus-bay/play/puppet');
  const { resetFireRings } = await import('../src/opus-bay/world/sf/landmarks/ocean-beach-fire-rings');
  playing();
  const calls = stubBody();
  kit.__resetKit();
  kit.__setBestWriter(null);
  M.__resetMarshmallow();
  const r = zones.FIRE_RINGS[3];
  runtime.player.x = r.x + r.ix * 1.8; runtime.player.z = r.z + r.iz * 1.8; runtime.guide.x = r.x + 3; runtime.guide.z = r.z;
  const { events, off } = record();
  mock.timers.enable({ apis: ['setTimeout'] });
  const until = (fn: () => boolean, max = 900) => { let n = 0; while (!fn() && n++ < max) stepFrameSystems(1 / 60, 0); return n; };
  try {
    // November: the season is over; BAYBAY says so, nothing starts
    __setBayNowForTests('2026-11-05T19:00'); resetFireRings();
    assert.equal(M.startMarshmallow(r.k), false);
    assert.deepEqual(flow.get().bubble?.text, zones.FIRE_SEASON_LINE);
    // a Saturday at dusk in season
    __setBayNowForTests('2026-10-03T18:40'); resetFireRings();
    assert.equal(M.startMarshmallow(r.k), true);
    assert.equal(M.startMarshmallow(r.k), false, 'one round at a time');
    assert.ok(lockReport().some(h => h.source === 'activity' && h.key === 'marshmallow'), 'the feet are held');
    assert.ok(calls.some(c => c.startsWith('sit:')), 'the player sits on the sand (charApi.sitGround)');
    assert.ok(calls.includes('baybay:sit'));
    assert.equal(chip.chipState()?.id, 'marshmallow');
    assert.equal(chip.chipState()?.meter?.lo, M.TOAST.lo);
    assert.ok(runtime.camera.shot, 'the camera takes the fire');
    assert.ok(zones.fireIts.every(it => it.radius === 0), 'no prompt over the fire');
    assert.ok(puppet.puppetPose('baybay'), 'BAYBAY drawn at her seat across the fire');
    assert.ok(dist(runtime.guide, runtime.player) > 2.4, 'out of her talk reach');
    // hold until golden, let go in the middle
    until(() => M.toastState()?.phase === 'toast');
    M.setToastHold(true);
    until(() => (M.toastState()?.player.tau ?? 0) >= M.TOAST.centre - 0.004);
    assert.equal(chip.chipState()?.status?.zh, '金黄');
    M.setToastHold(false);
    stepFrameSystems(1 / 60, 0);
    assert.equal(M.toastState()?.phase, 'eat');
    until(() => M.toastState() === null);
    const card = kit.lastResultShown()!;
    assert.equal(card.activity, 'marshmallow');
    assert.equal(card.tier, 3);
    assert.match(card.detail!.zh, /^金黄度 (9\d|100) 分$/);
    assert.deepEqual(events.filter(e => e.type === 'reward').map(e => e.type === 'reward' && e.source), ['medal:marshmallow:1', 'medal:marshmallow:2', 'medal:marshmallow:3']);
    assert.ok(kit.bestOf('marshmallow')! >= 90);
    assert.equal(lockHeld(), false);
    assert.ok(calls.includes('stand'));
    assert.equal(puppet.puppetPose('baybay'), null);
    assert.equal(runtime.camera.shot, null);
    assert.equal(chip.chipState(), null);
    assert.ok(zones.fireIts.every(it => it.radius === zones.FIRE_PROMPT_R));
    // again right there; held too long it catches fire: extra crispy, BAYBAY swaps, still one medal, no best
    events.length = 0;
    card.again!();
    assert.ok(M.toastState(), 'again at the same ring');
    until(() => M.toastState()?.phase === 'toast');
    M.setToastHold(true);
    until(() => M.toastState()?.phase !== 'toast');
    assert.equal(M.toastState()?.burnt, true);
    assert.deepEqual(flow.get().bubble?.text, M.FIRE_LINES.flare);
    M.setToastHold(false);
    until(() => M.toastState()?.phase === 'eat');
    assert.deepEqual(flow.get().bubble?.text, M.FIRE_LINES.swap);
    until(() => M.toastState() === null);
    assert.equal(kit.lastResultShown()!.tier, 1);
    assert.match(kit.lastResultShown()!.detail!.zh, /焦焦脆脆/);
    assert.ok(kit.bestOf('marshmallow')! >= 90, 'a burnt one never replaces the best');
    assert.equal(events.filter(e => e.type === 'reward').length, 0, 'tier 1 was paid already');
    // let go too early: not yet, the round goes on
    assert.equal(M.startMarshmallow(r.k), true);
    until(() => M.toastState()?.phase === 'toast');
    M.setToastHold(true);
    for (let i = 0; i < 30; i++) stepFrameSystems(1 / 60, 0);
    M.setToastHold(false);
    stepFrameSystems(1 / 60, 0);
    assert.equal(M.toastState()?.phase, 'toast');
    assert.deepEqual(flow.get().bubble?.text, M.FIRE_LINES.notYet);
    // 不烤了: nothing paid, no card
    events.length = 0;
    const before = kit.lastResultShown();
    chip.chipState()!.action!.run();
    assert.equal(M.toastState(), null);
    assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && e.what), ['cancel']);
    assert.equal(kit.lastResultShown(), before);
    assert.equal(lockHeld(), false);
    // pushing the stick stands up at no cost
    assert.equal(M.startMarshmallow(r.k), true);
    for (let i = 0; i < 30; i++) stepFrameSystems(1 / 60, 0);
    runtime.input.moveY = 1;
    stepFrameSystems(1 / 60, 0);
    runtime.input.moveY = 0;
    assert.equal(M.toastState(), null);
    assert.equal(lockHeld(), false);
  } finally { mock.timers.reset(); off(); M.__resetMarshmallow(); __setBayNowForTests(null); resetFireRings(); charApiMod.setCharApi(null); kit.unregisterResultOverlay(); kit.__resetKit(); flow.set({ bubble: null }); runtime.input.moveY = 0; playing(); }
});

test('W5-A9 heave-ho: BAYBAY calls the beat, a push on it is a big shove (2) and off it a small one (1), the card by on-beat pushes, the stamp once all three turntables are pushed; walking off costs nothing', async () => {
  const H = await import('../src/opus-bay/play/heave');
  const z3 = await import('../src/opus-bay/play/zones3');
  const chip = await import('../src/opus-bay/play/chip');
  playing();
  stubBody();
  kit.__resetKit();
  const written: Record<string, number> = {};
  kit.__setBestWriter((k, v) => { written[k] = v; });
  H.__resetHeave();
  const TT: Record<string, { x: number; z: number }> = { 'tt-a': { x: 0, z: 0 }, 'tt-b': { x: 10, z: 0 }, 'tt-c': { x: 20, z: 0 } };
  let clock = 100, t0 = 100, turning: string | null = 'tt-b';
  const pushes: [string, number][] = [];
  H.__setHeaveHooks({
    now: () => clock,
    near: () => (turning ? { id: turning, name: { zh: '转盘', en: 'Turntable' }, ...TT[turning], progress: 0.3 } : null),
    beat: id => {
      if (turning !== id) return null;
      const n = Math.max(1, Math.ceil((clock - t0) / 1.2 + 1e-6));
      return { period: 1.2, next: t0 + n * 1.2, n };
    },
    push: (id, s = 1) => { pushes.push([id, s]); return true; },
    ids: () => ['tt-a', 'tt-b', 'tt-c'],
  });
  const at = (id: string) => { runtime.player.x = TT[id].x; runtime.player.z = TT[id].z + 3; };
  const { events, off } = record();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    // the prompt follows the turn near the player (a hair wider than lane T's own 帮忙推, so it takes the focus)
    at('tt-b');
    assert.equal(z3.placeHeave({ id: 'tt-b', ...TT['tt-b'] }), true);
    assert.equal(z3.heaveIt.refId, 'tt-b');
    assert.ok(z3.heaveIt.radius > 12);
    runtime.player.x = 40;
    assert.equal(z3.placeHeave({ id: 'tt-b', ...TT['tt-b'] }), false);
    assert.ok(z3.heaveIt.x > 1e6);
    at('tt-b');
    assert.equal(H.heavePush('tt-a'), false, 'nothing turns there');
    // three pushes on the beat (a hair early / late is still on it), one between beats
    clock = 101.2;
    assert.equal(H.heavePush('tt-b'), true);
    assert.equal(chip.chipState()?.id, 'heave');
    assert.equal(lockHeld(), false, 'the feet stay free');
    clock = 102.45; H.heavePush('tt-b');
    clock = 103.56; H.heavePush('tt-b');
    clock = 104.2; H.heavePush('tt-b');
    assert.deepEqual(pushes.map(p => p[1]), [2, 2, 2, 1]);
    assert.equal(H.heaveState()?.onBeat, 3);
    // BAYBAY's call on the chip: 嘿— half a beat before, 咻！ as the beat passes
    clock = 104.45; stepFrameSystems(1 / 60, 0);
    assert.equal(chip.chipState()?.big, '嘿—');
    clock = 104.85; stepFrameSystems(1 / 60, 0);
    assert.equal(chip.chipState()?.big, '咻！');
    // the car has turned: the card
    turning = null;
    stepFrameSystems(1 / 60, 0);
    assert.equal(H.heaveState(), null);
    assert.equal(chip.chipState(), null);
    const card = kit.lastResultShown()!;
    assert.equal(card.activity, 'heave');
    assert.equal(card.tier, 3);
    assert.equal(card.detail?.zh, '推了 4 下 · 踩中节拍 3 次');
    assert.equal(written[H.HEAVE_SET_KEY], 2, 'the second turntable pushed');
    assert.deepEqual(events.filter(e => e.type === 'reward').map(e => e.type === 'reward' && e.source), ['medal:heave:1', 'medal:heave:2', 'medal:heave:3']);
    // the other two: the stamp once, when all three are in
    events.length = 0;
    for (const id of ['tt-a', 'tt-c']) {
      at(id); turning = id; t0 = clock = 200; clock = 201.2;
      H.heavePush(id);
      turning = null; stepFrameSystems(1 / 60, 0);
    }
    assert.equal(written[H.HEAVE_SET_KEY], 7);
    assert.deepEqual(events.filter(e => e.type === 'reward' && e.source === H.HEAVE_STAMP).length, 1);
    at('tt-a'); turning = 'tt-a'; t0 = clock = 300; clock = 301.2;
    H.heavePush('tt-a'); turning = null; stepFrameSystems(1 / 60, 0);
    assert.equal(events.filter(e => e.type === 'reward' && e.source === H.HEAVE_STAMP).length, 1, 'the stamp once');
    // walking off: nothing paid, no card
    events.length = 0;
    const before = kit.lastResultShown();
    at('tt-b'); turning = 'tt-b'; t0 = clock = 400; clock = 401.2;
    H.heavePush('tt-b');
    runtime.player.x = 40;
    stepFrameSystems(1 / 60, 0);
    assert.equal(H.heaveState(), null);
    assert.equal(kit.lastResultShown(), before);
    assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && e.what), ['start', 'cancel']);
    for (const line of Object.values(H.HEAVE_LINES)) assert.ok([...line.zh].length <= 45);
    assert.ok([...z3.HEAVE_INVITE_LINE.zh].length <= 45);
  } finally { mock.timers.reset(); off(); H.__resetHeave(); H.__setHeaveHooks(null); kit.__setBestWriter(null); kit.__resetKit(); charApiMod.setCharApi(null); flow.set({ bubble: null }); playing(); }
});

test('W5-A9 crest hops: 12 append-only crests on the published city — the toy car (and the bike where marked) driven over each at full throttle hops within 6 u and carries on', async () => {
  const CS = await import('../src/opus-bay/play/crestSpots');
  const { NO_DRIVE, TERRAIN_WORLD } = await import('../src/opus-bay/actors/vehicles/collide');
  const { createToyCar } = await import('../src/opus-bay/actors/vehicles/toyCar');
  const { createBike } = await import('../src/opus-bay/actors/vehicles/bike');
  // APPEND-ONLY: bit i of play.b['crests'] is spot i
  assert.deepEqual([...CS.CREST_IDS], ['union', 'broadway', 'filbert', 'divisadero', 'buchanan', 'haight', 'castro', 'diamond', 'kansas', 'crescent', 'mangels', '45th-ave']);
  for (const a of CS.CREST_SPOTS) for (const b of CS.CREST_SPOTS) if (a !== b) assert.ok(dist(a, b) > 60, `${a.id} vs ${b.id}`);
  assert.equal(CS.crestAt(CS.CREST_SPOTS[5].x + 3, CS.CREST_SPOTS[5].z - 2), 5);
  assert.equal(CS.crestAt(CS.CREST_SPOTS[5].x + 30, CS.CREST_SPOTS[5].z), -1);
  // on the run-up (a long crest's first brow), not past it nor beside the street
  const c5 = CS.CREST_SPOTS[5], ahead = (a: number, l = 0) => ({ x: c5.x + Math.sin(c5.heading) * a + Math.cos(c5.heading) * l, z: c5.z + Math.cos(c5.heading) * a - Math.sin(c5.heading) * l });
  for (const [a, l, want] of [[-22, 0, 5], [-22, 3, 5], [-22, 7, -1], [22, 0, -1], [-30, 0, -1]] as const) { const p = ahead(a, l); assert.equal(CS.crestAt(p.x, p.z), want, `${a} along, ${l} across`); }
  const DT = 1 / 60;
  const drive = (make: () => ReturnType<typeof createToyCar>, s: (typeof CS.CREST_SPOTS)[number]) => {
    const sim = make(), dx = Math.sin(s.heading), dz = Math.cos(s.heading);
    sim.place(s.x - dx * 60, s.z - dz * 60, s.heading, TERRAIN_WORLD);
    let hop: number | null = null;
    for (let t = 0; t < 20; t += DT) {
      const along = (sim.x - s.x) * dx + (sim.z - s.z) * dz;
      const tx = s.x + dx * (along + 6), tz = s.z + dz * (along + 6);
      let e = Math.atan2(tx - sim.x, tz - sim.z) - sim.heading; e = Math.atan2(Math.sin(e), Math.cos(e));
      const r = sim.step(DT, { ...NO_DRIVE, throttle: 1, steer: Math.max(-1, Math.min(1, -e * 2)), digital: false }, TERRAIN_WORLD);
      if (r.hop?.crest && Math.abs(along) < 6 && hop === null) hop = along;
      if (along > 25) return { hop, through: true };
      if (t > 3 && sim.v < 0.5) return { hop, through: false, at: along };
    }
    return { hop, through: false };
  };
  try {
    for (const s of CS.CREST_SPOTS) {
      await cityAround([s], 90);
      assert.equal(T.surfaceAt(s.x, s.z), 'road', `${s.id}: on the street`);
      const car = drive(createToyCar, s);
      assert.ok(car.hop !== null && car.through, `${s.id}: the car hops (${car.hop}) and carries on (${JSON.stringify(car)})`);
      if (s.bike) { const bike = drive(createBike as never, s); assert.ok(bike.hop !== null && bike.through, `${s.id}: the bike hops too (${JSON.stringify(bike)})`); }
      T.setCityTerrain(null);
    }
  } finally { T.setCityTerrain(null); }
});

test('W5-A9 crest hops: a crest hop at a spot counts it once (the card: ● the first, ◆ 6, ★ all 12), the set kept in play.b; the pennants near one; the snapshot overlay', async () => {
  const CS = await import('../src/opus-bay/play/crestSpots');
  const C = await import('../src/opus-bay/play/crests');
  const z3 = await import('../src/opus-bay/play/zones3');
  playing();
  stubBody();
  kit.__resetKit();
  const written: Record<string, number> = {};
  kit.__setBestWriter((k, v) => { written[k] = v; });
  C.__resetCrests();
  const { events, off } = record();
  mock.timers.enable({ apis: ['setTimeout'] });
  game.set({ worldMode: 'city' });
  const offZ = z3.initZones3();
  try {
    assert.ok(slots.overlays.get(z3.SNAP_OVERLAY), 'the snapshot overlay');
    // lane F's crest hop, riding over the Haight crest: counted (through zones3's listener)
    const s = CS.CREST_SPOTS[5];
    runtime.player.x = s.x + 2; runtime.player.z = s.z - 1;
    emit({ type: 'vehicle:hop', vehicle: 'car', crest: true });
    for (let i = 0; i < 20 && C.crestHops() === 0; i++) await new Promise(r => setImmediate(r));
    C.__flushCrestCard();
    assert.equal(C.crestHops(), 1);
    assert.equal(C.crestCount(), 1);
    assert.equal(written[CS.CREST_KEY], 1 << 5);
    let card = kit.lastResultShown()!;
    assert.equal(card.activity, 'crests');
    assert.equal(card.tier, 1);
    assert.equal(card.detail?.zh, '坡顶飞跃 1 / 12 · 海特街');
    assert.deepEqual(flow.get().bubble?.text, C.CREST_LINES.first);
    // a Space hop (not a crest) and a hop far from every crest count nothing
    emit({ type: 'vehicle:hop', vehicle: 'car', crest: false });
    runtime.player.x = s.x + 40;
    emit({ type: 'vehicle:hop', vehicle: 'bike', crest: true });
    for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r));
    assert.equal(C.crestHops(), 1);
    // the same crest again: no card, no count
    C.crestHop(5);
    assert.equal(kit.lastResultShown(), card);
    assert.equal(C.crestCount(), 1);
    // six crests: ◆; all twelve: ★ and BAYBAY's line
    for (const i of [0, 1, 2, 3, 4]) { C.crestHop(i); C.__flushCrestCard(); }
    card = kit.lastResultShown()!;
    assert.equal(card.tier, 2);
    for (const i of [6, 7, 8, 9, 10, 11]) { C.crestHop(i); C.__flushCrestCard(); }
    card = kit.lastResultShown()!;
    assert.equal(card.tier, 3);
    assert.equal(card.detail?.zh, '坡顶飞跃 12 / 12 · 45 大道');
    assert.deepEqual(flow.get().bubble?.text, C.CREST_LINES.all);
    assert.deepEqual(events.filter(e => e.type === 'reward').map(e => e.type === 'reward' && e.source), ['medal:crests:1', 'medal:crests:2', 'medal:crests:3']);
    // the pennants: two per crest within PENNANT_R, gold once hopped
    const THREE = await import('three');
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 24);
    mesh.setColorAt(0, new THREE.Color());
    runtime.player.x = s.x; runtime.player.z = s.z;
    C.updatePennants(mesh, 0, 1 / 60);
    assert.equal(mesh.count, 2);
    runtime.player.x = 1e5;
    C.updatePennants(mesh, 0, 1 / 60);
    assert.equal(mesh.count, 0);
    for (const line of [...Object.values(C.CREST_LINES), z3.CREST_HINT]) assert.ok([...line.zh].length <= 45);
  } finally { offZ(); mock.timers.reset(); off(); C.__resetCrests(); kit.__setBestWriter(null); kit.__resetKit(); charApiMod.setCharApi(null); flow.set({ bubble: null }); game.set({ worldMode: 'district' }); playing(); }
});

test('W5-A9 sea lions: 数海狮 at the K-Dock rail (standable, clear of other prompts), taps count each lion once (a bark), 数好了 → the card, all of them → ★; moving costs nothing', async () => {
  const SL = await import('../src/opus-bay/play/sealions');
  const z3 = await import('../src/opus-bay/play/zones3');
  const chip = await import('../src/opus-bay/play/chip');
  const THREE = await import('three');
  // the rail on the published city, a few steps from the dock, clear of every card / POI / postcard prompt
  await cityAround([z3.LION_VIEW, z3.LION_SPOT], 60);
  try {
    assert.ok(T.canStand(z3.LION_SPOT.x, z3.LION_SPOT.z, 0.5), 'the rail is standable');
    assert.ok(dist(z3.LION_SPOT, z3.LION_VIEW) < 7, 'along the rail from the viewpoint');
    const prompts = [
      ...CITY_POI_PROMPTS,
      ...[...PLACE_CARDS, ...PLACE_CARDS_2].filter(c => c.lat !== undefined && c.lng !== undefined).map(c => ({ id: `card ${c.id}`, ...project(c.lat!, c.lng!) })),
      ...CITY_POSTCARDS.map(c => ({ id: `postcard ${c.id}`, ...c.position })),
    ];
    // (a POI prompt reaches its own radius: the viewpoint's 给海狮拍照 holds 4 u round it, so 数海狮 stands clear of that)
    for (const p of prompts) assert.ok(dist(z3.LION_SPOT, p) >= Math.max(z3.LION_PROMPT_R, (p as { r?: number }).r ?? 0) + 1, `${dist(z3.LION_SPOT, p).toFixed(1)} u from ${p.id}`);
  } finally { T.setCityTerrain(null); }
  for (const line of [...Object.values(SL.LION_LINES), z3.LION_INVITE_LINE]) assert.ok([...line.zh].length <= 45, line.zh);
  assert.equal(SL.lionTier(19, 19), 3);
  assert.equal(SL.lionTier(12, 19), 2);
  assert.equal(SL.lionTier(3, 19), 1);
  playing();
  stubBody();
  kit.__resetKit();
  kit.__setBestWriter(null);
  SL.__resetLions();
  runtime.player.x = z3.LION_SPOT.x; runtime.player.z = z3.LION_SPOT.z;
  const offZ = z3.initZones3();
  const { events, off } = record();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    assert.equal(SL.startSeaLions(), true);
    assert.equal(SL.startSeaLions(), false, 'one count at a time');
    assert.ok(lockReport().some(h => h.source === 'activity' && h.key === 'sealions'));
    assert.ok(runtime.camera.shot, 'the camera over the dock');
    assert.equal(chip.chipState()?.big, '0 / 19');
    assert.ok(slots.openOverlays().some(o => o.id === z3.BADGE_OVERLAY), 'the numbers overlay');
    // the camera the shot asks for: every lion in view
    const cam = new THREE.PerspectiveCamera(50, 390 / 844, 0.1, 500);
    const sh = SL.lionShot(SL.lionState()!.spots, true);
    cam.position.set(...sh.position); cam.lookAt(new THREE.Vector3(...sh.target)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    SL.projectLions(cam, 390, 844);
    const st = SL.lionState()!;
    assert.equal(st.spots.length, 19);
    assert.ok(st.screen.filter(p => p.on).length >= 17, `lions in view on a phone: ${st.screen.filter(p => p.on).length}`);
    const wide = new THREE.PerspectiveCamera(50, 1440 / 900, 0.1, 500), ws = SL.lionShot(st.spots, false);
    wide.position.set(...ws.position); wide.lookAt(new THREE.Vector3(...ws.target)); wide.updateMatrixWorld(); wide.updateProjectionMatrix();
    SL.projectLions(wide, 1440, 900);
    assert.ok(SL.lionState()!.screen.filter(p => p.on).length >= 17, 'lions in view on a desktop');
    SL.projectLions(cam, 390, 844);
    // a tap on a lion counts it, once; a tap on empty water nothing
    const i = st.screen.findIndex(p => p.on);
    assert.equal(SL.tapAt(st.screen[i].x + 5, st.screen[i].y - 4), true);
    assert.equal(st.order[i], 1);
    assert.equal(SL.tapAt(st.screen[i].x, st.screen[i].y), SL.lionState()!.screen.some((p, k) => k !== i && p.on && Math.hypot(p.x - st.screen[i].x, p.y - st.screen[i].y) < SL.TAP_R), 'the same lion is not counted twice (a close neighbour may be)');
    assert.equal(SL.tapAt(-500, -500), false);
    assert.ok(events.some(e => e.type === 'sea-lion'), 'it barks');
    assert.ok(SL.lionBadges().length >= 1);
    // 数好了: the card with the count
    const n = SL.lionState()!.n;
    chip.chipState()!.action!.run();
    const card = kit.lastResultShown()!;
    assert.equal(card.activity, 'sealions');
    assert.equal(card.detail?.zh, `数到 ${n} 只海狮`);
    assert.equal(lockHeld(), false);
    assert.equal(runtime.camera.shot, null);
    assert.ok(!slots.openOverlays().some(o => o.id === z3.BADGE_OVERLAY));
    // all of them: ★ by itself
    assert.equal(SL.startSeaLions(), true);
    for (let k = 0; k < 19; k++) SL.countLion(k);
    assert.equal(SL.lionState(), null);
    assert.equal(kit.lastResultShown()!.tier, 3);
    assert.match(kit.lastResultShown()!.detail!.zh, /全数到了/);
    // moving away: nothing paid, no card
    const before = kit.lastResultShown();
    events.length = 0;
    assert.equal(SL.startSeaLions(), true);
    for (let k = 0; k < 30; k++) stepFrameSystems(1 / 60, 0);
    runtime.input.moveY = 1; stepFrameSystems(1 / 60, 0); runtime.input.moveY = 0;
    assert.equal(SL.lionState(), null);
    assert.equal(kit.lastResultShown(), before);
    assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && e.what), ['start', 'cancel']);
  } finally { offZ(); mock.timers.reset(); off(); SL.__resetLions(); kit.__resetKit(); charApiMod.setCharApi(null); flow.set({ bubble: null }); runtime.input.moveY = 0; playing(); }
});

test('W5-A9 frisbee: 玩飞盘 on grass / sand (问 BAYBAY), a throw sails 5–14 u in an arc, BAYBAY there first catches it, else fetches it; five throws → the card by catches', async () => {
  const FZ = await import('../src/opus-bay/play/frisbee');
  const z3 = await import('../src/opus-bay/play/zones3');
  const chip = await import('../src/opus-bay/play/chip');
  const THREE = await import('three');
  // the arc: from the hand to the spot, highest in the middle, a longer throw flies longer
  const g0 = { from: new THREE.Vector3(0, 1, 0), to: new THREE.Vector3(0, 0, 10), dur: FZ.flightTime(10), dist: 10 };
  assert.ok(FZ.discAt(g0, g0.dur).distanceTo(g0.to) < 1e-6);
  assert.ok(FZ.discAt(g0, g0.dur / 2).y > 2);
  assert.ok(FZ.flightTime(14) > FZ.flightTime(6));
  for (const line of Object.values(FZ.FRISBEE_LINES)) assert.ok([...line.zh].length <= 45);
  playing();
  stubBody();
  kit.__resetKit();
  kit.__setBestWriter(null);
  FZ.__resetFrisbee();
  const P = DISTRICT.anchors['ferry-gate'];
  runtime.player.x = P.x; runtime.player.z = P.z; runtime.player.heading = 0;
  runtime.guide.x = P.x + 1.5; runtime.guide.z = P.z;
  const { events, off } = record();
  mock.timers.enable({ apis: ['setTimeout'] });
  const until = (fn: () => boolean, max = 600) => { let n = 0; while (!fn() && n++ < max) stepFrameSystems(1 / 60, 0); };
  try {
    assert.equal(FZ.startFrisbee(), true);
    assert.equal(chip.chipState()?.big, `0 / ${FZ.THROWS}`);
    assert.equal(lockHeld(), false, 'the feet stay free');
    // BAYBAY waits a step to your side
    FZ.driveBaybay();
    assert.ok(runtime.guide.target === null || dist(runtime.guide.target, runtime.player) < 2.5);
    let caught = 0;
    for (let k = 0; k < FZ.THROWS; k++) {
      // throws: a far tap is clamped to THROW_MAX; she is there first on even throws; the last one is E (ahead where the camera looks)
      const far = k === 0 ? 40 : 8;
      if (k === FZ.THROWS - 1) runtime.camera.yaw = Math.PI;
      assert.equal(k === FZ.THROWS - 1 ? FZ.keyThrow() : FZ.throwAt(P.x, P.z + far), true, `throw ${k}`);
      const g = FZ.frisbeeState()!;
      assert.ok(Math.abs(g.dist - (k === 0 ? FZ.THROW_MAX : k === FZ.THROWS - 1 ? FZ.THROW_KEY_DIST : 8)) < 1e-6, `throw ${k}: ${g.dist}`);
      if (k === FZ.THROWS - 1) assert.ok(Math.abs(g.to.x - P.x) < 1e-6 && g.to.z > P.z, 'E throws where the camera looks');
      assert.equal(FZ.throwAt(P.x, P.z + 6), false, 'one frisbee at a time');
      FZ.driveBaybay();
      assert.ok(runtime.guide.run && dist(runtime.guide.target!, g.to) < 1e-6, 'she runs for it');
      if (k % 2 === 0) { runtime.guide.x = g.to.x + 0.3; runtime.guide.z = g.to.z; caught++; }
      until(() => FZ.frisbeeState()?.phase !== 'fly');
      if (k % 2 === 1) {
        assert.equal(FZ.frisbeeState()?.phase, 'fetch');
        runtime.guide.x = g.to.x; runtime.guide.z = g.to.z;
        until(() => FZ.frisbeeState()?.phase !== 'fetch');
      }
      assert.equal(FZ.frisbeeState()?.phase, 'back');
      runtime.guide.x = P.x + 1; runtime.guide.z = P.z;
      until(() => !FZ.frisbeeState() || FZ.frisbeeState()!.phase === 'ready');
    }
    assert.equal(FZ.frisbeeState(), null);
    const card = kit.lastResultShown()!;
    assert.equal(card.activity, 'frisbee');
    assert.equal(card.tier, 2);
    assert.equal(card.detail?.zh, `接住 ${caught} / ${FZ.THROWS} · 飞身接 1 次`);
    assert.ok(card.again);
    // 不玩了: nothing paid
    events.length = 0;
    assert.equal(FZ.startFrisbee(), true);
    chip.chipState()!.action!.run();
    assert.equal(FZ.frisbeeState(), null);
    assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && e.what), ['start', 'cancel']);
    // the ask item: only on grass, sand or earth
    assert.equal(typeof z3.frisbeeHere(), 'boolean');
  } finally { mock.timers.reset(); off(); FZ.__resetFrisbee(); kit.__resetKit(); charApiMod.setCharApi(null); flow.set({ bubble: null }); playing(); }
});

test('W5-A9 beach ball: 玩沙滩球 on the sand — BAYBAY serves, your feet walk under it, a bump only when it is low (the gold shadow), turns alternate, it lands → the card by the rally', async () => {
  const B = await import('../src/opus-bay/play/ball');
  const z3 = await import('../src/opus-bay/play/zones3');
  const chip = await import('../src/opus-bay/play/chip');
  const THREE = await import('three');
  // the landing a ballistic float predicts
  const pos = new THREE.Vector3(0, T.heightAt(0, 0) + B.BALL.r + 1, 0), vel = new THREE.Vector3(1, B.BALL.lift, 0.5);
  const land = B.landing(pos, vel), p2 = pos.clone(), v2 = vel.clone();
  let t = 0;
  while (B.ballHeight(p2) > 0 && t < 10) { v2.y -= B.BALL.g / 600; p2.addScaledVector(v2, 1 / 600); t += 1 / 600; }
  assert.ok(Math.abs(t - land.t) < 0.02 && Math.hypot(p2.x - land.x, p2.z - land.z) < 0.05, `landing ${land.t.toFixed(2)} vs ${t.toFixed(2)}`);
  for (const line of Object.values(B.BALL_LINES)) assert.ok([...line.zh].length <= 45);
  playing();
  stubBody();
  kit.__resetKit();
  kit.__setBestWriter(null);
  B.__resetBall();
  const P = DISTRICT.anchors['ferry-gate'];
  runtime.player.x = P.x; runtime.player.z = P.z;
  runtime.guide.x = P.x + 2.5; runtime.guide.z = P.z;
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    assert.equal(B.startBall(), true);
    const r = B.ballState()!;
    assert.equal(r.turn, 'player');
    assert.ok(runtime.player.pathTarget, 'your feet walk under it');
    assert.equal(chip.chipState()?.big, '0');
    // too early: nothing
    assert.equal(B.bump('player'), false);
    let rallies = 0;
    for (let k = 0; k < 6; k++) {
      let n = 0;
      if (B.ballState()!.turn === 'player') {
        while (!B.bumpable(B.ballState()!.pos, B.ballState()!.vel) && n++ < 600) stepFrameSystems(1 / 60, 0);
        assert.equal(B.bump('player'), true, `your bump ${k}`);
      } else {
        // BAYBAY under hers bumps it herself
        while (B.ballState() && B.ballState()!.turn === 'baybay' && n++ < 600) {
          const s = B.ballState()!;
          runtime.guide.x = s.pos.x + 0.2; runtime.guide.z = s.pos.z;
          stepFrameSystems(1 / 60, 0);
        }
      }
      rallies++;
    }
    const bumps = B.ballState()!.bumps;
    assert.ok(bumps >= 5, `bumps ${bumps}`);
    // your turn, you do nothing: it lands, the rally is over, the card
    let n = 0;
    while (B.ballState() && n++ < 1200) { runtime.guide.x = P.x + 30; stepFrameSystems(1 / 60, 0); }
    assert.equal(B.ballState(), null);
    const card = kit.lastResultShown()!;
    assert.equal(card.activity, 'beachball');
    assert.equal(card.detail?.zh, `连续颠球 ${bumps} 下`);
    assert.equal(card.tier, bumps >= 8 ? 2 : 1);
    assert.equal(runtime.player.pathTarget, null);
    assert.equal(typeof z3.ballHere(), 'boolean');
    assert.ok(rallies > 0);
  } finally { mock.timers.reset(); B.__resetBall(); kit.__resetKit(); charApiMod.setCharApi(null); flow.set({ bubble: null }); runtime.player.pathTarget = null; playing(); }
});

test('W5-A9 grass sled: 滑草 offered on a lawn steeper than 1 in 4 (Dolores Park, not on flat grass nor over a view spot), down the fall line, leaning back is faster, the card by the distance', async () => {
  const S = await import('../src/opus-bay/play/sled');
  const z3 = await import('../src/opus-bay/play/zones3');
  const chip = await import('../src/opus-bay/play/chip');
  const DOLORES = { x: 253, z: 717 };
  await cityAround([DOLORES], 70);
  try {
    assert.equal(z3.sledOffer(DOLORES.x, DOLORES.z), true, 'the Dolores Park slope');
    const view = views.viewSpotById('dolores-park')!;
    assert.ok(dist(view, DOLORES) > views.VIEW_RADIUS + 0.5);
    // flat ground is no sled
    const flat = [...CITY_POSTCARDS].find(c => z3.slopeAt(c.position.x, c.position.z).grade < 0.05);
    if (flat) assert.equal(z3.sledOffer(flat.position.x, flat.position.z), false);
    // the slide down the fall line: sitting, then leaning back all the way (further and faster)
    const slide = (lean: boolean) => {
      const sl = z3.slopeAt(DOLORES.x, DOLORES.z), s = { x: DOLORES.x, z: DOLORES.z, vx: sl.dx * 0.8, vz: sl.dz * 0.8, dist: 0, top: 0 };
      let t = 0;
      while (t < 20 && S.sledStep(s, 1 / 60, 0, lean) === 'go') t += 1 / 60;
      return { ...s, t };
    };
    const sit = slide(false), lean = slide(true);
    assert.ok(sit.dist >= S.SLED_TIERS[1], `slid ${sit.dist.toFixed(1)} u`);
    // (review 2026-09-28) offered only where the slide runs at least a ● medal's 6 u: every offer round the lawn slides
    // that far sitting still (half of them slid < 6 u into a 再试试 card before, one 1 u into a lamp post at 248, 712)
    assert.equal(z3.SLED_RUN, S.SLED_TIERS[0]);
    assert.equal(z3.sledOffer(248, 712), false, 'a lamp post a step down the slope');
    let offered = 0;
    for (let dx = -30; dx <= 30; dx += 2) for (let dz = -30; dz <= 30; dz += 2) {
      const x = DOLORES.x + dx, z = DOLORES.z + dz;
      if (!z3.sledOffer(x, z)) continue;
      offered++;
      const sl = z3.slopeAt(x, z), s = { x, z, vx: sl.dx * 0.8, vz: sl.dz * 0.8, dist: 0, top: 0 };
      let t = 0;
      while (t < 20 && S.sledStep(s, 1 / 60, 0, false) === 'go') t += 1 / 60;
      assert.ok(s.dist >= S.SLED_TIERS[0], `offered at ${x}, ${z}: slid ${s.dist.toFixed(1)} u`);
    }
    assert.ok(offered >= 10, `${offered} spots on the lawn`);
    assert.ok(lean.top > sit.top, `leaning back is faster (${lean.top.toFixed(1)} vs ${sit.top.toFixed(1)})`);
    assert.ok(T.canStand(sit.x, sit.z, 0.35), 'ends on standable ground');
    // the ride in the game loop
    playing();
    const calls = stubBody();
    kit.__resetKit();
    kit.__setBestWriter(null);
    S.__resetSled();
    runtime.player.x = DOLORES.x; runtime.player.z = DOLORES.z; runtime.player.y = T.heightAt(DOLORES.x, DOLORES.z);
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      assert.equal(S.startSled(), true);
      assert.ok(lockReport().some(h => h.source === 'activity' && h.key === 'sled'));
      assert.ok(calls.includes('player:sit'));
      assert.equal(chip.chipState()?.id, 'sled');
      assert.equal(z3.sledIt.radius, 0);
      let n = 0;
      while (S.sledState() && n++ < 60 * 25) stepFrameSystems(1 / 60, 0);
      assert.equal(S.sledState(), null);
      const card = kit.lastResultShown()!;
      assert.equal(card.activity, 'sled');
      assert.ok(card.tier >= 2, `tier ${card.tier}: ${card.detail?.zh}`);
      // the player reads metres, never the city's u (review 2026-09-28: the card said 滑了 1 u · 最快 1.6 u/s)
      assert.match(card.detail!.zh, /^滑了 \d+ 米 · 最快每秒 [\d.]+ 米$/);
      assert.match(card.detail!.en, /^\d+ m slid · top [\d.]+ m\/s$/);
      assert.equal(chip.chipState(), null, 'the chip went');
      assert.ok(dist(runtime.player, DOLORES) > 10, 'you end down the slope');
      assert.equal(lockHeld(), false);
      assert.equal(z3.sledIt.radius, z3.SLED_PROMPT_R);
      for (const line of Object.values(S.SLED_LINES)) assert.ok([...line.zh].length <= 45);
      // BAYBAY's line at the foot fits the slide (never the start's 坐稳啦——冲！ again)
      assert.deepEqual(flow.get().bubble?.text, S.SLED_LINES.far, 'a ◆ slide (15 u and more): 滑了好远！');
      assert.notDeepEqual(flow.get().bubble?.text, S.SLED_LINES.go);
    } finally { mock.timers.reset(); S.__resetSled(); kit.__resetKit(); charApiMod.setCharApi(null); flow.set({ bubble: null }); playing(); }
  } finally { T.setCityTerrain(null); }
});

test('W5-A9 crooked blocks: Lombard and Vermont on the published city (walkable, downhill), the gentle descent in a vehicle (the speed band, bumps, the card), on foot BAYBAY\'s facts and her verdict once both are done', async () => {
  const CC = await import('../src/opus-bay/play/crookedCourses');
  const CR = await import('../src/opus-bay/play/crooked');
  const chip = await import('../src/opus-bay/play/chip');
  for (const c of CC.CROOKED) {
    await cityAround([CC.crookedTop(c)], 70);
    try {
      let bad = 0, n = 0;
      for (let i = 1; i < c.line.length; i++) {
        const a = c.line[i - 1], b = c.line[i], L = Math.hypot(b.x - a.x, b.z - a.z);
        for (let s = 0; s < L; s += 0.4) { n++; if (!T.canStand(a.x + ((b.x - a.x) * s) / L, a.z + ((b.z - a.z) * s) / L, 0.3)) bad++; }
      }
      assert.ok(bad / n < 0.1, `${c.id}: ${bad} of ${n} samples not standable`);
      const top = CC.crookedTop(c), bot = CC.crookedBottom(c);
      assert.ok(T.heightAt(top.x, top.z) > T.heightAt(bot.x, bot.z) + 3, `${c.id}: downhill`);
      assert.ok(CC.progressOn(c, top.x, top.z) < 0.02 && CC.progressOn(c, bot.x, bot.z) > 0.98);
    } finally { T.setCityTerrain(null); }
  }
  // on foot the ends are wide enough for the side steps (the game's path follower ended 3.4 u off Lombard's bottom)
  const z3c = await import('../src/opus-bay/play/zones3');
  assert.ok(dist({ x: -155.1, z: 157.8 }, CC.crookedBottom(CC.CROOKED[0])) < z3c.CROOKED_END_R);
  assert.equal(CR.crookedTier(0, 0), 3);
  assert.equal(CR.crookedTier(1, 1), 2);
  assert.equal(CR.crookedTier(3, 0), 1);
  for (const line of Object.values(CR.CROOKED_LINES)) assert.ok([...line.zh].length <= 45, line.zh);
  // the sign at the top RECOMMENDS 5 mph (en.wikipedia.org "Lombard Street (San Francisco)", review 2026-09-28): never 限速
  assert.doesNotMatch(CR.CROOKED_LINES.lombard.zh, /限速/);
  assert.match(CR.CROOKED_LINES.lombard.zh, /建议每小时 5 英里/);
  playing();
  stubBody();
  kit.__resetKit();
  const written: Record<string, number> = {};
  kit.__setBestWriter((k, v) => { written[k] = v; });
  CR.__resetDescent();
  mock.timers.enable({ apis: ['setTimeout'] });
  const v = runtime.vehicle;
  try {
    // on foot, never; in the toy car, down the Lombard lane slowly with one bump: ◆
    v.occupied = false;
    assert.equal(CR.startDescent('lombard'), false);
    const c = CC.CROOKED[0];
    v.occupied = true; v.kind = 'car';
    assert.equal(CR.startDescent('lombard'), true);
    assert.equal(chip.chipState()?.id, 'crooked-lombard');
    assert.ok(chip.chipState()?.meter);
    for (let i = 0; i < c.line.length; i++) {
      v.x = c.line[i].x; v.z = c.line[i].z; v.speed = 2.4;
      if (i === 10) emit({ type: 'vehicle:bump', vehicle: 'car', strength: 0.2, hard: false, kind: 'wall' });
      for (let k = 0; k < 8 && CR.descentState(); k++) stepFrameSystems(1 / 60, 0);
    }
    assert.equal(CR.descentState(), null);
    let card = kit.lastResultShown()!;
    assert.equal(card.activity, 'crooked-lombard');
    assert.equal(card.tier, 2);
    assert.match(card.detail!.zh, /碰撞 1 次 · 超速 0\.0 秒$/);
    assert.equal(written['crooked-lombard'], 1);
    // too fast all the way, and off the lane: nothing
    assert.equal(CR.startDescent('vermont'), true);
    v.x = CC.CROOKED[1].line[2].x + 20; v.z = CC.CROOKED[1].line[2].z;
    stepFrameSystems(1 / 60, 0);
    assert.equal(CR.descentState(), null);
    assert.equal(kit.lastResultShown(), card);
    // on foot: Vermont walked after Lombard → the verdict
    v.occupied = false;
    flow.set({ bubble: null });
    CR.walkedDown('vermont');
    mock.timers.tick(1500);
    assert.deepEqual(flow.get().bubble?.text, CR.CROOKED_LINES.verdict);
    card = kit.lastResultShown()!;
    assert.equal(card.activity, 'crooked-lombard', 'no card on foot');
  } finally { v.occupied = false; v.kind = null; v.speed = 0; mock.timers.reset(); CR.__resetDescent(); kit.__setBestWriter(null); kit.__resetKit(); charApiMod.setCharApi(null); flow.set({ bubble: null }); playing(); }
});

test('W5-A9 Golden Gate rings: a figure-eight round both towers inside the glide envelope, flyable spacing, the facts short', async () => {
  const G = await import('../src/opus-bay/play/ggbRings');
  const { goldenGateBridge: B, GGB: GF } = await import('../src/opus-bay/world/sf/landmarks/golden-gate-bridge');
  const { ringGeometry } = await import('../src/opus-bay/play/rings');
  const course = G.GGB_COURSE;
  assert.equal(course.length, 8);
  // lane L's frame: s along the deck, c across (+ = the bay side)
  const local = (p: { x: number; z: number }) => {
    const dx = p.x - B.x, dz = p.z - B.z;
    return { s: dx * Math.cos(B.yaw) - dz * Math.sin(B.yaw), c: dx * Math.sin(B.yaw) + dz * Math.cos(B.yaw) };
  };
  assert.ok(dist(G.GGB_MID, B) < 0.2, 'the middle is the bridge frame origin');
  await cityAround([{ x: B.x, z: B.z }, course[0], course[4]], 140);
  try {
    const tall = [...siteContext.landmarkTallStructures(l => (typeof l.base === 'number' ? l.base : T.heightAt(l.x, l.z))), ...heroTall(), ...bayBridgeTall()];
    const world = terrainGlideWorld(tall);
    let len = 0;
    course.forEach((r, i) => {
      assert.ok(T.inWorld(r.x, r.z), `ring ${i + 1}: in the model`);
      const floor = Math.max(world.heightAt(r.x, r.z), world.roofAt(r.x, r.z, GLIDE.floorR + flight.RING_R));
      assert.ok(r.floor >= floor - 1e-6, `ring ${i + 1}: floor ${r.floor} under the glide's ${floor.toFixed(1)}`);
      assert.ok(flight.ringY(r.floor, -1e9) >= floor + GLIDE.floorClear + 2);
      assert.ok(flight.ringY(r.floor, 1e9) <= GLIDE.ceiling);
      assert.ok(dist(r, G.GGB_MID) < G.GGB_NEAR - 60, `ring ${i + 1} well inside the start radius`);
      if (i) {
        const d = dist(r, course[i - 1]);
        assert.ok(d >= 40 && d <= 120, `ring ${i}→${i + 1}: ${d.toFixed(0)} u`);
        len += d;
      }
    });
    const seconds = len / GLIDE.cruise;
    assert.ok(seconds > 30 && seconds < 60, `≈ ${seconds.toFixed(0)} s at cruise`);
  } finally { T.setCityTerrain(null); }
  // round the towers: each one passed on both sides, none flown into (the tower legs stand ≈ 3 u off the axis)
  const loc = course.map(local);
  for (const sT of [-GF.TOWER, GF.TOWER]) {
    assert.ok(loc.some(p => Math.abs(p.s - sT) < 12 && p.c > 10), `a ring abeam the tower at s ${sT} on the bay side`);
    assert.ok(loc.some(p => Math.abs(p.s - sT) < 12 && p.c < -10), `… and on the ocean side`);
    assert.ok(loc.every(p => Math.hypot(p.s - sT, p.c) > 12));
  }
  // over the cables three times: legs from one side to the other
  const crossings = loc.slice(1).filter((p, i) => Math.sign(p.c) !== Math.sign(loc[i].c)).length;
  assert.ok(crossings >= 3, `${crossings} crossings`);
  for (const line of Object.values(G.GGB_LINES)) assert.ok([...line.zh].length <= 45, line.zh);
  assert.equal(flight.flightName('ggb'), G.GGB_NAME);
  assert.equal(flight.flightName('coit'), flight.FIRST_FLIGHT_NAME);
  // the rings drawn without their coins: the torus is the first part of the geometry
  const geo = ringGeometry();
  assert.ok(geo.userData.ringOnly > 0 && geo.userData.ringOnly < geo.getAttribute('position').count);
  geo.dispose();
});

test('W5-A9 Golden Gate rings run: BAYBAY\'s invite on foot, gliding by the bridge starts it from the nearer end (once a visit), no coins in the rings, the medal, the facts on the way', async () => {
  const G = await import('../src/opus-bay/play/ggbRings');
  const zones = await import('../src/opus-bay/play/zones');
  const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };
  playing();
  stubBody();
  game.set({ worldMode: 'city' });
  moveApi.setGlideUnlocked(true);
  kit.__resetKit();
  const written: Record<string, number> = {};
  kit.__setBestWriter((k, v) => { written[k] = v; });
  const { events, off: offEv } = record();
  const off = zones.initZones();
  const g = runtime.glide;
  try {
    // on foot by the bridge, BAYBAY at hand: her invite
    const foot = { x: G.GGB_MID.x + 120, z: G.GGB_MID.z + 60 };
    runtime.player.x = foot.x; runtime.player.z = foot.z;
    runtime.guide.x = foot.x + 2; runtime.guide.z = foot.z;
    flow.set({ bubble: null });
    stepFrameSystems(0.3, 0);
    assert.deepEqual(flow.get().bubble?.text, G.GGB_LINES.invite);
    assert.equal(flight.flightState(), null, 'on foot nothing starts');
    flow.set({ bubble: null });
    // gliding in from the ocean side of the south tower: the course starts, the last ring first
    const last = G.GGB_COURSE[7];
    runtime.move.mode = 'glide';
    g.active = true;
    g.x = last.x - 40; g.z = last.z + 30; g.y = 30;
    runtime.player.x = g.x; runtime.player.z = g.z;
    assert.ok(dist(g, G.GGB_MID) < G.GGB_NEAR);
    stepFrameSystems(0.3, 0);
    await flush();
    const s = flight.flightState()!;
    assert.ok(s, 'the course started');
    assert.equal(s.course, 'ggb');
    assert.equal(s.phase, 'flying');
    assert.equal(kit.currentActivity()?.spec.id, G.GGB_ID);
    assert.deepEqual([s.rings[0].x, s.rings[0].z], [last.x, last.z], 'from the nearer end');
    assert.ok(slots.openOverlays().some(o => o.id === flight.CHIP_OVERLAY));
    // all eight: BAYBAY's tower fact at the third, the colour at the fifth
    const said: string[] = [];
    s.rings.forEach((r, i) => {
      g.x = r.x + 2; g.z = r.z; g.y = r.y;
      flow.set({ bubble: null });
      flight.step(1 / 30);
      if (flow.get().bubble) said.push(`${i + 1}:${flow.get().bubble!.text.zh}`);
    });
    assert.ok(said.includes(`3:${G.GGB_LINES.tower.zh}`) && said.includes(`5:${G.GGB_LINES.colour.zh}`), said.join(' | '));
    assert.equal(flight.flightState(), null);
    const card = kit.lastResultShown()!;
    assert.equal(card.activity, G.GGB_ID);
    assert.equal(card.tier, 3);
    assert.deepEqual(card.detail, { zh: '穿过 8 / 8 个金圈', en: '8 of 8 rings' });
    const sources = events.filter(e => e.type === 'reward').map(e => (e.type === 'reward' ? e.source : ''));
    assert.ok(!sources.some(x => x.startsWith('ring:')), 'no coins in the Golden Gate rings');
    assert.deepEqual(sources.filter(x => x.startsWith('medal:')), [1, 2, 3].map(t => `medal:${G.GGB_ID}:${t}`));
    assert.equal(written[G.GGB_ID], 8);
    // still by the bridge: not again this visit (and all eight are flown)
    stepFrameSystems(0.3, 0);
    await flush();
    assert.equal(flight.flightState(), null);
  } finally { off(); offEv(); flight.skipFirstFlight(); g.active = false; runtime.move.mode = 'foot'; kit.unregisterResultOverlay(); kit.__setBestWriter(null); kit.__resetKit(); charApiMod.setCharApi(null); flow.set({ bubble: null }); game.set({ worldMode: 'district' }); playing(); }
});

// --- the adversarial review (2026-09-28) ----------------------------------------------------------------------------------

const flushAll = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setImmediate(r)); };

test('W5-A-review Golden Gate rings: never started on a trip the pelican flies itself; a trip taking the wings ends any course at no cost; an unasked course flown past without a medal ends quietly', async () => {
  const G = await import('../src/opus-bay/play/ggbRings');
  const zones = await import('../src/opus-bay/play/zones');
  playing();
  stubBody();
  game.set({ worldMode: 'city' });
  // lane F's move system as the game binds it: the pelican unlocked, an auto-glide (飞过去 / 带我去 on a mid trip) or not
  let auto = false;
  moveApi.bindMoveApi({ carried: false, glideUnlocked: true, toFoot: () => undefined, get autoGliding() { return auto; } });
  moveApi.setGlideUnlocked(true);
  kit.__resetKit();
  kit.__setBestWriter(null);
  const { events, off: offEv } = record();
  const off = zones.initZones();
  const g = runtime.glide;
  const before = kit.lastResultShown();
  try {
    // the review's run in the game: Crissy Field → the bridge's south end by auto-glide started the course, and the
    // landing showed ○ 再试试 · 穿过 1 / 8 个金圈
    auto = true;
    runtime.move.mode = 'glide';
    g.active = true;
    g.x = G.GGB_MID.x + 150; g.z = G.GGB_MID.z + 60; g.y = 30;
    runtime.player.x = g.x; runtime.player.z = g.z;
    stepFrameSystems(0.3, 0);
    await flushAll();
    assert.equal(flight.flightState(), null, 'no course on an auto-glide trip');
    assert.equal(flight.startFirstFlight({ course: 'ggb' }), false, 'nor started by hand while one flies');
    // the player's own glide by the bridge: it starts
    auto = false;
    stepFrameSystems(0.3, 0);
    await flushAll();
    assert.equal(flight.flightState()?.course, 'ggb');
    // then a trip takes the wings mid-course: it ends at no cost, no card, no medal
    auto = true;
    flight.step(1 / 30);
    assert.equal(flight.flightState(), null);
    assert.equal(kit.lastResultShown(), before, 'no card');
    assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && `${e.activity}:${e.what}`), [`${G.GGB_ID}:start`, `${G.GGB_ID}:cancel`]);
    // an unasked course flown past (no ring, or fewer than a medal's three): the landing ends it quietly
    auto = false;
    for (const rings of [0, 2]) {
      events.length = 0;
      assert.equal(flight.startFirstFlight({ course: 'ggb' }), true);
      const s = flight.flightState()!;
      for (let i = 0; i < rings; i++) { const r = s.rings[i]; g.x = r.x + 2; g.z = r.z; g.y = r.y; flight.step(1 / 30); }
      assert.equal(s.got, rings);
      g.x = G.GGB_MID.x + 150; g.z = G.GGB_MID.z + 60;
      emit({ type: 'glide:land', x: g.x, z: g.z });
      assert.equal(flight.flightState(), null);
      assert.equal(kit.lastResultShown(), before, `${rings} rings: no 再试试 card`);
      assert.equal(events.filter(e => e.type === 'reward').length, 0);
      assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && e.what), ['start', 'cancel']);
    }
    // the first flight too: a trip picked on the map mid-flight ends it at no cost
    g.x = flight.COIT_COURSE[0].x; g.z = flight.COIT_COURSE[0].z; runtime.player.x = g.x; runtime.player.z = g.z;
    events.length = 0;
    assert.equal(flight.startFirstFlight(), true);
    assert.equal(flight.flightState()?.course, 'coit');
    auto = true;
    flight.step(1 / 30);
    assert.equal(flight.flightState(), null);
    assert.equal(events.filter(e => e.type === 'reward').length, 0);
  } finally { off(); offEv(); flight.skipFirstFlight(); moveApi.bindMoveApi(null); g.active = false; runtime.move.mode = 'foot'; kit.unregisterResultOverlay(); kit.__resetKit(); charApiMod.setCharApi(null); flow.set({ bubble: null }); game.set({ worldMode: 'district' }); playing(); }
});

test('W5-A-review leaving the city: an activity still running ends at no cost and lets go of the feet; a seat is stood up', async () => {
  const index = await import('../src/opus-bay/play/index');
  const sit = await import('../src/opus-bay/play/sit');
  playing();
  const calls = stubBody();
  kit.__resetKit();
  const off = index.init();
  const { events, off: offEv } = record();
  try {
    // an activity hold is "self-explained" to lane F's lock watchdog (it never drops one): a run left behind held the feet
    const run = kit.startActivity({ id: 'test-leave', name: { zh: '测试', en: 'Test' } }, { lock: true });
    assert.ok(run && lockHeld());
    off();
    assert.equal(lockHeld(), false, 'the activity hold went with the city');
    assert.equal(kit.currentActivity(), null);
    assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && `${e.activity}:${e.what}`), ['test-leave:start', 'test-leave:cancel']);
    // a seat held when the city goes: stood up (lane F's body lets go)
    assert.equal(sit.sitHere(), true);
    calls.length = 0;
    sit.resetSit();
    assert.equal(sit.seated(), null);
    assert.ok(calls.includes('stand'));
  } finally { offEv(); kit.__resetKit(); sit.resetSit(); charApiMod.setCharApi(null); flow.set({ bubble: null }); playing(); }
});

test('W5-A-review reset progress (Settings): the session\'s bests and medals, the view finds, the crests and the step counter start over with the fresh save', async () => {
  const index = await import('../src/opus-bay/play/index');
  const sit = await import('../src/opus-bay/play/sit');
  const zones = await import('../src/opus-bay/play/zones');
  const C = await import('../src/opus-bay/play/crests');
  const { clearSave } = await import('../src/opus-bay/data/save');
  playing();
  stubBody();
  kit.__resetKit();
  kit.__setBestWriter(null);
  zones.__resetSteps();
  C.__resetCrests();
  const off = index.init();
  const offZ = zones.initZones();
  await flushAll();
  const { events, off: offEv } = record();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    // a run with a medal and a best
    const spec = { id: 'test-reset', name: { zh: '测试', en: 'Test' }, better: 'higher' as const };
    kit.startActivity(spec)!.end({ tier: 1, score: 5, card: false });
    assert.equal(kit.bestOf('test-reset'), 5);
    assert.deepEqual(events.filter(e => e.type === 'reward').map(e => e.type === 'reward' && e.source), ['medal:test-reset:1']);
    // a view found (the slow look), a crest hopped, steps climbed
    const spot = views.viewSpotById('twin-peaks')!;
    runtime.player.x = spot.x; runtime.player.z = spot.z;
    sit.sitAtSpot(spot);
    for (let i = 0; i < 6; i++) stepFrameSystems(1, 0);
    skipCinema();
    stepCinema(0.1);
    sit.standUp();
    assert.equal(sit.firstFind('twin-peaks'), false);
    C.crestHop(3);
    assert.equal(C.crestCount(), 1);
    zones.addStairRise(2);
    assert.equal(zones.stepsToday(), 58);
    // Settings → 重置进度
    events.length = 0;
    clearSave();
    assert.equal(kit.bestOf('test-reset'), undefined, 'no old best');
    assert.equal(sit.firstFind('twin-peaks'), true, 'the view pays again in the fresh save');
    assert.equal(C.crestCount(), 0, 'the crests start over (a next hop is 1 / 12, not the old set + 1)');
    assert.equal(zones.stepsToday(), 0, 'the step counter starts over (its next save would write the old count back)');
    assert.equal(zones.stepsTotal(), 0);
    kit.startActivity(spec)!.end({ tier: 1, score: 3, card: false });
    assert.deepEqual(events.filter(e => e.type === 'reward').map(e => e.type === 'reward' && e.source), ['medal:test-reset:1'], 'the medal is asked for again');
    assert.equal(kit.bestOf('test-reset'), 3);
  } finally { mock.timers.reset(); offEv(); offZ(); off(); C.__resetCrests(); zones.__resetSteps(); sit.resetSit(); kit.__resetKit(); charApiMod.setCharApi(null); flow.set({ bubble: null }); playing(); }
});

test('W5-A-review 滑草 never over a seat: seated on a steep lawn (or at its view spot, whose prompt goes while you sit there), the E prompt is not the sled', async () => {
  const index = await import('../src/opus-bay/play/index');
  const sit = await import('../src/opus-bay/play/sit');
  const z3 = await import('../src/opus-bay/play/zones3');
  const DOLORES = { x: 253, z: 717 };
  await cityAround([DOLORES], 40);
  playing();
  stubBody();
  game.set({ worldMode: 'city' });
  const off = index.init();
  const off3 = z3.initZones3();
  await flushAll();
  try {
    runtime.player.x = DOLORES.x; runtime.player.z = DOLORES.z; runtime.player.y = T.heightAt(DOLORES.x, DOLORES.z);
    stepFrameSystems(0.3, 0);
    assert.equal(z3.sledIt.x, DOLORES.x, '滑草 offered standing there');
    assert.equal(sit.sitHere(), true);
    assert.equal(index.seatedNow(), true);
    stepFrameSystems(0.3, 0);
    assert.equal(z3.sledIt.x, 1e7, 'not over the seat');
    sit.standUp();
    stepFrameSystems(0.3, 0);
    assert.equal(z3.sledIt.x, DOLORES.x, 'back once standing');
  } finally { off3(); off(); sit.resetSit(); T.setCityTerrain(null); charApiMod.setCharApi(null); flow.set({ bubble: null }); game.set({ worldMode: 'district' }); playing(); }
});
