import * as THREE from 'three';
import { BatchBase, type Info, NO_INFO } from './builder';

/**
 * Compact, growable typed-array batch for the streamed city (plan §5.5). Same recipe surface as `Batch`
 * (it extends BatchBase), 36 B per vertex instead of 52+ and no per-vertex JS numbers, so the city's L0/L1 cells
 * can be built inside a Web Worker and handed to the main thread without copying:
 *
 *   position f32×3 (12 B, world units) · normal i8×4 normalized (4 B, w = 0 pad) ·
 *   colour u8×4 normalized (4 B, linear rgb + 255 pad) · aInfo f32×4 (16 B, same meaning as builder.ts)
 *
 * Worker-safe: three core math/geometry only (no DOM, no materials).
 *
 *   // worker
 *   const b = new TypedBatch();
 *   toyBuildingL0(b, spec);                                 // recipes/*.ts
 *   const arrays = b.toArrays();
 *   postMessage(arrays, TypedBatch.transferables(arrays));
 *   // main thread
 *   const mesh = new THREE.Mesh(TypedBatch.toGeometry(arrays), TOY);
 *
 * Why this packing: the colour is exposed to three as a 3-component view (stride 4) so TOY / GROUND compile the
 * SAME programs as the district's float batches (a 4-component `color` would switch three to its vertex-alpha
 * program variant); the normal's 4th byte keeps every attribute 4-byte aligned. Colours are linear 8-bit and
 * clamped to [0, 1] (district float colours may exceed 1 by a few % on shaded trims; not visible).
 */

export interface TypedBatchArrays {
  vertexCount: number;
  indexCount: number;
  /** xyz per vertex */
  position: Float32Array;
  /** xyzw per vertex, normalized int8 (w = 0) */
  normal: Int8Array;
  /** rgba per vertex, normalized uint8, linear (a = 255) */
  color: Uint8Array;
  /** aInfo xyzw per vertex (see builder.ts) */
  info: Float32Array;
  /** Uint16 when vertexCount ≤ 65535 */
  index: Uint16Array | Uint32Array;
  /** minX, minY, minZ, maxX, maxY, maxZ (no rescan on the main thread) */
  bounds: Float32Array;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class TypedBatch extends BatchBase {
  private pos: Float32Array;
  private nor: Int8Array;
  private col: Uint8Array;
  private inf: Float32Array;
  private idx: Uint32Array;
  private nv = 0;
  private ni = 0;
  private box = new Float32Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);

  constructor(vertexCapacity = 4096, indexCapacity = vertexCapacity * 2) {
    super();
    const v = Math.max(16, vertexCapacity), i = Math.max(48, indexCapacity);
    this.pos = new Float32Array(v * 3);
    this.nor = new Int8Array(v * 4);
    this.col = new Uint8Array(v * 4);
    this.inf = new Float32Array(v * 4);
    this.idx = new Uint32Array(i);
  }

  get vertexCount() { return this.nv; }
  get indexCount() { return this.ni; }
  get triangleCount() { return this.ni / 3; }
  /** Bytes held by the vertex + index arrays actually written (not the reserved capacity). */
  get byteLength() { return this.nv * 36 + this.ni * (this.nv > 65535 ? 4 : 2); }

  private growVerts(need: number) {
    const cap = this.pos.length / 3;
    if (need <= cap) return;
    const n = Math.max(need, cap * 2);
    const pos = new Float32Array(n * 3); pos.set(this.pos); this.pos = pos;
    const nor = new Int8Array(n * 4); nor.set(this.nor); this.nor = nor;
    const col = new Uint8Array(n * 4); col.set(this.col); this.col = col;
    const inf = new Float32Array(n * 4); inf.set(this.inf); this.inf = inf;
  }

  vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, c: THREE.Color, info: Info = NO_INFO): number {
    const i = this.nv;
    if (i * 3 + 3 > this.pos.length) this.growVerts(i + 1);
    const p = i * 3, q = i * 4;
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
    this.nor[q] = Math.round(Math.max(-1, Math.min(1, nx)) * 127);
    this.nor[q + 1] = Math.round(Math.max(-1, Math.min(1, ny)) * 127);
    this.nor[q + 2] = Math.round(Math.max(-1, Math.min(1, nz)) * 127);
    this.col[q] = Math.round(clamp01(c.r) * 255);
    this.col[q + 1] = Math.round(clamp01(c.g) * 255);
    this.col[q + 2] = Math.round(clamp01(c.b) * 255);
    this.col[q + 3] = 255;
    this.inf[q] = info[0]; this.inf[q + 1] = info[1]; this.inf[q + 2] = info[2]; this.inf[q + 3] = info[3];
    const b = this.box;
    if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (z < b[2]) b[2] = z;
    if (x > b[3]) b[3] = x; if (y > b[4]) b[4] = y; if (z > b[5]) b[5] = z;
    this.nv = i + 1;
    return i;
  }

  protected index3(a: number, b: number, c: number) {
    if (this.ni + 3 > this.idx.length) {
      const idx = new Uint32Array(Math.max(this.ni + 3, this.idx.length * 2));
      idx.set(this.idx);
      this.idx = idx;
    }
    this.idx[this.ni++] = a; this.idx[this.ni++] = b; this.idx[this.ni++] = c;
  }
  protected px(i: number) { return this.pos[i * 3]; }
  protected pz(i: number) { return this.pos[i * 3 + 2]; }

  /** Forget the content, keep the allocated capacity (reuse one batch per worker job). */
  reset(): this {
    this.nv = 0;
    this.ni = 0;
    this.box.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    return this;
  }

  /** Trimmed copies of what was written: own ArrayBuffers, ready to transfer (see transferables()). */
  toArrays(): TypedBatchArrays {
    const nv = this.nv, ni = this.ni;
    return {
      vertexCount: nv,
      indexCount: ni,
      position: this.pos.slice(0, nv * 3),
      normal: this.nor.slice(0, nv * 4),
      color: this.col.slice(0, nv * 4),
      info: this.inf.slice(0, nv * 4),
      index: nv > 65535 ? this.idx.slice(0, ni) : Uint16Array.from(this.idx.subarray(0, ni)),
      bounds: nv ? this.box.slice() : new Float32Array(6),
    };
  }

  /** The buffers of `a` for postMessage's transfer list. */
  static transferables(a: TypedBatchArrays): ArrayBuffer[] {
    return [a.position.buffer, a.normal.buffer, a.color.buffer, a.info.buffer, a.index.buffer, a.bounds.buffer] as ArrayBuffer[];
  }

  /**
   * Wrap arrays into a BufferGeometry for TOY / GROUND (or TOY_INST-free BatchedMesh pools): no copies, bounds
   * from the batch. Attributes: position (3), normal (4-byte view, read as vec3), color (3 of 4 bytes, stride 4),
   * aInfo (4), index.
   */
  static toGeometry(a: TypedBatchArrays): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 4, true));
    g.setAttribute('color', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(a.color, 4), 3, 0, true));
    g.setAttribute('aInfo', new THREE.BufferAttribute(a.info, 4));
    g.setIndex(new THREE.BufferAttribute(a.index, 1));
    const b = a.bounds;
    g.boundingBox = new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    return g;
  }
}
