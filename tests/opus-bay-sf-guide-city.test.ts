import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';

/**
 * Wave 4 · lane G integration (part a): the city guidance runtime (game/guideCity.ts) as the projector and the Overlay
 * use it — the city waypoint layout written into the DOM, the trip time from the player's position, the arrival beats
 * (lane C's flow.arrival) turned into the toast / card / panorama, the chevron material on the warmed TOY_INST program,
 * and the bundle rule (the city guidance is imported dynamically, never from GameRoot's static graph).
 */

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/opus-bay?world=city', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node });
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const THREE = await import('three');
const G = await import('../src/opus-bay/game/guideCity');
const { flow } = await import('../src/opus-bay/game/flowStore');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { TOY_INST } = await import('../src/opus-bay/world/materials');
const { ATTRACTION_INDEX } = await import('../src/opus-bay/data/sf/attractions');
styles.deregister();

const root = path.resolve(import.meta.dirname, '..');
const src = (p: string) => readFileSync(path.join(root, 'src/opus-bay', p), 'utf8');

function waypointDom() {
  const wp = document.createElement('div');
  const lab = document.createElement('span');
  wp.appendChild(lab);
  document.body.appendChild(wp);
  // JSDOM has no layout: the label reports the width a 13 px label would have
  Object.defineProperty(lab, 'offsetWidth', { get: () => 8 * (lab.textContent ?? '').length + 20 });
  return { wp, lab };
}

function camera(w: number, h: number) {
  const cam = new THREE.PerspectiveCamera(50, w / h, 0.5, 3000);
  cam.position.set(0, 12, 20);
  cam.lookAt(0, 0, -40);
  cam.updateMatrixWorld();
  return cam;
}

test('city waypoint: a target ahead is a pin with its full label; BAYBAY\'s bubble over the label drops it or shortens it, never overlapping', () => {
  runtime.player.x = 0; runtime.player.z = 0;
  const { wp, lab } = waypointDom();
  const W = 390, H = 844;
  const cam = camera(W, H);
  const target = { x: 0, z: -80, id: 'place:x', name: { zh: '艺术宫', en: 'Palace of Fine Arts' } };
  const base = { camera: cam, w: W, fullW: W, h: H, mobile: true, now: 1000, target, boxes: [], bubble: null, wp, lab, plainTime: () => ({ zh: '约 20 秒', en: '~20s' }), pick: (b: { zh: string }) => b.zh };
  G.cityWaypoint(base);
  assert.equal(wp.dataset.show, '1');
  assert.equal(wp.dataset.edge, '0');
  assert.equal(wp.dataset.label, 'full');
  assert.equal(lab.textContent, '艺术宫 · 约 20 秒');
  const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(wp.style.transform)!;
  const x = Number(m[1]), y = Number(m[2]);
  assert.equal(Number(wp.style.getPropertyValue('--ob-label-dy').replace('px', '')), 16, 'the label under the pin');
  // the bubble right where the label would go (clear of the pin itself): the label drops below it; never under it
  const bubble = { l: x - 120, r: x + 120, t: y + 16, b: y + 56 };
  G.cityWaypoint({ ...base, now: 2000, bubble });
  assert.equal(wp.dataset.show, '1');
  assert.equal(wp.dataset.label, 'full', 'dropped below the bubble with its full words');
  if (wp.dataset.label !== 'none') {
    const ldy = Number(wp.style.getPropertyValue('--ob-label-dy').replace('px', ''));
    const top = y + ldy;
    assert.ok(top >= bubble.b + 5, `label top ${top} clears the bubble bottom ${bubble.b}`);
  }
  if (wp.dataset.label === 'short') assert.equal(lab.textContent, '约 20 秒');
  wp.remove();
});

