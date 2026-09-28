import * as THREE from 'three';
import { programsCount } from '../warmup';
import type { CityStreamer } from './stream';

/**
 * City streaming diagnostics: `window.__opusBay.city` (DEV: stats(), breakdown(), the streamer, focus(x, z) for QA)
 * and, with `?debug=1`, a small fixed overlay (tiers on screen, jobs queued / in flight, worker ms, attach ms, pool
 * fill, props, landmark LODs, draw calls, triangles, programs). The overlay is plain DOM, refreshed 4× a second,
 * outside React so it costs nothing when absent.
 */

type Win = { __opusBay?: Record<string, unknown> };

// ---------------------------------------------------------------------------
// per-group budget breakdown (lane C2-1)
// ---------------------------------------------------------------------------

export interface BudgetRow { calls: number; triangles: number }
export interface Breakdown {
  /** per group (see groupOf): the main pass after frustum culling */
  groups: Record<string, BudgetRow>;
  /** the sun's shadow pass (casters inside the shadow camera), per group */
  shadow: Record<string, BudgetRow>;
  total: BudgetRow;
  shadowTotal: BudgetRow;
}

/**
 * Group label of a renderable: the top-level child of the world root it hangs under (the streamed city split into
 * L0 toy / ground, the L1+L2 pools, props and sites), or `actors` / `scene:<name>` for what is not in the world.
 */
