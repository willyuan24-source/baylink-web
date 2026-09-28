import * as THREE from 'three';
import { BOX, C } from './builder';
import { GROUND, GROUND_BATCH, GROUND_CITY, TOY, TOY_BATCH, TOY_DYN, TOY_INST, TOY_INST_TINT } from './materials';
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
 *   TOY_DYN       · plain Mesh                                        → moving single meshes (district ferries, cars,
 *                                                                        clock hands, site animations; drawn from boot,
 *                                                                        so this is for the next level's pass)
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
 * Part b: NEXT_WARM_MS after a full warm-up, in the background, (1) the live scene is compiled at the current level: what
 * is on stage but not drawn yet (hidden until night, outside the view, a pool's spare: night beams, the sailboats' GLB
 * material, HUD markers) no longer links on first sight; (2) the level the adaptive monitor would step down to is
 * compiled, the dummies and the visible live objects (verify-phone: the step mid → low linked ≈ 20 programs at once,
 * every key changes when shadows go off; high → mid changes the render path). The live objects go LIVE_BATCH at a time.
 */

export interface WarmupResult { ms: number; before: number; after: number }

/**
 * A quality level's render state as far as program keys go: the render path (`offscreen`: tilt-shift post renders into a
 * target, so no tone mapping in the program) and the shadow map (`shadows: false` = quality low: shadowMap off and no
 * light casts, which changes every lit program's key).
 */
export interface WarmState { offscreen?: boolean; shadows?: boolean }
/** Delay of the live-scene and next-level passes after a full warm-up (off the arrival; they link in the background). */
export const NEXT_WARM_MS = 4000;

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

/**
 * Wave 5 · the warm-up recipe for a new material (lane V, W5-V6: coins, rings, jets, event kits, egg props, pennants,
 * signs). A program that links on first sight stalls that frame 50–500 ms on a phone; the budget is 0 new programs
 * while walking (`?debug` "+N since" stays 0, the perf gate's programs first = last).
 *
 *   1. ONE material instance per object kind, made once in your own (lazy) module and never shared with another kind
 *      of object (a Mesh, an InstancedMesh with / without instanceColor, a BatchedMesh, Points each key a different
 *      program). Do not borrow TOY / TOY_INST / … for a new kind: make your own (materials.ts has the factories).
 *   2. Build the warm-up object EXACTLY like the real one: the same material instance, the same object type, the same
 *      castShadow / receiveShadow, instanceColor present or not (setColorAt), the same defines / onBeforeCompile key,
 *      morph / skin / uv1 attributes if the real geometry has them. `instancedWarmup` / `meshWarmup` below do this
 *      from the real material and flags (pass the real geometry when it carries morph targets or extra uv sets). A
 *      caster's shadow pass is covered by the boot pass's depth set (plain, instanced with / without colour, batched);
 *      a caster with its own customDepthMaterial or an alpha-tested map needs its own depth object (ask lane V).
 *   3. Register from your feature's init() (a lazy chunk, after the boot warm-up): `registerWarmup(key, make)` compiles
 *      the set ≈ 30 ms later against the last warm-up's render state, and again at every full warm-up (quality change)
 *      and in the next-level pass. Keep the returned unregister and call it in your teardown. A module GameRoot imports
 *      statically registers at load instead (the boot pass takes it).
 *   4. Check it in DEV: `window.__opusWarmLate` lists the late passes (your key, before → after programs); walking to
 *      the thing must not raise `renderer.info.programs.length` (`?debug=1`: "+0 since").
 *
 * Example (lane E's coins: one InstancedMesh, tinted per instance, casting no shadow):
 *
 *   // economy/coins.ts
 *   const COIN_MAT = makeCoinMaterial();                       // module-level, used by the coin mesh only
 *   export function init() {
 *     const offWarm = registerWarmup('e-coins', () => instancedWarmup(COIN_MAT, { instanceColor: true, receiveShadow: true }));
 *     …
 *     return () => { offWarm(); … };
 *   }
 */
export interface WarmupObjectOpts {
  /** the real geometry (never disposed by the set); default: a small box built for the set */
  geometry?: THREE.BufferGeometry;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** InstancedMesh only: the real mesh calls setColorAt (USE_INSTANCING_COLOR) */
  instanceColor?: boolean;
}

function warmObject(o: THREE.Mesh, own: THREE.BufferGeometry | null, opts: WarmupObjectOpts): WarmupSet {
  o.name = 'ob-warmup-object';
  o.castShadow = !!opts.castShadow;
  o.receiveShadow = !!opts.receiveShadow;
  o.frustumCulled = false;
  return { objects: [o], dispose: () => { own?.dispose(); (o as unknown as THREE.InstancedMesh).dispose?.(); } };
}

/** A warm-up set of one InstancedMesh (capacity 1) built like the real one (recipe step 2). */
export function instancedWarmup(material: THREE.Material, opts: WarmupObjectOpts = {}): WarmupSet {
  const own = opts.geometry ? null : BOX().clone();
  const mesh = new THREE.InstancedMesh(opts.geometry ?? own!, material, 1);
  if (opts.instanceColor) mesh.setColorAt(0, C('#ffffff'));
  return warmObject(mesh, own, opts);
}

/** A warm-up set of one plain Mesh built like the real one (recipe step 2). */
export function meshWarmup(material: THREE.Material, opts: Omit<WarmupObjectOpts, 'instanceColor'> = {}): WarmupSet {
  const own = opts.geometry ? null : BOX().clone();
  return warmObject(new THREE.Mesh(opts.geometry ?? own!, material), own, opts);
}

const extraWarmups = new Map<string, () => WarmupSet>();
export function registerWarmup(key: string, make: () => WarmupSet): () => void {
  extraWarmups.set(key, make);
  if (lastWarm) scheduleLateWarm(key);
  return () => { if (extraWarmups.get(key) === make) extraWarmups.delete(key); };
}

/** The render state of the last full warm-up (null until the first): late registrations compile against it. */
let lastWarm: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera; opts: WarmState; next: WarmState | null } | null = null;
let nextTimer: ReturnType<typeof setTimeout> | null = null;
const lateKeys = new Set<string>();
let lateTimer: ReturnType<typeof setTimeout> | null = null;
/** The late warm-ups, live-scene and next-level passes since boot (their keys and cost): `window.__opusWarmLate` in DEV. */
export const lateWarmups: ({ keys: string[] | 'all' | 'live'; next?: boolean } & WarmupResult)[] = [];
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
      // the next level's variants of a late set: now when that level's pass already ran (else the pass covers them)
      .then(() => w.next && nextTimer === null && lastWarm === w
        ? compileSets(w.renderer, w.scene, w.camera, { ...w.next, depth: false }, keys).then(r => { lateWarmups.push({ keys, next: true, ...r }); })
        : undefined)
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
    const dynMesh = new THREE.Mesh(toyGeo, TOY_DYN);

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

    group.add(toyMesh, groundMesh, dynMesh, toyPool, groundPool, props, tinted);
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
 * state (registerWarmup). NEXT_WARM_MS later the live scene compiles at this level, then, when `next` is given (the render
 * state of the level the adaptive monitor would step down to; null when it never steps: low, or a ?quality= link), the
 * dummies and the live scene at that level.
 */
