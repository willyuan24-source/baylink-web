import * as THREE from 'three';
import { BOX, C } from './builder';
import { GROUND, GROUND_BATCH, GROUND_CITY, TOY, TOY_BATCH, TOY_INST, TOY_INST_TINT } from './materials';
import { toyBuildingL1 } from './recipes/city';
import { TypedBatch } from './typedBatch';

/**
 * Shader warm-up (plan §5.5 "shader-stable contract"): compile, at boot and off the critical path, every
 * program variant the streamed city will need, so walking into new cells never stalls on a shader compile.
 * A hidden dummy set (never added to the scene) is compiled with renderer.compileAsync against the real scene
 * (its lights, fog and shadow state are part of each program's key):
 *
 *   TOY           · plain Mesh, TypedBatch geometry, receiveShadow   → city L0 cells (same program as the district's)
 *   TOY_BATCH     · BatchedMesh with a colour texture, receiveShadow off → L1 / L2 pools (USE_BATCHING(_COLOR))
 *   GROUND        · plain Mesh, city-flagged TypedBatch geometry      → L0 ground (same program as the district's)
 *   GROUND_BATCH  · BatchedMesh with a colour texture                   → far ground pool (USE_BATCHING(_COLOR))
 *   TOY_INST      · InstancedMesh without instanceColor              → untinted instanced props
 *   TOY_INST_TINT · InstancedMesh with instanceColor                 → city trees / lamps, Karl's cloud bank
 *   depth         · MeshDepthMaterial BackSide / DoubleSide into a render target (the shadow pass of every caster
 *                   kind: plain Mesh = three's internal depth material; InstancedMesh with / without instanceColor =
 *                   kindSweep's own; BatchedMesh with / without colours = three's internal one with USE_BATCHING)
 * (each material instance is warmed with the one object kind it draws: materials.ts, "one material instance per
 * object kind")
 *
 * To reuse these programs, city meshes must match the dummies' flags: L0 Mesh receiveShadow = true /
 * castShadow = false; BatchedMesh pools receiveShadow = false; props InstancedMesh receiveShadow = true.
 * The render path is part of the key too (tilt-shift post renders into a target → no tone mapping in the
 * program): pass `offscreen` = the path WorldScene uses (quality high and motion allowed).
 *
 * Wave 4 (lane V, W4-V8): a set registered after the boot warm-up is compiled on its own at once (see registerWarmup),
 * and the depth set covers the instanced and batched caster kinds (the "40–41 → 42 programs along a route" drift of
 * D2's routes QA was an instanced tinted caster's depth program and the hero labels linking on first sight).
 */

export interface WarmupResult { ms: number; before: number; after: number }

/**
 * Day-0 hook (wave 2): other lanes add their program variants to the warm-up set from their own files (D2's model
 * material, F's cable-car / crowd materials, C2's new layers). `make()` returns objects built exactly like the real ones
 * (same material, same mesh type / instancing / batching, same castShadow / receiveShadow, same defines) plus an
 * optional dispose; they are compiled with the dummies and never added to the scene. Register at module load; a set
 * registered after the first warm-up (a lazy chunk) is compiled by itself ≈ 30 ms later against the last warm-up's
 * renderer, scene and render path, and again with everything at the next full warm-up (quality change). Returns the
 * unregister function.
 */
export interface WarmupSet { objects: THREE.Object3D[]; dispose?: () => void }
const extraWarmups = new Map<string, () => WarmupSet>();
export function registerWarmup(key: string, make: () => WarmupSet): () => void {
  extraWarmups.set(key, make);
  if (lastWarm) scheduleLateWarm(key);
  return () => { if (extraWarmups.get(key) === make) extraWarmups.delete(key); };
}

/** The render state of the last full warm-up (null until the first): late registrations compile against it. */
let lastWarm: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera; opts: { offscreen?: boolean } } | null = null;
const lateKeys = new Set<string>();
let lateTimer: ReturnType<typeof setTimeout> | null = null;
/** The late warm-ups since boot (their keys and cost): `window.__opusWarmLate` in DEV. */
export const lateWarmups: ({ keys: string[] } & WarmupResult)[] = [];
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __opusWarmLate?: unknown }).__opusWarmLate = lateWarmups;