function groupOf(o: THREE.Object3D, worldRoot: THREE.Object3D | null): string {
  const chain: THREE.Object3D[] = [];
  for (let p: THREE.Object3D | null = o; p; p = p.parent) chain.push(p);
  const wi = worldRoot ? chain.indexOf(worldRoot) : -1;
  if (wi < 0) {
    const top = chain[chain.length - 2] ?? o;
    return /actor|player|guide|npc|pelican|baybay|vehicle/i.test(top.name) || !top.name ? 'actors' : `scene:${top.name}`;
  }
  const top = chain[wi - 1] ?? o;
  if (top.name === 'city') {
    const sub = chain[wi - 2];
    if (!sub) return 'city';
    if (sub.name === 'city-l0') return o.name.startsWith('city-l0-ground') ? 'city.l0.ground' : 'city.l0.toy';
    if (sub.name === 'city-pools' || sub.name === 'city-tiles') return o.name.includes('ground') ? 'city.pool.ground' : 'city.pool.toy';
    return `city.${(sub.name || 'sites').replace(/^city-/, '')}`;
  }
  const n = top.name;
  // W5-V2: the hero tiles' far detail chunks (world/sf/farHero.ts)
  if (/^city-far#\d+$/.test(n)) return 'hero.buildings.far';
  const m = /^(ground|city|backdrop|water)#\d+$/.exec(n);
  if (m) return m[1] === 'city' ? 'hero.buildings' : `hero.${m[1]}`;
  if (n.startsWith('hero:')) return 'hero.landmarks';
  if (n.startsWith('market-')) return 'hero.market';
  return n || top.type;
}

const _frustum = new THREE.Frustum();
const _m4 = new THREE.Matrix4();
const _sphere = new THREE.Sphere();

function visibleChain(o: THREE.Object3D) {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** Triangles one draw of `o` renders (index / position count, draw range, instances), before per-instance culling. */
function drawTriangles(o: THREE.Mesh, group?: { start: number; count: number }): number {
  const g = o.geometry;
  if (!g) return 0;
  const idx = g.getIndex();
  const n = idx ? idx.count : g.getAttribute('position')?.count ?? 0;
  let count = Math.min(n - g.drawRange.start, g.drawRange.count);
  if (group) count = Math.min(count, group.count);
  const inst = (o as unknown as THREE.InstancedMesh).isInstancedMesh ? (o as unknown as THREE.InstancedMesh).count : ((g as THREE.InstancedBufferGeometry).instanceCount ?? 1);
  const perPrim = (o as unknown as THREE.Points).isPoints ? 1 : (o as unknown as THREE.Line).isLine ? 2 : 3;
  return Math.max(0, Math.floor(count / perPrim)) * (Number.isFinite(inst) ? inst : 1);
}

/** BatchedMesh: the multi-draw list three built at its last onBeforeRender (per-instance frustum culling applied). */
function batchedTriangles(b: THREE.BatchedMesh): number {
  const counts = (b as unknown as { _multiDrawCounts?: Int32Array })._multiDrawCounts;
  const n = (b as unknown as { _multiDrawCount?: number })._multiDrawCount ?? 0;
  let s = 0;
  if (counts) for (let i = 0; i < n; i++) s += counts[i];
  return Math.floor(s / 3);
}

function inFrustum(o: THREE.Object3D, f: THREE.Frustum) {
  if (!o.frustumCulled) return true;
  const m = o as THREE.Mesh;
  if ((o as unknown as THREE.InstancedMesh).isInstancedMesh) {
    const im = o as unknown as THREE.InstancedMesh;
    if (im.boundingSphere === null) im.computeBoundingSphere();
    _sphere.copy(im.boundingSphere!).applyMatrix4(o.matrixWorld);
    return f.intersectsSphere(_sphere);
  }
  if (!m.geometry) return true;
  if (m.geometry.boundingSphere === null) m.geometry.computeBoundingSphere();
  _sphere.copy(m.geometry.boundingSphere!).applyMatrix4(o.matrixWorld);
  return f.intersectsSphere(_sphere);
}

const add = (rec: Record<string, BudgetRow>, k: string, calls: number, tris: number) => {
  const r = (rec[k] ??= { calls: 0, triangles: 0 });
  r.calls += calls; r.triangles += tris;
};

/**
 * Per-group draw calls and triangles of the last frame (plan §5.10 budget table): walks the scene, keeps what is
 * visible and inside the camera frustum (three's own test: bounding sphere; BatchedMesh: its last multi-draw list),
 * one call per material group; the shadow pass counts shadow casters inside the sun's shadow camera. An estimate
 * next to renderer.info (which also counts the post pass): the difference is what the table cannot attribute.
 */
export function breakdown(scene: THREE.Object3D, camera: THREE.Camera, opts: { worldRoot?: THREE.Object3D | null; sun?: THREE.DirectionalLight | null } = {}): Breakdown {
  const worldRoot = opts.worldRoot ?? scene.getObjectByName('opus-world') ?? null;
  camera.updateMatrixWorld();
  _frustum.setFromProjectionMatrix(_m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  let sun = opts.sun ?? null;
  if (sun === null) scene.traverse(o => { if (!sun && (o as THREE.DirectionalLight).isDirectionalLight && (o as THREE.DirectionalLight).castShadow) sun = o as THREE.DirectionalLight; });
  const shadowF = new THREE.Frustum();
  const sunL = sun as THREE.DirectionalLight | null;
  if (sunL) {
    const c = sunL.shadow.camera;
    c.updateMatrixWorld();
    shadowF.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse));
  }
  const groups: Record<string, BudgetRow> = {}, shadow: Record<string, BudgetRow> = {};
  scene.traverse(o => {
    const r = o as THREE.Mesh;
    if (!(r.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite) || !visibleChain(o)) return;
    const key = groupOf(o, worldRoot);
    const batched = (o as unknown as THREE.BatchedMesh).isBatchedMesh;
    if (batched) {
      const t = batchedTriangles(o as unknown as THREE.BatchedMesh);
      if (t > 0) add(groups, key, 1, t);
    } else if (inFrustum(o, _frustum)) {
      const mats = Array.isArray(r.material) ? r.material : [r.material];
      if (Array.isArray(r.material) && r.geometry.groups.length) for (const gr of r.geometry.groups) { if (mats[gr.materialIndex ?? 0]?.visible !== false) add(groups, key, 1, drawTriangles(r, gr)); }
      else if (mats[0]?.visible !== false) add(groups, key, 1, drawTriangles(r));
    }
    if (sunL && sunL.castShadow && o.castShadow && !batched && inFrustum(o, shadowF)) add(shadow, key, 1, drawTriangles(r));
  });
  const sum = (rec: Record<string, BudgetRow>) => Object.values(rec).reduce((s, r) => ({ calls: s.calls + r.calls, triangles: s.triangles + r.triangles }), { calls: 0, triangles: 0 });
  return { groups, shadow, total: sum(groups), shadowTotal: sum(shadow) };
}

/** The width at and under which the city ?debug panel takes its phone placement (the HUD's narrow breakpoint). */
export const CITY_DEBUG_NARROW = '(max-width: 720px)';

/**
 * Where the city ?debug panel goes: desktop bottom right over the bottom bar; on a phone full width (6 px margins),
 * wrapped, 10 px, just under G1's ?debug line (`g1Bottom` = its bottom edge in px, null while it is not mounted).
 */
export function cityDebugPlacement(narrow: boolean, g1Bottom: number | null): Partial<CSSStyleDeclaration> {
  if (!narrow) return { left: 'auto', right: '8px', top: 'auto', bottom: '96px', maxWidth: 'none', whiteSpace: 'pre', fontSize: '11px', lineHeight: '1.35' };
  return { left: '6px', right: 'auto', top: `${Math.round((g1Bottom ?? 150) + 6)}px`, bottom: 'auto', maxWidth: 'calc(100% - 12px)', whiteSpace: 'pre-wrap', fontSize: '10px', lineHeight: '1.3' };
}

function debugFlag(): boolean {
  try { return new URLSearchParams(location.search).get('debug') === '1'; } catch { return false; }
}

export function mountCityDebug(streamer: CityStreamer, renderer: THREE.WebGLRenderer): () => void {
  if (typeof window === 'undefined') return () => {};
  const w = window as unknown as Win;
  const api = {
    streamer,
    stats: () => ({ ...streamer.stats(), programs: programsCount(renderer), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    /** QA: focus the streaming on (x, z) (null = back to the player) and resolve when it is ready */
    focus: (x: number | null, z = 0, r = 150) => {
      streamer.focusOverride = x === null ? null : { x, z };
      return x === null ? Promise.resolve() : streamer.whenReady({ x, z }, r);
    },
    whenReady: (x: number, z: number, r = 150) => streamer.whenReady({ x, z }, r),
    /** QA (C2-1): per-group calls / triangles of the view (scene / camera default to the ones the city renders in) */
    breakdown: (camera?: THREE.Camera, scene?: THREE.Object3D) => {
      let root: THREE.Object3D = streamer.group;
      while (root.parent) root = root.parent;
      const cam = camera ?? ((w.__opusBay?.world as { camera?: THREE.Camera } | undefined)?.camera);
      if (!cam) return null;
      const b = breakdown(scene ?? root, cam);
      return { ...b, info: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles } };
    },
  };
  if (import.meta.env.DEV) {
    w.__opusBay = { ...(w.__opusBay ?? {}), city: api };
    // other modules re-publish __opusBay on their own schedule: keep ours on it
  }
  const keep = import.meta.env.DEV ? window.setInterval(() => { const o = w.__opusBay; if (o && o.city !== api) o.city = api; }, 500) : 0;
  if (!debugFlag()) return () => window.clearInterval(keep);
  const el = document.createElement('pre');
  el.className = 'ob-city-debug';
  Object.assign(el.style, {
    position: 'fixed', right: '8px', bottom: '96px', zIndex: '60', margin: '0', padding: '6px 8px', pointerEvents: 'none',
    font: '11px/1.35 ui-monospace, Menlo, Consolas, monospace', color: '#f4efe3', background: 'rgba(40, 44, 48, 0.72)', borderRadius: '6px', whiteSpace: 'pre',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  // phones (≤ 720 px, G1 w3 a3): bottom right it covered the coach mark and the Hop button; there it wraps inside the
  // screen, smaller, under G1's own ?debug line (.ob-debug, which sits over the top stack at that width)
  const narrow = typeof window.matchMedia === 'function' ? window.matchMedia(CITY_DEBUG_NARROW) : null;
  const place = () => Object.assign(el.style, cityDebugPlacement(!!narrow?.matches, document.querySelector('.ob-debug')?.getBoundingClientRect().bottom ?? null));
  place();
  const tick = () => {
    place();
    const s = api.stats();
    const p = s.pool;
    el.textContent = [
      `city ${s.status}  l0 ${s.l0} · l1 ${s.l1} · l2 ${s.l2}  (want ${s.want0}/${s.want1})`,
      `jobs q ${s.queued} · run ${s.inflight} · done ${s.jobs}${s.errors ? ` · err ${s.errors}` : ''}  worker ${s.workerMs} ms`,
      `attach ${s.attachMs} ms (max ${s.attachMaxMs})  rasters ${s.resident}`,
      `pool ${p.kind} ${p.visible}/${p.items}  toy ${(p.toyVertices / 1000).toFixed(0)}k/${(p.toyCapacity / 1000).toFixed(0)}k  gnd ${(p.groundVertices / 1000).toFixed(0)}k`,
      `props ${Object.entries(s.props).map(([k, v]) => `${k} ${v}`).join(' ')}`,
      `sites near ${s.sites.near} (${(s.sites.triangles / 1000).toFixed(1)}k)  tris l0 ${(s.l0Triangles / 1000).toFixed(0)}k · l1 ${(s.l1Triangles / 1000).toFixed(0)}k · l2 ${(s.l2Triangles / 1000).toFixed(0)}k${s.heroFar ? '  hero far' : s.heroTiles.far ? `  hero tiles far ${s.heroTiles.far}/${s.heroTiles.of}` : ''}`,
      `calls ${s.calls} · tris ${(s.triangles / 1000).toFixed(0)}k · programs ${s.programs}  focus ${s.focus.x},${s.focus.z}`,
    ].join('\n');
  };
  const id = window.setInterval(tick, 250);
  return () => { window.clearInterval(id); window.clearInterval(keep); el.remove(); };
}