export async function warmPrograms(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, opts: WarmState & { next?: WarmState | null } = {}): Promise<WarmupResult> {
  const w = lastWarm = { renderer, scene, camera, opts: { offscreen: opts.offscreen }, next: opts.next ?? null };
  if (nextTimer !== null) { clearTimeout(nextTimer); nextTimer = null; }
  const result = await compileSets(renderer, scene, camera, w.opts, null);
  if (lastWarm === w) {
    nextTimer = setTimeout(() => {
      nextTimer = null;
      if (lastWarm !== w) return;
      const next = w.next;
      const alive = () => lastWarm === w;
      void compileSets(renderer, scene, camera, { ...w.opts, depth: false, live: 'all', alive }, [])
        .then(r => { lateWarmups.push({ keys: 'live', ...r }); })
        // the next level: what could be on screen at the step (the dummies and the visible objects; a hidden one links
        // on first sight at that level, as it would have at this one without the live pass)
        .then(() => next && alive()
          ? compileSets(renderer, scene, camera, { ...next, depth: false, live: 'visible', alive }, null).then(r => { lateWarmups.push({ keys: 'all', next: true, ...r }); })
          : undefined)
        .catch(error => { if (import.meta.env?.DEV) console.warn('[opus-bay warmup live / next]', error); });
    }, NEXT_WARM_MS);
  }
  return result;
}

