import * as THREE from 'three';
import { projectCity } from '../../core/geo';
import type { Polygon, Vec2 } from '../../core/types';
import { Batch, freezeStatic, splitGeometry } from '../builder';
import { GROUND } from '../materials';
import { CITY_PAL } from '../palette';
import { makeWaterMaterial } from '../water';
import { SOUTH_LAT, worldPolygon } from './boardData';
import { patchFog } from './fog';
import { widenedFrustum } from './props';

/**
 * City-mode water and the edges of the big board (plan §5.8): one water material (the district's shader, with a deeper,
 * cooler Pacific west of the Golden Gate), three meshes on it:
 *
 *   near  a camera-following 4 u wave grid over the 5 × 5 tiles (64 u) around the camera, snapped to the tiles
 *   far   flat 64 u tiles over the whole board, clipped to it; the tiles under the near grid and the tiles that are
 *         all land are dropped from its index (rebuilt when the camera changes tile)
 *   lakes flat surfaces at their own level (far.ts)
 *
 * Depth tint and foam come from the shore-distance texture (far.ts: city land + the hero's own land and piers); until
 * it arrives the district's texture is used. The board edge: a glass cut through the water all round and layered
 * earth where it crosses land (the county line), from world/ground.ts slabEdge.
 */

/** The county line cut: land with lat < SOUTH_LAT (the San Mateo county line) is not modelled (keep x·nx + z·nz ≤ d). */
export { SOUTH_LAT };
/**
 * The world board (boardData.ts WORLD_LL, wave 3): 180 u of Pacific off Ocean Beach / Lands End, round the Marin
 * Headlands and the north Bay to the East Bay ridge (the Marin and East Bay boards stand in it, world/sf/boards.ts).
 */
export function boardPolygon(): Polygon {
  return worldPolygon();
}

/** Half-plane of the county-line cut in world coordinates: keep points with x·nx + z·nz ≤ d. */
export function southCut(): { nx: number; nz: number; d: number } {
  const a = projectCity(SOUTH_LAT, -122.52), b = projectCity(SOUTH_LAT, -122.36);
  // normal pointing south (away from the city): perpendicular to a→b, on the side of a point south of the line
  let nx = -(b.z - a.z), nz = b.x - a.x;
  const L = Math.hypot(nx, nz);
  nx /= L; nz /= L;
  const s = projectCity(SOUTH_LAT - 0.01, -122.45);
  if ((s.x - a.x) * nx + (s.z - a.z) * nz < 0) { nx = -nx; nz = -nz; }
  return { nx, nz, d: a.x * nx + a.z * nz };
}

const TILE = 64, NEAR = 2; // near grid = (2·NEAR + 1)² tiles
const NEAR_STEP = 4;
const WATER_Y = -0.6;
/** edge column width (u): the county line (the city's south cut, walked past) and the far board edges */
const EDGE_COLUMN = 6, EDGE_COLUMN_FAR = 12;
/** the edge's pieces (u): each is one draw call when any of it is in view */
const EDGE_PIECE = 1024;
/**
 * The far tiles are cut to a widened copy of the view (wave 3: the world board is ≈ 4,000 far tiles since the boards
 * came): re-cut when the camera changes tile or the view turns by more than CUT_TURN (less than CUT_WIDEN, so nothing
 * inside the real frustum is ever missing).
 */
const CUT_WIDEN = 30, CUT_TURN = 14;
const TILE_R = TILE * Math.SQRT1_2 + 1;

