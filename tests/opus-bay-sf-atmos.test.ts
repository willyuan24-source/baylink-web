import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';

/**
 * Lane C2-4 (city haze, CS-2): cityFogK is a pure density multiplier — 1 for a walking camera below y 15, much
 * clearer high up and on the Twin Peaks summit, morning still the softest — and fog stays a uniform (the shared
 * THREE.ShaderChunk is never touched: the site's Little Bay uses the same three).
 */

// every shader chunk as three ships it, before any Opus Bay module is loaded
const CHUNKS_BEFORE = JSON.stringify(THREE.ShaderChunk);

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop), set: () => true });
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { CITY_FOG, cityFogK, fogFactor, KarlState: CityKarl } = await import('../src/opus-bay/world/sf/fog');
const { Environment } = await import('../src/opus-bay/world/environment');
const { TIME_PRESETS } = await import('../src/opus-bay/world/palette');

const TODS = ['morning', 'day', 'golden', 'night'] as const;

test('walking stays exactly as today: k = 1 below y 15 (any ground, any time)', () => {
  for (const tod of TODS) for (const y of [2, 6, 10, 14.9]) for (const ground of [0, 3, 8]) assert.equal(cityFogK(y, ground, tod), 1, `${tod} y ${y}`);
});

test('the Twin Peaks summit and high views are much clearer; morning stays the softest', () => {
  // summit walking camera ≈ y 55 over ground 45; high QA view y 115 over 45; 250 u view
  for (const tod of TODS) {
    const summit = cityFogK(55, 45, tod), high = cityFogK(115, 45, tod), top = cityFogK(250, 45, tod);
    assert.ok(summit < 0.62 && summit > 0.2, `${tod} summit ${summit.toFixed(3)}`);
    assert.ok(high < summit && top <= high, `${tod}: higher is clearer`);
    assert.ok(top >= 0.07, `${tod}: never fog-free (${top.toFixed(3)})`);
  }
  // downtown (≈ 900 u) seen from the summit: golden / day clear, morning soft but no longer a white-out
  const f = (tod: (typeof TODS)[number]) => fogFactor(TIME_PRESETS[tod].fogDensity * cityFogK(55, 45, tod), 900);
  assert.ok(f('golden') < 0.35 && f('day') < 0.35, `golden ${f('golden').toFixed(2)} day ${f('day').toFixed(2)}`);
  assert.ok(f('morning') > f('golden') && f('morning') > 0.45 && f('morning') < 0.75, `morning ${f('morning').toFixed(2)}`);
  assert.ok(f('night') < f('golden'), 'night: the lit city reads from the hills');
  // before (the old ground-only thinning): the summit got none and downtown sat under 62–98 % fog
  assert.ok(fogFactor(TIME_PRESETS.golden.fogDensity, 900) > 0.65);
});

test('k is continuous and never grows with altitude or height (no pumping while climbing)', () => {
  for (const tod of TODS) {
    let prev = Infinity;
    for (let y = 0; y <= 300; y += 0.5) {
      const k = cityFogK(y, 20, tod);
      assert.ok(k <= prev + 1e-12, `${tod} y ${y}`);
      assert.ok(prev === Infinity || prev - k < 0.02, `${tod} jump at y ${y}`);
      prev = k;
    }
  }
  assert.equal(CITY_FOG.altitude.y0, 20);
});