test('city waypoint: a target behind the camera is an edge arrow inside the safe area; within 6 u it hides', () => {
  const { wp, lab } = waypointDom();
  const W = 390, H = 844;
  const cam = camera(W, H);
  runtime.player.x = 0; runtime.player.z = 0;
  const target = { x: 30, z: 200, id: 'sf:x', name: { zh: '双峰', en: 'Twin Peaks' } };
  G.cityWaypoint({ camera: cam, w: W, fullW: W, h: H, mobile: true, now: 5000, target, boxes: [], bubble: null, wp, lab, plainTime: () => ({ zh: '约 1 分钟', en: '~1 min' }), pick: (b: { zh: string }) => b.zh });
  assert.equal(wp.dataset.show, '1');
  assert.equal(wp.dataset.edge, '1');
  const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(wp.style.transform)!;
  const x = Number(m[1]), y = Number(m[2]);
  assert.ok(x >= 12 + 19 - 1 && x <= W - 12 - 19 + 1 && y >= 72 + 19 - 1 && y <= H - 124, `arrow at ${x}, ${y} inside the phone safe area`);
  G.cityWaypoint({ camera: cam, w: W, fullW: W, h: H, mobile: true, now: 6000, target: { ...target, x: 3, z: 2 }, boxes: [], bubble: null, wp, lab, plainTime: () => ({ zh: '', en: '' }), pick: (b: { zh: string }) => b.zh });
  assert.equal(wp.dataset.show, '0');
  wp.remove();
});

test('trip time from where the player stands: the walking leg along its route, a ride once aboard, the legs after it', () => {
  const walk = { via: 'walk' as const, from: { x: 0, z: 0 }, to: { x: 100, z: 0 }, seconds: 100 / 4.2, length: 100, path: [0, 0, 100, 0] };
  const ride = { via: 'line' as const, line: 'sf-loop', board: 'a', alight: 'b', wait: 10, stops: 3, from: { x: 100, z: 0 }, to: { x: 400, z: 0 }, seconds: 70, length: 300 };
  assert.ok(Math.abs(G.legSecondsLeft(walk, { x: 58, z: 0 }) - 42 / 4.2) < 1e-6, 'along the route');
  assert.ok(Math.abs(G.legSecondsLeft(walk, { x: 58, z: 3 }) - 45 / 4.2) < 1e-6, 'plus the way back onto it');
  assert.equal(G.legSecondsLeft(ride, { x: 100, z: 0 }, false), 70, 'before boarding: wait + ride');
  assert.ok(Math.abs(G.legSecondsLeft(ride, { x: 250, z: 0 }, true) - 30) < 1e-6, 'aboard, half way: half of the 60 s ride');
  const trip = { placeId: 'p', option: { mode: 'line' as const, legs: [walk, ride], seconds: 94 }, legs: [walk, ride], leg: 0, startedAt: 0 };
  assert.ok(Math.abs(G.tripSecondsLeft(trip, { x: 58, z: 0 }, false) - (42 / 4.2 + 70)) < 1e-6);
  assert.equal(G.tripSecondsLeft({ ...trip, leg: 2 }, { x: 0, z: 0 }, false), 0);
});

test('trip names: lane P\'s trip destination (the island\'s pier), the short name only on foot', () => {
  const alcatraz = ATTRACTION_INDEX.get('alcatraz');
  assert.ok(alcatraz);
  const n = G.tripNames({ placeId: 'alcatraz-landing', attraction: 'alcatraz', option: { mode: 'walk', legs: [], seconds: 0 }, legs: [], leg: 0, startedAt: 0 });
  assert.match(n.destination?.zh ?? '', /33 号码头/);
  assert.equal(n.short, null, 'an offWalk island never names itself on a pier');
  const sfsu = G.tripNames({ placeId: 'sf-state-university', attraction: 'sf-state-university', option: { mode: 'walk', legs: [], seconds: 0 }, legs: [], leg: 0, startedAt: 0 });
  assert.equal(sfsu.short?.zh, '州立大学');
});

test('arrival beats (lane C flow.arrival) → the toast now, the card, the panorama after it; a quiet arrival without toast shows nothing', async () => {
  G.initGuideCity();
  const beats = { toast: { zh: '抵达 · 双峰', en: 'Arrived · Twin Peaks' }, line: null, voice: null, mood: 'happy' as const, reveal: false, peek: true, stamp: true, stampSound: true, postcardHint: null, panorama: true, discover: true as const };
  runtime.player.x = -60; runtime.player.z = 700; runtime.camera.yaw = 0;
  flow.set({ arrival: { ...beats, attraction: 'twin-peaks', place: 'twin-peaks' } });
  assert.equal(G.guideUi.get().toast?.text.zh, '抵达 · 双峰');
  assert.equal(G.guideUi.get().card?.attraction, 'twin-peaks');
  assert.equal(G.guideUi.get().card?.tier, 1);
  await new Promise(r => setTimeout(r, 450));
  const pano = G.guideUi.get().panorama;
  assert.ok(pano && pano.tags.length > 0 && pano.tags.length <= 8, `panorama tags ${pano?.tags.length}`);
  assert.ok(G.panoramaActive());
  // a later arrival without a moment (T3 / not first) shows nothing new
  G.guideUi.set({ toast: null, card: null });
  flow.set({ arrival: { ...beats, toast: null, peek: false, panorama: false, attraction: 'twin-peaks', place: 'twin-peaks' } });
  assert.equal(G.guideUi.get().toast, null);
  assert.equal(G.guideUi.get().card, null);
  flow.set({ arrival: null });
});