function scheduleLateWarm(key: string) {
  lateKeys.add(key);
  if (lateTimer !== null) return;
  // one pass for the registrations of one chunk (they run back to back at its module load), between frames
  lateTimer = setTimeout(() => {
    lateTimer = null;
    const keys = [...lateKeys].filter(k => extraWarmups.has(k));
    lateKeys.clear();
    const w = lastWarm;
    if (!w || !keys.length) return;
    void compileSets(w.renderer, w.scene, w.camera, w.opts, keys)
      .then(r => { lateWarmups.push({ keys, ...r }); })
      .catch(error => { if (import.meta.env?.DEV) console.warn('[opus-bay warmup late]', keys, error); });
  }, 30);
}

/** Number of linked shader programs (for the ?debug overlay; constant after warm-up while walking). */
export function programsCount(renderer: THREE.WebGLRenderer): number {
  return renderer.info.programs?.length ?? 0;
}

/** The dummies of the city's own kinds (`base`) and the registered sets (`keys`: all when null). */
function dummySet(base: boolean, keys: readonly string[] | null): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'ob-warmup';
  const disposers: (() => void)[] = [];
  if (base) {
    const toyBatch = new TypedBatch(64);
    toyBuildingL1(toyBatch, { poly: [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }], baseY: 0, H: 3, style: 'victorian', roof: 'gable', palette: 0, seed: 1, flags: 0 });
    const toyGeo = TypedBatch.toGeometry(toyBatch.toArrays());
    const groundBatch = new TypedBatch(8);
    groundBatch.polygon([{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }], 0, C('#ebe2cf'), [4, 0, 0, GROUND_CITY]);
    const groundGeo = TypedBatch.toGeometry(groundBatch.toArrays());

    const toyMesh = new THREE.Mesh(toyGeo, TOY);
    toyMesh.receiveShadow = true;
    const groundMesh = new THREE.Mesh(groundGeo, GROUND);
    groundMesh.receiveShadow = true;

    const batched = (geo: THREE.BufferGeometry, material: THREE.Material) => {
      const index = geo.getIndex()!;
      const m = new THREE.BatchedMesh(1, geo.getAttribute('position').count, index.count, material);
      m.addInstance(m.addGeometry(geo));
      // the pools carry a colour texture from the start (tier cross-fade, C2-10): the USE_BATCHING_COLOR variant
      m.setColorAt(0, C('#ffffff'));
      m.receiveShadow = false;
      return m;
    };
    const toyPool = batched(toyGeo, TOY_BATCH);
    const groundPool = batched(groundGeo, GROUND_BATCH);

    // TOY_INST props need aInfo like every TOY geometry (zero = no windows, no glow)
    const propGeo = BOX().clone();
    propGeo.setAttribute('aInfo', new THREE.Float32BufferAttribute(new Float32Array(propGeo.getAttribute('position').count * 4), 4));
    const props = new THREE.InstancedMesh(propGeo, TOY_INST, 1);
    props.receiveShadow = true;
    const tinted = new THREE.InstancedMesh(propGeo, TOY_INST_TINT, 1);
    tinted.setColorAt(0, C('#ffffff'));
    tinted.receiveShadow = true;

    group.add(toyMesh, groundMesh, toyPool, groundPool, props, tinted);
    disposers.push(() => {
      toyGeo.dispose(); groundGeo.dispose(); propGeo.dispose();
      toyPool.dispose(); groundPool.dispose(); props.dispose(); tinted.dispose();
    });
  }
  // other lanes' variants (registerWarmup)
  for (const [key, make] of extraWarmups) {
    if (keys && !keys.includes(key)) continue;
    try {
      const set = make();
      if (set.objects.length) group.add(...set.objects);
      if (set.dispose) disposers.push(set.dispose);
    } catch (error) { if (import.meta.env?.DEV) console.warn(`[opus-bay warmup ${key}]`, error); }
  }
  return { group, dispose: () => { for (const d of disposers) d(); } };
}

/**
 * The warm-up's depth materials (the shadow pass's key for each caster kind, both sides it uses: three draws a FrontSide
 * material's shadow BackSide and keeps DoubleSide). Never disposed: three drops a program when no material uses it any
 * more, and three's internal depth material (plain and batched casters) or kindSweep's (instanced casters) only take it
 * over once such a caster first draws into the shadow map. A program is shared by key, not by material instance.
 */
const SIDES = [THREE.BackSide, THREE.DoubleSide] as const;
const depthPair = (kind: string) => SIDES.map(side => new THREE.MeshDepthMaterial({ side, name: kind ? `ob-warm-depth-${kind}` : '' }));
const WARM_DEPTH = depthPair('');
/** caster kinds beyond plain meshes (materials.ts DEPTH_BY_KIND inst / instColor; three's own with USE_BATCHING) */
export const WARM_DEPTH_KINDS = ['inst', 'instColor', 'batched', 'batchedColor'] as const;
const WARM_DEPTH_KIND = Object.fromEntries(WARM_DEPTH_KINDS.map(k => [k, depthPair(k)])) as Record<(typeof WARM_DEPTH_KINDS)[number], THREE.MeshDepthMaterial[]>;