test('fog stays a uniform: the city Environment scales FogExp2.density, THREE.ShaderChunk is untouched', () => {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '../node_modules/three/src/renderers/shaders/ShaderChunk/fog_fragment.glsl.js'), 'utf8');
  const squash = (x: string) => x.replace(/\s+/g, ' ').trim();
  assert.equal(squash(THREE.ShaderChunk.fog_fragment), squash(/`([\s\S]*)`/.exec(src)![1]));
  assert.equal(JSON.stringify(THREE.ShaderChunk), CHUNKS_BEFORE);
  // city mode: the world hands the Environment the city chunk's KarlState / cityFogK (wave 3, P7)
  const env = new Environment('city', { KarlState: CityKarl, cityFogK });
  assert.ok(env.karl, 'city: Karl');
  assert.equal(new Environment('district').karl, null, 'district: no Karl at all');
  env.setTime('golden', true);
  env.groundAt = () => 45;
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(128, 55, 922);
  for (let i = 0; i < 60; i++) env.update(0.1, cam, new THREE.Vector3(128, 45, 922));
  const want = TIME_PRESETS.golden.fogDensity * cityFogK(55, 45, 'golden');
  assert.ok(Math.abs(env.fog.density - want) < want * 0.01, `density ${env.fog.density} vs ${want}`);
  cam.position.set(128, 8, 922);
  env.groundAt = () => 0;
  for (let i = 0; i < 60; i++) env.update(0.1, cam, new THREE.Vector3(128, 0, 922));
  assert.ok(Math.abs(env.fog.density - TIME_PRESETS.golden.fogDensity) < 1e-7, 'walking: the preset density');
  // district: never scaled
  const d = new Environment('district');
  d.setTime('golden', true);
  cam.position.set(0, 200, 0);
  d.update(0.1, cam, new THREE.Vector3());
  assert.equal(d.fog.density, TIME_PRESETS.golden.fogDensity);
  assert.equal(JSON.stringify(THREE.ShaderChunk), CHUNKS_BEFORE);
});

// ---------------------------------------------------------------------------
// Karl the Fog (C2-8) and the night light field (C2-9)
// ---------------------------------------------------------------------------

const { KARL, KARL_TIME, KarlState, karlCover, karlTarget, parseKarlFlag, patchFog } = await import('../src/opus-bay/world/sf/fog');
const { GROUND, TOY, patchToyShader } = await import('../src/opus-bay/world/materials');

const P = {
  sunset: [-243, 12, 1306], richmond: [-436, 18, 949], oceanBeach: [-400, 4, 1480], downtown: [137, 10, 133], mission: [195, 12, 648],
  tpSummit: [126, 55, 938], ggbDeck: [-865.8, 15.2, 508.6], ggbTop: [-796.1, 42.2, 564.4], offshore: [-900, 2, 1900],
} as const;
const cover = (k: keyof typeof P, tod: (typeof TODS)[number]) => karlCover(P[k][0], P[k][1], P[k][2], karlTarget(tod, null));

test('Karl: patchFog edits one material\'s own shader (THREE.ShaderChunk byte-identical), once, keeping three\'s fog after it', () => {
  const std = () => ({ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} as Record<string, THREE.IUniform> });
  const toy = std();
  patchToyShader(toy, { sway: true });
  const ground = std();
  GROUND.onBeforeCompile(ground as never, undefined as never);
  const generic = std();
  patchFog(generic);
  patchFog(generic);
  for (const [name, s] of [['toy', toy], ['ground', ground], ['generic', generic]] as const) {
    assert.equal(s.fragmentShader.split('obKarlCover(vec3 w)').length, 2, `${name}: Karl's GLSL once`);
    assert.equal(s.fragmentShader.split('#include <fog_fragment>').length, 2, `${name}: three's fog include kept`);
    assert.ok(s.fragmentShader.indexOf('obKarl(') < s.fragmentShader.lastIndexOf('#include <fog_fragment>'), `${name}: Karl, then the haze`);
    assert.equal(s.uniforms.uKarl, KARL.uKarl, `${name}: shared uniform`);
  }
  assert.ok(toy.fragmentShader.includes('obKarl(vWPos, vFogDepth)') && ground.fragmentShader.includes('obKarl(vWPos, vFogDepth)'));
  assert.ok(generic.vertexShader.includes('vObKarlW = cameraPosition + mvPosition.xyz * mat3(viewMatrix);') && generic.fragmentShader.includes('obKarl(vObKarlW, vFogDepth)'));
  // TOY ≡ patchToyShader still holds (the frozen contract), with Karl inside
  const a = std();
  TOY.onBeforeCompile(a as never, undefined as never);
  assert.equal(a.fragmentShader, toy.fragmentShader);
  // no fog include → untouched
  const none = { vertexShader: 'void main() {}', fragmentShader: 'void main() {}', uniforms: {} };
  patchFog(none);
  assert.equal(none.fragmentShader, 'void main() {}');
  assert.equal(JSON.stringify(THREE.ShaderChunk), CHUNKS_BEFORE);
});