/** Sutherland–Hodgman: clip a convex (or any) subject polygon against a convex clip polygon (CCW or CW). */
export function clipConvex(subject: Vec2[], clip: Polygon): Vec2[] {
  let out = subject;
  let area = 0;
  for (let i = 0; i < clip.length; i++) { const p = clip[i], q = clip[(i + 1) % clip.length]; area += p.x * q.z - q.x * p.z; }
  const s = area >= 0 ? 1 : -1;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const inside = (p: Vec2) => s * ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)) >= 0;
    const inp = out;
    out = [];
    for (let k = 0; k < inp.length; k++) {
      const p = inp[k], q = inp[(k + 1) % inp.length];
      const pin = inside(p), qin = inside(q);
      if (pin) out.push(p);
      if (pin !== qin) {
        const dx = q.x - p.x, dz = q.z - p.z, ex = b.x - a.x, ez = b.z - a.z;
        const den = dx * ez - dz * ex;
        const t = den !== 0 ? ((a.x - p.x) * ez - (a.z - p.z) * ex) / den : 0;
        out.push({ x: p.x + dx * t, z: p.z + dz * t });
      }
    }
  }
  return out;
}

function pointIn(x: number, z: number, poly: Polygon) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) ins = !ins;
  }
  return ins;
}

/** Deeper, cooler Pacific: a patch after the depth tint (side of the Golden Gate line, and distance from the shore). */
function patchPacific(m: THREE.ShaderMaterial) {
  const a = projectCity(37.8199, -122.4783), b = projectCity(37.8083, -122.4756); // roughly across the Golden Gate
  let nx = -(b.z - a.z), nz = b.x - a.x;
  const L = Math.hypot(nx, nz); nx /= L; nz /= L;
  const ocean = projectCity(37.76, -122.53);
  if ((ocean.x - a.x) * nx + (ocean.z - a.z) * nz < 0) { nx = -nx; nz = -nz; }
  m.uniforms.uPacific = { value: new THREE.Vector4(nx, nz, -(a.x * nx + a.z * nz), 0) };
  m.uniforms.uPacificDeep = { value: new THREE.Color(CITY_PAL.pacificDeep) };
  const needle = 'vec3 col = mix(uShallow, uDeep, depthT);';
  if (!m.fragmentShader.includes(needle)) return;
  m.fragmentShader = m.fragmentShader
    .replace('uniform vec3 uDeep;', 'uniform vec3 uDeep;\nuniform vec4 uPacific;\nuniform vec3 uPacificDeep;')
    .replace(needle, `${needle}
  {
    float pac = smoothstep(-60.0, 120.0, dot(vW.xz, uPacific.xy) + uPacific.z) * smoothstep(6.0, 20.0, d);
    col = mix(col, uPacificDeep * mix(1.0, uLight, 0.6), pac * 0.75);
  }`);
  m.name = 'ob-water-city';
}

export class CityWater {
  readonly group = new THREE.Group();
  readonly material: THREE.ShaderMaterial;
  readonly board: Polygon;
  private near: THREE.Mesh;
  private far: THREE.Mesh;
  private farTiles: { key: number; start: number; count: number; land: boolean }[] = [];
  private farIndex: Uint32Array = new Uint32Array(0);
  private tileKey = NaN;
  private nearBlocks: Uint32Array[] = [];
  private lakes: THREE.Mesh | null = null;
  private edges: THREE.Mesh[] = [];
  /** far tiles fully under the satellite boards' land (setBoardLand) */
  private boardLand = new Set<number>();
  private view = new THREE.Frustum();
  private viewCam = new THREE.PerspectiveCamera();
  private viewValid = false;
  private cutAt = { yaw: NaN, pitch: NaN, fov: 0, aspect: 0 };
  private dir = new THREE.Vector3();
  private sphere = new THREE.Sphere();
  /** far tiles in the last cut (QA) */
  farTilesDrawn = 0;

  constructor(distTex: THREE.Texture, box: THREE.Vector4) {
    this.group.name = 'city-water';
    freezeStatic(this.group);
    this.board = boardPolygon();
    this.material = makeWaterMaterial(distTex, box);
    patchPacific(this.material);
    // Karl the Fog (lane C2-8) on the city water (vW: the water's world position)
    patchFog(this.material, { world: 'vW' });
    this.near = this.nearGrid();
    this.far = this.farGrid();
    this.group.add(this.far, this.near);
  }