/**
 * The canvas that warmed up is going (GameRoot's Warmup cleanup: an unmount, or a quality / motion change whose new
 * warm-up follows): no live / next pass starts or goes on for it, and a later registration no longer compiles against
 * its renderer (the set waits for the next full warm-up). Before this, the passes ran on for seconds against the old
 * level (or a disposed renderer) and the module kept the old renderer and scene until the next warm-up.
 */
export function stopWarmup(renderer: THREE.WebGLRenderer) {
  if (lastWarm?.renderer !== renderer) return;
  lastWarm = null;
  if (nextTimer !== null) { clearTimeout(nextTimer); nextTimer = null; }
}

/** Live-scene objects compiled per task (their links are awaited before the next batch: a deep queue of links stalled
 * the next frame's first use of any new program ≈ 0.5 s on the RTX), and the pause between batches. */
export const LIVE_BATCH = 1;
export const LIVE_GAP_MS = 32;
/** The longest a background pass waits for one batch's links (a lost context never reports a link complete). */
export const LINK_WAIT_MS = 4000;

type LinkingProgram = { isReady?: () => boolean };

/**
 * Wait until the programs a batch created have linked (integration review: compileAsync polls the material's
 * *current* program, and for an object on screen the next frame sets that back to this level's, already linked one, so
 * at the next level 12 of 40 calls resolved while their program was still linking and the next calls queued behind
 * them (phone profile: up to 13 calls started with links pending, 380–520 ms link waits). Polls the programs
 * themselves (KHR_parallel_shader_compile: a non-blocking query; without it three reports them ready at once), and any
 * other link that started meanwhile.
 */
async function programsLinked(programs: readonly LinkingProgram[], alive: () => boolean): Promise<void> {
  const t0 = performance.now();
  let rest = programs.filter(p => typeof p.isReady === 'function');
  while (rest.length && alive() && performance.now() - t0 < LINK_WAIT_MS) {
    rest = rest.filter(p => !p.isReady!());
    if (rest.length) await new Promise(r => setTimeout(r, 10));
  }
}

/**
 * One object per material of the live scene (three's compile() takes each material once, with the first object that
 * uses it: right under the one-material-per-object-kind rule): every object, or only the visible ones.
 */
export function liveObjects(scene: THREE.Object3D, visibleOnly: boolean): THREE.Object3D[] {
  const seen = new Set<THREE.Material>();
  const out: THREE.Object3D[] = [];
  const visit = (o: THREE.Object3D) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    const drawn = (o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite;
    if (!m || !drawn || o.name.startsWith('ob-warmup')) return;
    const first = Array.isArray(m) ? m[0] : m;
    if (!first || seen.has(first)) return;
    seen.add(first);
    out.push(o);
  };
  if (visibleOnly) scene.traverseVisible(visit); else scene.traverse(visit);
  return out;
}

