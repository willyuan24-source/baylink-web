import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 8 · lane K · W8-K5 — the seated Hyde St rider under a canopy (W7-K1's open item): the street trees' leaves carry
 * aInfo.x 11 and TOY_FRAG thins them to a dither along the camera's last 3.5 u to the player's chest
 * (the city-only GLSL block data/sf/cityShaders.ts toyCanopy, lane P's W8-P1 layout), switched on by CityProps
 * (U.uCanopy.w) only while a canopy hangs over / beside the player and the occlusion fade is on. No new draw call (the
 * same InstancedMeshes, the same program); the district has no tagged leaves and compiles without the block. And
 * treesNear walks the resident chunks without an iterator (Map.forEach).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;

const { CityProps, CANOPY_INFO, CANOPY_FADE_REACH, CANOPY_CAM_NEAR } = await import('../src/opus-bay/world/sf/props');
const { U, TOY_FRAG, COMMON_FRAG_PARS } = await import('../src/opus-bay/world/materials');
const { CITY_SHADERS } = await import('../src/opus-bay/world/cityShaderSlot');

function propsWith(pts: { x: number; z: number; y?: number; kind?: number; variant?: number }[]) {
  const props = new CityProps();
  props.setSource(3, {
    count: pts.length, kind: Uint8Array.from(pts.map(p => p.kind ?? 0)), variant: Uint8Array.from(pts.map(p => p.variant ?? 0)),
    xyzr: Float32Array.from(pts.flatMap(p => [p.x, p.y ?? 0, p.z, 0])),
  });
  return props;
}

test('W8-K5 the leaves (not the trunks, not the lamps) carry aInfo.x 11; the shader thins only those, in front of the player', () => {
  const props = propsWith([{ x: 0, z: 0 }]);
  props.update(0, 0, 1);
  const layers = props.group.children.filter(o => (o as { isInstancedMesh?: boolean }).isInstancedMesh) as unknown as { name: string; geometry: { getAttribute(n: string): { count: number; getX(i: number): number } } }[];
  const tagged = (name: string) => {
    const a = layers.find(l => l.name === name)!.geometry.getAttribute('aInfo');
    let leaf = 0, other = 0;
    for (let i = 0; i < a.count; i++) if (a.getX(i) === CANOPY_INFO) leaf++; else other++;
    return { leaf, other };
  };
  for (const n of ['city-trees', 'city-cypress', 'city-pines', 'city-palms']) {
    const t = tagged(n);
    assert.ok(t.leaf > 0 && t.other > 0, `${n}: leaves tagged, the trunk not (${t.leaf} / ${t.other})`);
  }
  assert.equal(tagged('city-lamps').leaf, 0, 'lamps untouched');
  assert.equal(tagged('city-lollipops').leaf, 0, 'the far ring untouched');
  assert.ok(COMMON_FRAG_PARS.includes('uniform vec4 uCanopy;'));
  const blk = CITY_SHADERS.toyCanopy;
  assert.ok(blk.includes('if (uCanopy.w > 0.5 && abs(vInfo.x - 11.0) < 0.5) {'), 'the canopy branch (a city block)');
  assert.equal(TOY_FRAG.split(blk).length, 2, 'spliced into TOY_FRAG once');
  // inside the non-hero block (the heroes fade whole), right after the occlusion fade
  const hero = TOY_FRAG.indexOf('#ifdef OB_HERO'), other = TOY_FRAG.indexOf('#else', hero), at = TOY_FRAG.indexOf(blk);
  assert.ok(hero >= 0 && other > hero && at > other && at < TOY_FRAG.indexOf('#endif', other), 'in the #else of OB_HERO');
  props.dispose();
});

test('W8-K5 the dither is on only with a canopy over / beside the player, the camera near, the occlusion fade on, in the city', () => {
  U.uFade.value = 1;
  // a kerb tree 1.1 u beside the seated rider (Hyde St), its ground 0.9 u under the bench (the rider's feet at y 0.9)
  const props = propsWith([{ x: 1.1, z: 0, y: 0 }, { x: 40, z: 0 }]);
  assert.equal(props.stepCanopyFade(0, 0.9, 0), true, 'the overhanging canopy switches it on');
  assert.equal(U.uCanopy.value.w, 1);
  assert.ok(Math.abs(U.uCanopy.value.y - 1.8) < 1e-6 && U.uCanopy.value.x === 0, 'centred on the chest');
  assert.equal(props.stepCanopyFade(0, 0.9, 6), false, `${6} u along the street: off (reach ${CANOPY_FADE_REACH})`);
  assert.equal(U.uCanopy.value.w, 0);
  assert.equal(props.stepCanopyFade(1, 30, 0), false, 'a tree far below the player (down the hill) does not count');
  // the follow camera on foot (high, ≈ 12 u off) keeps the occlusion fade alone; the ride's bench shot (≈ 4 u) gets it
  U.uCam.value.set(0, 10.8, 8);
  assert.equal(props.stepCanopyFade(0, 0.9, 0), false, `the camera ${CANOPY_CAM_NEAR}+ u off: off`);
  U.uCam.value.set(3.5, 1.8, 2);
  assert.equal(props.stepCanopyFade(0, 0.9, 0), true, 'the bench shot: on');
  U.uCam.value.set(0, 0, 0);
  U.uFade.value = 0;
  assert.equal(props.stepCanopyFade(0, 0.9, 0), false, 'photo mode / SoloView (uFade 0): off');
  U.uFade.value = 1;
  props.stepCanopyFade(0, 0.9, 0);
  props.dispose();
  assert.equal(U.uCanopy.value.w, 0, 'the city gone (district): off');
});

test('W8-K5 treesNear walks the chunks without an iterator and answers as before', () => {
  const props = propsWith([{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 30, z: 0 }]);
  const seen: number[] = [];
  props.treesNear(0, 0, 2, c => { seen.push(Math.round(c.x)); });
  assert.deepEqual(seen.sort((a, b) => a - b), [0, 3]);
  // no `for (… of this.sources)` left in the per-frame queries
  const src = (props as unknown as { treesNear: { toString(): string } }).treesNear.toString();
  assert.ok(!/of this\.sources/.test(src) && /forEach/.test(src), src.slice(0, 200));
  props.dispose();
});