  /** 4 u grid over the (2·NEAR + 1)² tiles, local around the centre tile's corner; moved by whole tiles (no swimming). */
  private nearGrid() {
    const span = TILE * (2 * NEAR + 1), n = span / NEAR_STEP, N = n + 1, per = TILE / NEAR_STEP;
    const pos = new Float32Array(N * N * 3), edge = new Float32Array(N * N).fill(1), dist = new Float32Array(N * N).fill(-1);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i;
      pos[k * 3] = -TILE * NEAR + i * NEAR_STEP; pos[k * 3 + 1] = WATER_Y; pos[k * 3 + 2] = -TILE * NEAR + j * NEAR_STEP;
    }
    // one index block per tile, so tiles that cross the board edge can fall back to the (clipped) far tile
    const blocks: Uint32Array[] = [];
    for (let tj = 0; tj < 2 * NEAR + 1; tj++) for (let ti = 0; ti < 2 * NEAR + 1; ti++) {
      const b = new Uint32Array(per * per * 6);
      let q = 0;
      for (let j = tj * per; j < tj * per + per; j++) for (let i = ti * per; i < ti * per + per; i++) {
        const a = j * N + i, c = a + 1, d = a + N, e = d + 1;
        b[q++] = a; b[q++] = d; b[q++] = c; b[q++] = c; b[q++] = d; b[q++] = e;
      }
      blocks.push(b);
    }
    this.nearBlocks = blocks;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
    g.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(blocks.length * blocks[0].length), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(TILE / 2, WATER_Y, TILE / 2), span);
    const m = new THREE.Mesh(g, this.material);
    m.name = 'city-water-near';
    m.renderOrder = 1;
    m.frustumCulled = false;
    m.matrixAutoUpdate = false;
    return m;
  }

  /** Flat tiles over the board (clipped to it), one index range per tile. */
  private farGrid() {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of this.board) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const pos: number[] = [], idx: number[] = [];
    for (let tz = Math.floor(z0 / TILE); tz * TILE < z1; tz++) for (let tx = Math.floor(x0 / TILE); tx * TILE < x1; tx++) {
      const sq = [{ x: tx * TILE, z: tz * TILE }, { x: tx * TILE + TILE, z: tz * TILE }, { x: tx * TILE + TILE, z: tz * TILE + TILE }, { x: tx * TILE, z: tz * TILE + TILE }];
      const poly = clipConvex(sq, this.board);
      if (poly.length < 3) continue;
      const base = pos.length / 3, start = idx.length;
      for (const p of poly) pos.push(p.x, WATER_Y, p.z);
      for (let k = 1; k + 1 < poly.length; k++) {
        const a = poly[0], b = poly[k], c = poly[k + 1];
        const cy = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
        if (cy > 0) idx.push(base, base + k, base + k + 1); else idx.push(base, base + k + 1, base + k);
      }
      this.farTiles.push({ key: this.key(tx, tz), start, count: idx.length - start, land: false });
    }
    this.farIndex = Uint32Array.from(idx);
    const g = new THREE.BufferGeometry();
    const n = pos.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aDist', new THREE.BufferAttribute(new Float32Array(n).fill(-1), 1));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(this.farIndex.length), 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, this.material);
    m.name = 'city-water-far';
    m.renderOrder = 1;
    m.matrixAutoUpdate = false;
    return m;
  }

  private key(tx: number, tz: number) { return (tx + 512) * 1024 + (tz + 512); }

  /** Tile inside the board (all four corners): drawn by the near grid; others by the clipped far tiles. */
  private insideBoard(tx: number, tz: number) {
    for (const [dx, dz] of [[0, 0], [1, 0], [1, 1], [0, 1]]) if (!pointIn((tx + dx) * TILE, (tz + dz) * TILE, this.board)) return false;
    return true;
  }

  /** Rebuild both indexes for the camera tile (ctx, ctz). */
  private refresh(ctx: number, ctz: number) {
    const nearAttr = this.near.geometry.getIndex()!;
    const nd = nearAttr.array as Uint32Array;
    const inNear = new Set<number>();
    let nn = 0;
    for (let tj = 0; tj < 2 * NEAR + 1; tj++) for (let ti = 0; ti < 2 * NEAR + 1; ti++) {
      const tx = ctx - NEAR + ti, tz = ctz - NEAR + tj;
      if (!this.insideBoard(tx, tz)) continue;
      inNear.add(this.key(tx, tz));
      const b = this.nearBlocks[tj * (2 * NEAR + 1) + ti];
      nd.set(b, nn);
      nn += b.length;
    }
    this.near.geometry.setDrawRange(0, nn);
    nearAttr.needsUpdate = true;
    this.near.visible = nn > 0;
    const attr = this.far.geometry.getIndex()!;
    const dst = attr.array as Uint32Array;
    let n = 0, drawn = 0;
    for (const t of this.farTiles) {
      if (t.land || inNear.has(t.key) || this.boardLand.has(t.key)) continue;
      if (this.viewValid) {
        const tx = Math.floor(t.key / 1024) - 512, tz = (t.key % 1024) - 512;
        this.sphere.center.set(tx * TILE + TILE / 2, WATER_Y, tz * TILE + TILE / 2);
        this.sphere.radius = TILE_R;
        if (!this.view.intersectsSphere(this.sphere)) continue;
      }
      dst.set(this.farIndex.subarray(t.start, t.start + t.count), n);
      n += t.count;
      drawn++;
    }
    this.far.geometry.setDrawRange(0, n);
    attr.clearUpdateRanges();
    if (n) attr.addUpdateRange(0, n);
    attr.needsUpdate = true;
    this.farTilesDrawn = drawn;
  }

  /**
   * The satellite boards' land (world/sf/boards.ts): far tiles it covers entirely (tile keys as tx, tz pairs) leave the
   * water's index; the rest stays under the boards' coasts.
   */
  setBoardLand(tiles: ArrayLike<number>) {
    this.boardLand.clear();
    for (let k = 0; k + 1 < tiles.length; k += 2) this.boardLand.add(this.key(tiles[k], tiles[k + 1]));
    this.tileKey = NaN;
  }

  /** New shore texture (far.ts): swap it in and drop the far tiles that are all land (no water to show there). */
  setShore(texture: THREE.Texture, box: THREE.Vector4, shore: { data: Uint8Array; x0: number; z0: number; step: number; cols: number; rows: number }, lights: THREE.Texture) {
    const old = this.material.uniforms.uDistTex.value as THREE.Texture | null;
    this.material.uniforms.uDistTex.value = texture;
    this.material.uniforms.uDistBox.value = box;
    const oldL = this.material.uniforms.uLightTex.value as THREE.Texture | null;
    this.material.uniforms.uLightTex.value = lights;
    if (old && old !== texture) old.dispose();
    if (oldL && oldL !== lights) oldL.dispose();
    for (const t of this.farTiles) {
      const tx = Math.floor(t.key / 1024) - 512, tz = (t.key % 1024) - 512;
      let land = true;
      for (let z = tz * TILE; z <= tz * TILE + TILE && land; z += 8) for (let x = tx * TILE; x <= tx * TILE + TILE && land; x += 8) {
        const i = Math.floor((x - shore.x0) / shore.step), j = Math.floor((z - shore.z0) / shore.step);
        if (i < 0 || j < 0 || i >= shore.cols || j >= shore.rows || shore.data[j * shore.cols + i] > 0) land = false;
      }
      t.land = land;
    }
    this.tileKey = NaN;
  }

  setLakes(lakes: { position: Float32Array; index: Uint32Array } | null) {
    if (!lakes || this.lakes) return;
    const n = lakes.position.length / 3;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(lakes.position, 3));
    g.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aDist', new THREE.BufferAttribute(new Float32Array(n).fill(-1), 1));
    g.setIndex(new THREE.BufferAttribute(lakes.index, 1));
    g.computeBoundingSphere();
    this.lakes = new THREE.Mesh(g, this.material);
    this.lakes.name = 'city-lakes';
    this.lakes.renderOrder = 1;
    this.lakes.matrixAutoUpdate = false;
    this.group.add(this.lakes);
  }

  /**
   * The board's cut edge: glass through the water, layered earth where it crosses land (`groundAt` → ground top, or
   * null for water). Built once the far data is in (ground heights along the county line).
   */
  setEdge(groundAt: (x: number, z: number) => number | null, slabEdge: (g: Batch, poly: Polygon, top: (x: number, z: number) => number, water: (x: number, z: number) => boolean, bottom?: number, seed?: number, column?: number | ((edge: number) => number), underside?: boolean) => void) {
    if (this.edges.length) return;
    const g = new Batch();
    // 6 u columns along the county line (the city's own cut), 12 u on the far edges round the boards (the board is
    // ≈ 13 km round and seen from afar: 1.6 u columns would cost ~100k triangles); no underside (its fan spans the
    // whole board: split, every triangle was a draw call in almost every view); split in EDGE_PIECE u pieces so only
    // the stretch in view is drawn (≈ 14k triangles round the board, ≈ 20 pieces)
    // (WORLD_LL starts with the county line: edge 0)
    slabEdge(g, this.board, (x, z) => groundAt(x, z) ?? WATER_Y, (x, z) => groundAt(x, z) === null, undefined, 1, (edge: number) => (edge === 0 ? EDGE_COLUMN : EDGE_COLUMN_FAR), false);
    splitGeometry(g.build(), EDGE_PIECE).forEach((geo, i) => {
      const m = new THREE.Mesh(geo, GROUND);
      m.name = `city-board-edge#${i}`;
      m.matrixAutoUpdate = false;
      m.receiveShadow = true;
      this.edges.push(m);
      this.group.add(m);
    });
  }

  /**
   * Per frame: move the near grid by whole tiles under the camera; re-cut both indexes on a tile change, and the far
   * index when the view turned by more than CUT_TURN degrees (the far tiles outside a CUT_WIDEN° wider view are skipped).
   */
  update(camera: THREE.Camera) {
    const ctx = Math.floor(camera.position.x / TILE), ctz = Math.floor(camera.position.z / TILE);
    const key = this.key(ctx, ctz);
    const cam = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? (camera as THREE.PerspectiveCamera) : null;
    let turned = false;
    if (cam) {
      camera.getWorldDirection(this.dir);
      const yaw = Math.atan2(this.dir.x, this.dir.z), pitch = Math.asin(Math.max(-1, Math.min(1, this.dir.y)));
      const c = this.cutAt, deg = THREE.MathUtils.radToDeg;
      const dyaw = Math.abs(((yaw - c.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      turned = !(deg(dyaw) <= CUT_TURN) || !(deg(Math.abs(pitch - c.pitch)) <= CUT_TURN * 0.7) || cam.fov !== c.fov || cam.aspect !== c.aspect;
      if (turned || key !== this.tileKey) {
        this.cutAt = { yaw, pitch, fov: cam.fov, aspect: cam.aspect };
        widenedFrustum(cam, CUT_WIDEN, this.view, this.viewCam);
        this.viewValid = true;
      }
    }
    if (key === this.tileKey && !turned) return;
    if (key !== this.tileKey) {
      this.tileKey = key;
      this.near.matrix.makeTranslation(ctx * TILE, 0, ctz * TILE);
      this.near.matrixWorld.copy(this.near.matrix);
    }
    this.refresh(ctx, ctz);
  }

  dispose() {
    for (const m of [this.near, this.far, this.lakes, ...this.edges]) m?.geometry.dispose();
    this.material.dispose();
  }
}