/**
 * Casters of every kind with the shadow pass's depth material on both sides it uses, and a render target like the
 * shadow map's. The first two children are the plain casters (BackSide, DoubleSide); then per WARM_DEPTH_KINDS the two
 * sides of an InstancedMesh without / with instanceColor and a BatchedMesh without / with its colour texture.
 */
export function shadowDepthSet(): { group: THREE.Group; target: THREE.WebGLRenderTarget; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'ob-warmup-shadow';
  const geo = BOX().clone();
  const white = new THREE.Color('#ffffff');
  const owned: { dispose(): void }[] = [];
  for (const m of WARM_DEPTH) group.add(new THREE.Mesh(geo, m));
  for (const kind of WARM_DEPTH_KINDS) {
    for (const m of WARM_DEPTH_KIND[kind]) {
      if (kind === 'inst' || kind === 'instColor') {
        const o = new THREE.InstancedMesh(geo, m, 1);
        if (kind === 'instColor') o.setColorAt(0, white);
        group.add(o); owned.push(o);
      } else {
        const o = new THREE.BatchedMesh(1, geo.getAttribute('position').count, geo.getIndex()!.count, m);
        o.addInstance(o.addGeometry(geo));
        if (kind === 'batchedColor') o.setColorAt(0, white);
        group.add(o); owned.push(o);
      }
    }
  }
  const target = new THREE.WebGLRenderTarget(1, 1);
  return { group, target, dispose: () => { for (const o of owned) o.dispose(); geo.dispose(); target.dispose(); } };
}

/**
 * Compile the city's program variants for the current render state (call after the world has mounted:
 * fog, shadow map and tone mapping must already be set). Safe to call again (e.g. after a quality change):
 * programs already linked are reused and the call resolves quickly. Later registrations compile against this call's
 * state (registerWarmup).
 */
export async function warmPrograms(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, opts: { offscreen?: boolean } = {}): Promise<WarmupResult> {
  lastWarm = { renderer, scene, camera, opts };
  return compileSets(renderer, scene, camera, opts, null);
}

/** One compile pass: the base dummies + every set (`keys` null), or only the named late sets. */
async function compileSets(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, opts: { offscreen?: boolean }, keys: readonly string[] | null): Promise<WarmupResult> {
  const t0 = performance.now();
  const before = programsCount(renderer);
  const { group, dispose } = dummySet(keys === null, keys);
  const prevTarget = renderer.getRenderTarget();
  const target = opts.offscreen ? new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }) : null;
  try {
    // the program key reads the current render target (tone mapping / output colour space) at compile time
    renderer.setRenderTarget(target);
    const pending = renderer.compileAsync(group, camera, scene);
    renderer.setRenderTarget(prevTarget);
    // the shadow pass's own depth programs (P5, E2's wave-3 request 3: one linked on the first high glide in city
    // mode): into the shadow map (a render target: no tone mapping, linear output); the shadow pass renders without a
    // scene: no fog in the key — the scene's fog is lifted while the keys are made. A late pass needs them only when
    // one of its objects casts (they are linked already after the boot pass: the call resolves at once).
    let casts = keys === null;
    if (!casts) group.traverse(o => { if (o.castShadow) casts = true; });
    const shadow = renderer.shadowMap.enabled && casts ? shadowDepthSet() : null;
    if (shadow) {
      const fog = scene.fog;
      renderer.setRenderTarget(shadow.target);
      scene.fog = null;
      let p: Promise<unknown>;
      try { p = renderer.compileAsync(shadow.group, camera, scene); } finally { scene.fog = fog; renderer.setRenderTarget(prevTarget); }
      await p.finally(shadow.dispose);
    }
    await pending;
  } finally {
    renderer.setRenderTarget(prevTarget);
    target?.dispose();
    dispose();
  }
  return { ms: performance.now() - t0, before, after: programsCount(renderer) };
}

/** Test hook: forget the last warm-up's render state (no late passes until the next warmPrograms). */
export function resetWarmupState() {
  lastWarm = null;
  lateKeys.clear();
  if (lateTimer !== null) { clearTimeout(lateTimer); lateTimer = null; }
}