test('Karl: time table (morning 1, day 0.15, golden 0.6, night 0.35) and ?karl=0|1', () => {
  assert.deepEqual(TODS.map(t => KARL_TIME[t].level), [1, 0.15, 0.6, 0.35]);
  for (const t of TODS) {
    assert.equal(karlTarget(t, 0).level, 0, `${t}: ?karl=0 is off`);
    assert.ok(karlTarget(t, 1).level >= 0.6, `${t}: ?karl=1 is on`);
    assert.equal(karlTarget(t, null).level, KARL_TIME[t].level);
  }
  assert.ok(karlTarget('day', 1).front > 0, '?karl=1 by day: the bank comes in');
  assert.deepEqual(['0', '1', 'x', null].map(parseKarlFlag), [0, 1, null, null]);
});

test('Karl: pools over the Sunset / Richmond, through the Gate at golden hour, never downtown or on the summit', () => {
  for (const k of ['sunset', 'richmond', 'oceanBeach'] as const) assert.ok(cover(k, 'morning') > 0.9, `morning ${k} ${cover(k, 'morning')}`);
  for (const t of TODS) for (const k of ['downtown', 'mission', 'tpSummit'] as const) assert.equal(cover(k, t), 0, `${t} ${k}`);
  assert.ok(cover('ggbDeck', 'golden') > 0.9 && cover('ggbDeck', 'morning') > 0.7, 'the deck is in the Gate tongue');
  assert.equal(cover('ggbTop', 'golden'), 0, 'the towers stand above it');
  assert.ok(cover('oceanBeach', 'golden') > 0.5 && cover('richmond', 'golden') < 0.05, 'golden: only the outer avenues');
  assert.ok(cover('sunset', 'day') === 0 && cover('offshore', 'day') > 0.9, 'day: waits offshore');
});

test('Karl: district never turns it on; the city slides between layouts in KARL_SLIDE s', () => {
  const cam = new THREE.PerspectiveCamera();
  KARL.uKarl.value = 0; // a page is one mode (the city Environment above wrote the shared uniform)
  const d = new Environment('district');
  d.setTime('morning', true);
  for (let i = 0; i < 20; i++) d.update(0.1, cam, new THREE.Vector3());
  assert.equal(KARL.uKarl.value, 0, 'district: uKarl stays 0');
  const k = new KarlState();
  k.setTime('golden', true);
  k.update(0.016);
  assert.equal(k.cur.level, 0.6);
  const epoch = k.epoch;
  k.setTime('morning', false);
  assert.equal(k.epoch, epoch + 1);
  k.update(10);
  assert.ok(k.cur.front > KARL_TIME.golden.front && k.cur.front < KARL_TIME.morning.front, `sliding: ${k.cur.front}`);
  for (let i = 0; i < 40; i++) k.update(1);
  assert.equal(k.t, 1);
  assert.equal(k.cur.front, KARL_TIME.morning.front);
  assert.equal(KARL.uKarl.value, 1);
  assert.equal(KARL.uKarlA.value.x, KARL_TIME.morning.front);
  k.setFlag(0);
  assert.equal(KARL.uKarl.value, 0, '?karl=0 is off at once');
  k.setFlag(null);
  KARL.uKarl.value = 0;
});

const { CLOUD_BANK, CloudBank, cloudSlots } = await import('../src/opus-bay/world/sf/cloudBank');