test('chevrons use their own material on the warmed TOY_INST program (no new program, no shared instance)', () => {
  const s = src('game/guideCity.ts');
  assert.match(s, /customProgramCacheKey = \(\) => 'ob-toy-inst'/);
  assert.equal(TOY_INST.customProgramCacheKey(), 'ob-toy-inst');
  assert.match(s, /new THREE\.MeshStandardMaterial\(\{ vertexColors: true, roughness: 0\.86, metalness: 0 \}\)/, 'the TOY parameters (world/materials makeToy)');
});

test('bundle: the city guidance, the ride banner and the move chip are imported dynamically only (GameRoot never carries them; the district never fetches the guidance)', () => {
  for (const f of ['game/Systems.tsx', 'ui/Hud.tsx', 'ui/Overlay.tsx']) {
    const s = src(f);
    assert.doesNotMatch(s, /^import[^;]*from '\.\/guideCity'/m, `${f}: no static import of game/guideCity`);
    assert.doesNotMatch(s, /^import[^;]*from '\.\/(?:GuideLayer|RideBanner|MoveChip)'/m, `${f}: no static import of the lazy parts`);
  }
  assert.match(src('game/Systems.tsx'), /import\('\.\/guideCity'\)/);
  const parts = src('ui/lazyParts.ts');
  for (const m of ['GuideLayer', 'RideBanner', 'MoveChip']) assert.ok(parts.includes(`import('./${m}')`), m);
  // city only: Systems loads it behind cityMode(), the Overlay mounts the guidance only in city mode
  assert.ok(src('game/Systems.tsx').includes('if (guide || guideLoading || !cityMode()) return;'));
  assert.ok(src('ui/Overlay.tsx').includes('city ? <Suspense fallback={null}><GuideLeadChip /></Suspense> : <LeadChip />'));
});

test('ride banner / move chip: 提前下车 waits on a ferry under way and in a Metro tunnel, and says why; a docked ferry and the district F-line offer it', async () => {
  const { hopOffNote } = await import('../src/opus-bay/ui/rideHop');
  const T = await import('../src/opus-bay/data/transit');
  let status: Record<string, unknown> | null = { station: null };
  const fake = { request: () => null, board: () => {}, cancel: () => {}, rideStatus: () => status, cars: [] };
  T.setActiveFerrySystem(fake as never);
  T.setActiveCableSystem(fake as never);
  try {
    assert.equal(hopOffNote({ stage: 'riding', from: 'a', to: 'b' }, {}), null, 'the hero F-line (no line id)');
    assert.equal(hopOffNote({ stage: 'riding', from: 'ferry-building', to: 'pier-41', line: 'ferry', kind: 'ferry' }, {})?.zh, '到站再下');
    status = { station: 'pier-41' };
    assert.equal(hopOffNote({ stage: 'riding', from: 'ferry-building', to: 'pier-41', line: 'ferry', kind: 'ferry' }, {}), null, 'docked');
    status = { station: null, canHopOff: false, portalWait: false };
    assert.equal(hopOffNote({ stage: 'riding', from: 'a', to: 'b', line: 'n-judah', kind: 'light-rail' }, {})?.zh, '隧道里不能下车');
    status = { station: null, canHopOff: false, portalWait: true };
    assert.equal(hopOffNote({ stage: 'riding', from: 'a', to: 'b', line: 'n-judah', kind: 'light-rail' }, {})?.zh, '马上出隧道…');
    // the line's own words (lane T lineRideLabel) win
    assert.equal(hopOffNote({ stage: 'riding', from: 'a', to: 'b', line: 'n-judah', kind: 'light-rail' }, { canHopOff: false, hopOffNote: { zh: '隧道里不能下车', en: 'x' } })?.en, 'x');
    status = { station: null, canHopOff: true };
    assert.equal(hopOffNote({ stage: 'riding', from: 'a', to: 'b', line: 'powell-hyde', kind: 'cable-car' }, {}), null);
  } finally {
    T.setActiveFerrySystem(null);
    T.setActiveCableSystem(null);
  }
});
