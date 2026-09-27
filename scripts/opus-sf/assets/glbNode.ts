// Node-side reader for the published Draco GLBs (lane D2, wave 3): positions and triangle indices of a model's first
// mesh, in the model's own frame with the node transforms applied, the same geometry world/models.ts hands the city
// (loadModel applies `matrixWorld`). Used by landmark-tops.ts (blocker tops and tall parts measured on the drawn mesh)
// and its test. No three loaders: the GLB JSON is read directly and the Draco buffer decoded with the `draco3d`
// decoder module (WASM, node build).
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

export interface GlbMesh {
  /** xyz per vertex, model frame (node transforms applied) */
  positions: Float32Array;
  /** 3 per triangle */
  index: Uint32Array;
}

interface GltfNode { mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }
interface GltfJson {
  scene?: number;
  scenes?: { nodes: number[] }[];
  nodes: GltfNode[];
  meshes: { primitives: { attributes: Record<string, number>; extensions?: { KHR_draco_mesh_compression?: { bufferView: number; attributes: Record<string, number> } } }[] }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
}

// draco3d ships as CommonJS without types
type DracoModule = Record<string, unknown> & { Decoder: new () => DracoDecoder; DecoderBuffer: new () => { Init(a: Int8Array, n: number): void }; Mesh: new () => DracoMeshT; DracoFloat32Array: new () => DracoArray; DracoInt32Array: new () => DracoArray; destroy(o: unknown): void };
interface DracoArray { GetValue(i: number): number; size(): number }
interface DracoMeshT { num_points(): number; num_faces(): number }
interface DracoDecoder {
  DecodeBufferToMesh(b: unknown, m: DracoMeshT): { ok(): boolean; error_msg(): string };
  GetAttributeByUniqueId(m: DracoMeshT, id: number): unknown;
  GetAttributeFloatForAllPoints(m: DracoMeshT, a: unknown, out: DracoArray): boolean;
  GetFaceFromMesh(m: DracoMeshT, f: number, out: DracoArray): boolean;
}

let decoderP: Promise<DracoModule> | null = null;
async function decoderModule(): Promise<DracoModule> {
  if (!decoderP) {
    decoderP = (async () => {
      const mod = (await import('draco3d')) as unknown as { default?: { createDecoderModule(o: object): Promise<DracoModule> }; createDecoderModule?(o: object): Promise<DracoModule> };
      const create = mod.createDecoderModule ?? mod.default!.createDecoderModule;
      return create({});
    })();
  }
  return decoderP;
}

function nodeMatrix(n: GltfNode): THREE.Matrix4 {
  if (n.matrix) return new THREE.Matrix4().fromArray(n.matrix);
  const t = n.translation ?? [0, 0, 0], r = n.rotation ?? [0, 0, 0, 1], s = n.scale ?? [1, 1, 1];
  return new THREE.Matrix4().compose(new THREE.Vector3(t[0], t[1], t[2]), new THREE.Quaternion(r[0], r[1], r[2], r[3]), new THREE.Vector3(s[0], s[1], s[2]));
}

/** World matrix of the first node that carries a mesh (depth-first from the scene roots), and that mesh's index. */
function firstMeshNode(json: GltfJson): { mesh: number; matrix: THREE.Matrix4 } | null {
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? json.nodes.map((_, i) => i);
  const visit = (i: number, parent: THREE.Matrix4): { mesh: number; matrix: THREE.Matrix4 } | null => {
    const n = json.nodes[i], m = parent.clone().multiply(nodeMatrix(n));
    if (n.mesh !== undefined) return { mesh: n.mesh, matrix: m };
    for (const c of n.children ?? []) { const hit = visit(c, m); if (hit) return hit; }
    return null;
  };
  for (const r of roots) { const hit = visit(r, new THREE.Matrix4()); if (hit) return hit; }
  return null;
}

/** Decode a published GLB (a URL under /opus-bay/…, resolved against `publicDir`) into positions + indices. */
export async function readGlbMesh(url: string, publicDir: string): Promise<GlbMesh> {
  const buf = fs.readFileSync(path.join(publicDir, url));
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${url}: not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as GltfJson;
  const bin = 20 + jsonLen + 8;
  const hit = firstMeshNode(json);
  if (!hit) throw new Error(`${url}: no mesh node`);
  const prim = json.meshes[hit.mesh].primitives[0];
  const ext = prim.extensions?.KHR_draco_mesh_compression;
  if (!ext) throw new Error(`${url}: not Draco-compressed`);
  const bv = json.bufferViews[ext.bufferView];
  const bytes = buf.subarray(bin + (bv.byteOffset ?? 0), bin + (bv.byteOffset ?? 0) + bv.byteLength);
  const M = await decoderModule();
  const dec = new M.Decoder(), dbuf = new M.DecoderBuffer(), mesh = new M.Mesh();
  dbuf.Init(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), bytes.byteLength);
  const st = dec.DecodeBufferToMesh(dbuf, mesh);
  if (!st.ok()) throw new Error(`${url}: Draco decode failed (${st.error_msg()})`);
  const att = dec.GetAttributeByUniqueId(mesh, ext.attributes.POSITION);
  const n = mesh.num_points(), pos = new M.DracoFloat32Array();
  dec.GetAttributeFloatForAllPoints(mesh, att, pos);
  const positions = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.set(pos.GetValue(3 * i), pos.GetValue(3 * i + 1), pos.GetValue(3 * i + 2)).applyMatrix4(hit.matrix);
    positions[3 * i] = v.x; positions[3 * i + 1] = v.y; positions[3 * i + 2] = v.z;
  }
  const nf = mesh.num_faces(), face = new M.DracoInt32Array(), index = new Uint32Array(nf * 3);
  for (let f = 0; f < nf; f++) { dec.GetFaceFromMesh(mesh, f, face); index[3 * f] = face.GetValue(0); index[3 * f + 1] = face.GetValue(1); index[3 * f + 2] = face.GetValue(2); }
  for (const o of [pos, face, mesh, dbuf, dec]) M.destroy(o);
  return { positions, index };
}