test('Karl: the cloud bank is 40–80 clusters on one TOY_INST_TINT InstancedMesh, ≤ 12k triangles, sitting inside Karl', async () => {
  const { TOY_INST_TINT } = await import('../src/opus-bay/world/materials');
  assert.ok(CLOUD_BANK.count >= 40 && CLOUD_BANK.count <= 80);
  const k = new KarlState();
  k.setTime('morning', true);
  const bank = new CloudBank(k);
  assert.equal(bank.mesh.material, TOY_INST_TINT, 'the tinted twin of TOY_INST (wave 3, P2: one material instance per object kind)');
  assert.equal(bank.mesh.count, CLOUD_BANK.count);
  assert.equal(bank.mesh.castShadow, false);
  assert.ok(bank.mesh.instanceColor, 'the props\' tinted instanced program (instanceColor, warmed up)');
  assert.ok(bank.mesh.geometry.getAttribute('aInfo'), 'TOY_INST reads aInfo');
  assert.ok(bank.triangles <= 12000 && bank.triangles >= 8000, `triangles ${bank.triangles}`);
  const cam = new THREE.PerspectiveCamera(50, 1.6, 0.5, 3000);
  cam.position.set(140, 115, 1000);
  cam.lookAt(-420, 0, 1180); // Twin Peaks → the Sunset
  bank.update(0.016, 0, cam);
  assert.ok(bank.mesh.visible && bank.mesh.count > CLOUD_BANK.count / 3, `in view: ${bank.mesh.count}`);
  const west = bank.mesh.count;
  cam.lookAt(137, 0, 133); // → downtown: the clusters behind the camera are not drawn
  bank.update(0.016, 0, cam);
  assert.ok(bank.mesh.count < west, `culled per cluster: ${bank.mesh.count} < ${west}`);
  for (const tod of TODS) {
    const t = karlTarget(tod, null);
    const slots = cloudSlots(t);
    assert.equal(slots.length, CLOUD_BANK.count);
    const inside = slots.filter(s => karlCover(s.x, t.top - 12, s.z, t) > 0.5).length;
    assert.ok(inside >= slots.length * 0.9, `${tod}: ${inside}/${slots.length} clusters over Karl`);
    // never over downtown / the Mission (east of the front by far)
    assert.ok(slots.every(s => (s.x - 137) ** 2 + (s.z - 133) ** 2 > 400 ** 2 && (s.x - 195) ** 2 + (s.z - 648) ** 2 > 250 ** 2), `${tod}: clear of downtown`);
  }
  k.setFlag(0);
  bank.update(0.016, 0, cam);
  assert.equal(bank.mesh.visible, false, '?karl=0: no clouds, no draw call');
  bank.dispose();
  KARL.uKarl.value = 0;
});

const { streetLamps, ggbLights, LightField, LIGHT_FIELD } = await import('../src/opus-bay/world/sf/lights');
const { asphaltInfo, STREET_LAMP } = await import('../src/opus-bay/world/sf/look');
const { sfDisk } = await import('./opus-bay-sf-disk');

test('night light field: ≥ 10k street lamps from far.lines + the GGB, one Points draw, hidden by day', async () => {
  const far = await sfDisk().far();
  const lamps = streetLamps(far.lines);
  assert.ok(lamps.length >= 10000 && lamps.length <= 20000, `lamps ${lamps.length}`);
  const ggb = ggbLights();
  assert.ok(ggb.length >= 100, `GGB lights ${ggb.length}`);
  // the deck lights run between the two towers at the deck height
  const deck = ggb.filter(l => Math.abs(l.y - 17.5) < 0.1);
  assert.ok(deck.some(l => Math.hypot(l.x + 865.8, l.z - 508.6) < 8), 'a deck light at mid-span');
  assert.ok(ggb.some(l => l.level >= 2 && l.y > 42), 'blinking aviation lights on the tower tops');
  const renderer = { getDrawingBufferSize: (v: THREE.Vector2) => v.set(960, 600) } as unknown as THREE.WebGLRenderer;
  const field = new LightField(renderer, { siteLights: () => [] });
  field.setFar(far);
  assert.equal(field.count, lamps.length + ggb.length);
  assert.equal(field.group.children.length, 1, 'one Points object');
  const cam = new THREE.PerspectiveCamera(50);
  field.update(0.1, 0, cam, 0);
  assert.equal(field.visible, false, 'by day: hidden (0 calls)');
  field.update(0.1, 0, cam, 1);
  assert.equal(field.visible, true, 'at night: on');
  assert.ok((LIGHT_FIELD.uniforms.uPx.value as number) > 500);
  field.dispose();
});

test('night street glow: lit classes bake (arc length, side, GROUND_CITY + lamp level) into the asphalt', () => {
  assert.deepEqual([STREET_LAMP.primary, STREET_LAMP.secondary, STREET_LAMP.tertiary], [1, 0.7, 0.5]);
  const lit = asphaltInfo('primary', 4, 5, 1);
  assert.equal(typeof lit, 'function');
  assert.deepEqual((lit as (s: number, o: number) => readonly number[])(12, -4), [5, 12, -1, 2]);
  assert.deepEqual(asphaltInfo('residential', 4, 5, 1), [5, 0, 0, 1], 'unlit: plain city asphalt');
  const g = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
  GROUND.onBeforeCompile(g as never, undefined as never);
  assert.ok(g.fragmentShader.includes('vInfo.w > 1.05'), 'the glow only runs on lit city streets (hero ground has w = 0)');
});