/**
 * Run `f` (synchronous compile calls: three's compile() is synchronous, compileAsync only waits for the links) with the
 * render state in place: the render target of the path (tone mapping / output colour space are keyed on it) and, for
 * `noShadows`, no shadow map and no casting light (quality low).
 */
function inState<T>(renderer: THREE.WebGLRenderer, scene: THREE.Scene, noShadows: boolean, target: THREE.WebGLRenderTarget | null, f: () => T): T {
  const prevTarget = renderer.getRenderTarget();
  const lift = noShadows && renderer.shadowMap.enabled;
  const lifted: THREE.Object3D[] = [];
  renderer.setRenderTarget(target);
  if (lift) {
    renderer.shadowMap.enabled = false;
    scene.traverse(o => { if ((o as THREE.Light).isLight && o.castShadow) { o.castShadow = false; lifted.push(o); } });
  }
  try { return f(); } finally {
    if (lift) { renderer.shadowMap.enabled = true; for (const o of lifted) o.castShadow = true; }
    renderer.setRenderTarget(prevTarget);
  }
}

const inScene = (o: THREE.Object3D, scene: THREE.Object3D) => { let p: THREE.Object3D | null = o; while (p && p !== scene) p = p.parent; return p === scene; };

/**
 * One compile pass: the base dummies + every set (`keys` null), or only the named late sets, for the render state `opts`
 * (`shadows: false`: the shadow map and every light's castShadow lifted for the synchronous compile calls only; `depth:
 * false` skips the shadow pass's programs: the next level shares them or has none; `live`: then the live scene's objects,
 * all or the visible ones, LIVE_BATCH at a time).
 */
async function compileSets(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, opts: WarmState & { depth?: boolean; live?: 'all' | 'visible'; alive?: () => boolean }, keys: readonly string[] | null): Promise<WarmupResult> {
  const t0 = performance.now();
  const before = programsCount(renderer);
  const { group, dispose } = dummySet(keys === null, keys);
  const prevTarget = renderer.getRenderTarget();
  const target = opts.offscreen ? new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }) : null;
  const noShadows = opts.shadows === false;
  try {
    // a background pass (`live`) compiles the dummies LIVE_BATCH at a time too (below)
    const pending = group.children.length && !opts.live ? inState(renderer, scene, noShadows, target, () => renderer.compileAsync(group, camera, scene)) : null;
    // the shadow pass's own depth programs (P5, E2's wave-3 request 3: one linked on the first high glide in city
    // mode): into the shadow map (a render target: no tone mapping, linear output); the shadow pass renders without a
    // scene: no fog in the key — the scene's fog is lifted while the keys are made. A late pass needs them only when
    // one of its objects casts (they are linked already after the boot pass: the call resolves at once).
    let casts = keys === null && opts.depth !== false;
    if (!casts && opts.depth !== false) group.traverse(o => { if (o.castShadow) casts = true; });
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
    if (opts.live) {
      const alive = opts.alive ?? (() => true);
      const objects = [...group.children, ...liveObjects(scene, opts.live === 'visible')];
      // a pass stops when its warm-up is superseded (a quality change) or released (the canvas unmounted)
      for (let i = 0; i < objects.length && alive(); i += LIVE_BATCH) {
        const batch = objects.slice(i, i + LIVE_BATCH).filter(o => o.parent === group || inScene(o, scene));
        if (batch.length) {
          const had = new Set<unknown>(renderer.info.programs ?? []);
          await inState(renderer, scene, noShadows, target, () => Promise.all(batch.map(o => renderer.compileAsync(o, camera, scene))));
          await programsLinked((renderer.info.programs ?? []).filter(p => !had.has(p)) as LinkingProgram[], alive);
        }
        await new Promise(r => setTimeout(r, LIVE_GAP_MS));
      }
    }
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
  if (nextTimer !== null) { clearTimeout(nextTimer); nextTimer = null; }
  lateKeys.clear();
  if (lateTimer !== null) { clearTimeout(lateTimer); lateTimer = null; }
}
