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
  const lazyOnes = ['firstFlight.ts', 'rings.ts', 'FlightChip.tsx', 'ResultCard.tsx'];
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
const { emit, onEvent } = await import('../src/opus-bay/core/events');
const charApiMod = await import('../src/opus-bay/actors/charApi');
const moveApi = await import('../src/opus-bay/actors/moveApi');
const slots = await import('../src/opus-bay/ui/slots');
const kit = await import('../src/opus-bay/play/kit');

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
    assert.ok(calls.includes('box:first-flight:on'), 'the soft box keeps the pelican near the course');
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
    s = flight.flightState()!;
    assert.equal(s.got, 7);
    assert.equal(s.rings[2].missed, true);
    assert.equal(s.phase, 'finale');
    const paid = events.filter(e => e.type === 'reward').map(e => e.type === 'reward' && `${e.source}:${e.coins}`);
    assert.deepEqual(paid, [1, 2, 4, 5, 6, 7, 8].map(n => `ring:first-flight:${n}:3`));
    // landing ends it: the card (7 of 8 → 很好), the medals up to tier 2, the best
    emit({ type: 'glide:land', x: 0, z: 0 });
    assert.equal(flight.flightState(), null);
    const card = kit.lastResultShown()!;
    assert.equal(card.tier, 2);
    assert.deepEqual(card.detail, { zh: '穿过 7 / 8 个金圈', en: '7 of 8 rings' });
    assert.ok(!slots.openOverlays().some(o => o.id === flight.CHIP_OVERLAY), 'the chip went');
    assert.ok(calls.includes('box:first-flight:off'));
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
