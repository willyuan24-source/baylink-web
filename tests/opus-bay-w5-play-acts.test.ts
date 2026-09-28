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
    ...CITY_POIS.map(p => ({ id: `poi ${p.id}`, ...p.position })),
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
