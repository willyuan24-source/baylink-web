import assert from 'node:assert/strict';
import test from 'node:test';
import type * as THREE_NS from 'three';

/**
 * Wave 8 · lane P (first load & lazy chunks): the city-only parts that leave GameRoot's chunk answer exactly what they
 * answered before — the city's programs splice the moved GLSL back where it was, and the district never feeds those
 * branches (so its programs without them draw the same pixels).
 */

// --- headless canvas stub (world modules create label atlases / board-shadow canvases at import) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const THREE = await import('three');
const { CITY_SHADERS } = await import('../src/opus-bay/world/cityShaderSlot');
const { CITY_DATA } = await import('../src/opus-bay/data/sf/cityData');
const M = await import('../src/opus-bay/world/materials');
const { Environment } = await import('../src/opus-bay/world/environment');

const once = (hay: string, needle: string, what: string) => {
  assert.ok(needle.length > 50, `${what}: a real block (${needle.length} chars)`);
  assert.equal(hay.split(needle).length, 2, `${what}: spliced in exactly once`);
};
const patched = (m: THREE_NS.Material) => {
  const s = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} } as unknown as THREE_NS.WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(s, undefined as unknown as THREE_NS.WebGLRenderer);
  return s.fragmentShader;
};

test('W8-P1 · the city-only GLSL comes from the city data chunk (one module instance) and every block is spliced back where it was', () => {
  assert.ok(CITY_DATA, 'node loads the data chunk');
  assert.equal(CITY_SHADERS, CITY_DATA.CITY_SHADERS, 'the slot hands out the chunk\'s own table');
  // TOY: the façades after the pier sheds (style 8), before the generic windows (styles 1–6)
  const toy = M.TOY_FRAG;
  once(toy, CITY_SHADERS.toyFacades, 'toyFacades');
  const at = toy.indexOf(CITY_SHADERS.toyFacades);
  assert.ok(toy.lastIndexOf('if (floor(vInfo.x + 0.5) == 8.0 && abs(vWN.y) < 0.4) {', at) >= 0, 'after the pier sheds');
  assert.ok(toy.indexOf('  // procedural windows on vertical faces') === at + CITY_SHADERS.toyFacades.length + 1, 'right before the generic windows');
  assert.ok(patched(M.TOY).includes(CITY_SHADERS.toyFacades) && patched(M.TOY_INST).includes(CITY_SHADERS.toyFacades));
  // GROUND: the far-town arm closes the pattern chain; the street glow sits before the hero contact shadow
  const ground = patched(M.GROUND);
  once(ground, CITY_SHADERS.groundTown, 'groundTown');
  once(ground, CITY_SHADERS.groundStreetGlow, 'groundStreetGlow');
  assert.ok(ground.includes(`    k = vec3(0.92 + 0.16 * n);\n${CITY_SHADERS.groundTown}\n  }\n  diffuseColor.rgb *= k * (0.965 + 0.07 * macro);\n${CITY_SHADERS.groundStreetGlow}\n  // contact shadow next to buildings`));
  assert.ok(CITY_SHADERS.groundTown.startsWith('  } else if (pat == 9.0) {'), 'an else-if arm of the pattern chain');
  // the sky: the puffs before main, the city-day blend right after the base gradient
  const sky = (new Environment('city') as unknown as { skyMat: { fragmentShader: string } }).skyMat.fragmentShader;
  once(sky, CITY_SHADERS.skyPuffs, 'skyPuffs');
  once(sky, CITY_SHADERS.skyCityDay, 'skyCityDay');
  assert.ok(sky.includes(`${CITY_SHADERS.skyPuffs}\nvoid main() {`) && sky.includes(`${CITY_SHADERS.skyCityDay}\n  // golden hour`));
  // the blocks carry no template parts (they are moved text, spliced as is)
  for (const [k, v] of Object.entries(CITY_SHADERS)) assert.ok(!v.includes('${') && !v.endsWith('\n') && !v.includes('\r'), k);
  // district mode compiles these strings with every block empty: its programs must stay whole (a block that took a
  // brace of its neighbours would leave the district's shader unbalanced — the first cut of groundTown did)
  const balanced = (s: string) => { let d = 0; for (const c of s) { if (c === '{') d++; else if (c === '}' && --d < 0) return false; } return d === 0; };
  const district = (s: string) => Object.values(CITY_SHADERS).reduce((t, b) => t.split(b).join(''), s);
  for (const [name, s] of [['TOY', patched(M.TOY)], ['TOY_FRAG', toy], ['GROUND', ground], ['SKY', sky]] as const) {
    assert.ok(balanced(s), `${name}: the city's program`);
    assert.ok(balanced(district(s)), `${name}: the district's program (no city blocks) keeps its braces`);
  }
  for (const k of ['groundStreetGlow', 'toyFacades', 'skyPuffs', 'skyCityDay'] as const) assert.ok(balanced(CITY_SHADERS[k]), `${k}: a whole block`);
  assert.ok(balanced(`{${CITY_SHADERS.groundTown}}`), 'groundTown: an arm that closes the one before it and leaves its own open');
});

test('W8-P1 · the district never feeds the moved branches: no TOY window style 9 / 10, no ground pattern 9, no city street glow (so its programs without them draw the same)', async () => {
  const { World } = await import('../src/opus-bay/world/world');
  const world = new World('district');
  let toyVerts = 0, groundVerts = 0;
  const bad: string[] = [];
  world.root.traverse(o => {
    const m = o as THREE_NS.Mesh;
    if (!m.isMesh) return;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]).map(x => x.name);
    const toy = mats.some(n => n.startsWith('ob-toy') || n.startsWith('ob-hero:')), ground = mats.some(n => n.startsWith('ob-ground'));
    const info = m.geometry.getAttribute('aInfo') as THREE_NS.BufferAttribute | undefined;
    if (!info || (!toy && !ground)) return;
    for (let i = 0; i < info.count; i++) {
      const x = Math.floor(info.getX(i) + 0.5), w = info.getW(i);
      if (toy) { toyVerts++; if (x === 9 || x === 10) { bad.push(`${m.name}: TOY style ${x}`); break; } }
      if (ground) { groundVerts++; if (x === 9 || (x === 5 && w > 1.05)) { bad.push(`${m.name}: GROUND pattern ${x} w ${w}`); break; } }
    }
  });
  assert.ok(toyVerts > 100_000 && groundVerts > 50_000, `the walk saw the district (${toyVerts} TOY / ${groundVerts} GROUND vertices)`);
  assert.deepEqual(bad, []);
});
