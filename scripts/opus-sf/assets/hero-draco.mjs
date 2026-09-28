// Draco for the five district hero GLBs (lane V, wave-4 integration; D2 w3 "not done" 3, the lead-merge 8.4 row):
//
//   node scripts/opus-sf/assets/hero-draco.mjs public/opus-bay/models/baybay.glb [...] [--out DIR] [--check]
//
// The heroes were packed by docs/opus-bay/kit-jobs/hero_glb_pack.py (HC-4) for a bare GLTFLoader: quantized normals /
// UVs (KHR_mesh_quantization), uint8 weights, int16 animation rotations, WebP textures. Now that actors/system.ts
// (BAYBAY) and world/life.ts (sea lions, pelican, sailboat) load them through world/models.ts heroGltfLoader() (a
// GLTFLoader with the game's DRACOLoader), their geometry goes Draco (KHR_draco_mesh_compression), as the city's
// landmark and kit GLBs: edgebreaker, speed 5, position 14 bits, normal 10, UV 12; JOINTS_0 / WEIGHTS_0 stay uint8
// (generic attributes, lossless). The decoded accessors are float (POSITION, NORMAL, TEXCOORD_0) and uint8
// (JOINTS_0, WEIGHTS_0 normalized), so KHR_mesh_quantization is dropped; images, skins, animations, nodes, names and
// materials are kept byte for byte. `--check` decodes each result with draco3d and compares it with the source
// (triangle count, bounds within 0.1 %, every source vertex's normal / UV / skin found on the decoded mesh).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const draco3d = require('draco3d');

const argv = process.argv.slice(2);
const files = argv.filter(a => a.endsWith('.glb'));
const outDir = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
const check = argv.includes('--check');

const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  const jl = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
  const o = 20 + jl, bl = b.readUInt32LE(o);
  return { json, bin: b.subarray(o + 8, o + 8 + bl), bytes: b.length };
}

/** An accessor's values as a plain typed array (count × components), de-interleaved; `float` = normalized to floats. */
function read(g, index, float) {
  const a = g.json.accessors[index], bv = g.json.bufferViews[a.bufferView];
  const T = CT[a.componentType], n = NC[a.type], el = T.BYTES_PER_ELEMENT;
  const stride = bv.byteStride || n * el, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const view = new DataView(g.bin.buffer, g.bin.byteOffset);
  const out = float ? new Float32Array(a.count * n) : new T(a.count * n);
  const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) {
    let v = view[get](base + i * stride + k * el, true);
    if (float && a.normalized) v = Math.max(v / NORM[a.componentType], -1);
    out[i * n + k] = v;
  }
  return out;
}

async function encodeFile(file, enc, dec) {
  const g = readGlb(file);
  const j = g.json;
  if (j.meshes.length !== 1 || j.meshes[0].primitives.length !== 1) throw new Error(`${file}: one mesh, one primitive expected`);
  const prim = j.meshes[0].primitives[0];
  if (prim.extensions?.KHR_draco_mesh_compression) throw new Error(`${file}: already Draco`);
  const A = prim.attributes;
  const idx = read(g, prim.indices, false);
  const pos = read(g, A.POSITION, true), nor = read(g, A.NORMAL, true), uv = read(g, A.TEXCOORD_0, true);
  const nV = j.accessors[A.POSITION].count;
  const skinned = A.JOINTS_0 !== undefined;
  const joints = skinned ? read(g, A.JOINTS_0, false) : null, weights = skinned ? read(g, A.WEIGHTS_0, false) : null;
  if (skinned && (j.accessors[A.JOINTS_0].componentType !== 5121 || j.accessors[A.WEIGHTS_0].componentType !== 5121)) throw new Error(`${file}: uint8 skin expected`);

  const builder = new enc.MeshBuilder(), mesh = new enc.Mesh();
  builder.AddFacesToMesh(mesh, idx.length / 3, Uint32Array.from(idx));
  const ids = {
    POSITION: builder.AddFloatAttribute(mesh, enc.POSITION, nV, 3, pos),
    NORMAL: builder.AddFloatAttribute(mesh, enc.NORMAL, nV, 3, nor),
    TEXCOORD_0: builder.AddFloatAttribute(mesh, enc.TEX_COORD, nV, 2, uv),
  };
  if (skinned) {
    ids.JOINTS_0 = builder.AddUInt8Attribute(mesh, enc.GENERIC, nV, 4, joints);
    ids.WEIGHTS_0 = builder.AddUInt8Attribute(mesh, enc.GENERIC, nV, 4, weights);
  }
  const encoder = new enc.Encoder();
  encoder.SetEncodingMethod(enc.MESH_EDGEBREAKER_ENCODING);
  encoder.SetSpeedOptions(5, 5);
  encoder.SetAttributeQuantization(enc.POSITION, 14);
  encoder.SetAttributeQuantization(enc.NORMAL, 10);
  encoder.SetAttributeQuantization(enc.TEX_COORD, 12);
  encoder.SetTrackEncodedProperties(true);
  const out = new enc.DracoInt8Array();
  const len = encoder.EncodeMeshToDracoBuffer(mesh, out);
  if (!(len > 0)) throw new Error(`${file}: Draco encoding failed`);
  const draco = new Uint8Array(len);
  for (let i = 0; i < len; i++) draco[i] = out.GetValue(i);
  const nPoints = encoder.GetNumberOfEncodedPoints(), nFaces = encoder.GetNumberOfEncodedFaces();
  enc.destroy(out); enc.destroy(encoder); enc.destroy(mesh); enc.destroy(builder);

  // decode once: the accessors' counts and the quantized positions' bounds (glTF needs POSITION min / max)
  const d = decodeDraco(dec, draco, ids);
  if (d.points !== nPoints || d.faces !== nFaces) throw new Error(`${file}: decoded ${d.points} / ${d.faces} vs ${nPoints} / ${nFaces}`);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < d.points; i++) for (let k = 0; k < 3; k++) { const v = d.POSITION[i * 3 + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }

  // the new JSON: the geometry bufferViews go, one Draco bufferView comes; every other view is kept byte for byte
  const geoViews = new Set([prim.indices, ...Object.values(A)].map(a => j.accessors[a].bufferView));
  const keep = j.bufferViews.map((_, i) => !geoViews.has(i));
  const remap = new Map();
  const views = [], chunks = [];
  let off = 0;
  const push = (bytes, extra) => {
    const pad = (4 - (off % 4)) % 4;
    if (pad) { chunks.push(new Uint8Array(pad)); off += pad; }
    views.push({ buffer: 0, byteOffset: off, byteLength: bytes.length, ...extra });
    chunks.push(bytes); off += bytes.length;
    return views.length - 1;
  };
  j.bufferViews.forEach((bv, i) => {
    if (!keep[i]) return;
    const { byteOffset = 0, byteLength, buffer, ...rest } = bv; void buffer;
    remap.set(i, push(g.bin.subarray(byteOffset, byteOffset + byteLength), rest));
  });
  const dracoView = push(draco, {});
  for (const a of j.accessors) if (a.bufferView !== undefined) { if (remap.has(a.bufferView)) a.bufferView = remap.get(a.bufferView); }
  for (const im of j.images ?? []) if (im.bufferView !== undefined) im.bufferView = remap.get(im.bufferView);
  const geo = (ai, componentType, type, extra = {}) => {
    const a = j.accessors[ai];
    for (const k of ['bufferView', 'byteOffset', 'normalized', 'min', 'max']) delete a[k];
    Object.assign(a, { componentType, count: type === 'SCALAR' ? nFaces * 3 : nPoints, type }, extra);
  };
  geo(prim.indices, nPoints > 65535 ? 5125 : 5123, 'SCALAR');
  geo(A.POSITION, 5126, 'VEC3', { min, max });
  geo(A.NORMAL, 5126, 'VEC3');
  geo(A.TEXCOORD_0, 5126, 'VEC2');
  if (skinned) { geo(A.JOINTS_0, 5121, 'VEC4'); geo(A.WEIGHTS_0, 5121, 'VEC4', { normalized: true }); }
  prim.extensions = { ...(prim.extensions ?? {}), KHR_draco_mesh_compression: { bufferView: dracoView, attributes: ids } };
  j.bufferViews = views;
  j.buffers = [{ byteLength: off + ((4 - (off % 4)) % 4) }];
  const quantLeft = j.accessors.some(a => a.bufferView !== undefined && (a.componentType !== 5126) && j.meshes.some(m => m.primitives.some(p => Object.values(p.attributes).includes(j.accessors.indexOf(a)))));
  const ext = new Set([...(j.extensionsUsed ?? []), 'KHR_draco_mesh_compression']);
  const req = new Set([...(j.extensionsRequired ?? []), 'KHR_draco_mesh_compression']);
  if (!quantLeft) { ext.delete('KHR_mesh_quantization'); req.delete('KHR_mesh_quantization'); }
  j.extensionsUsed = [...ext].sort(); j.extensionsRequired = [...req].sort();
  j.asset = { ...j.asset, generator: `${j.asset?.generator ?? ''} + lane V hero-draco.mjs (draco3d 1.5.7, edgebreaker, q 14/10/12)`.trim() };

  let jsonBuf = Buffer.from(JSON.stringify(j), 'utf8');
  if (jsonBuf.length % 4) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(4 - (jsonBuf.length % 4), 0x20)]);
  const binLen = j.buffers[0].byteLength;
  const bin = Buffer.alloc(binLen);
  let o = 0; for (const c of chunks) { bin.set(c, o); o += c.length; }
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  const glb = Buffer.concat([head, jh, jsonBuf, bh, bin]);
  const report = { file: path.basename(file), before: g.bytes, after: glb.length, triangles: nFaces, points: nPoints, sourceVertices: nV, draco: draco.length };
  if (check) report.check = compare({ pos, nor, uv, joints, weights, idx, nV }, d, skinned);
  return { glb, report };
}

function decodeDraco(dec, bytes, ids) {
  const decoder = new dec.Decoder(), buf = new dec.DecoderBuffer();
  buf.Init(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.length), bytes.length);
  const mesh = new dec.Mesh();
  const st = decoder.DecodeBufferToMesh(buf, mesh);
  if (!st.ok()) throw new Error(`draco decode: ${st.error_msg()}`);
  const points = mesh.num_points(), faces = mesh.num_faces();
  const out = { points, faces };
  for (const [name, id] of Object.entries(ids)) {
    const att = decoder.GetAttributeByUniqueId(mesh, id);
    const n = att.num_components();
    if (name === 'JOINTS_0' || name === 'WEIGHTS_0') {
      const arr = new dec.DracoUInt8Array(); decoder.GetAttributeUInt8ForAllPoints(mesh, att, arr);
      out[name] = Uint8Array.from({ length: points * n }, (_, i) => arr.GetValue(i)); dec.destroy(arr);
    } else {
      const arr = new dec.DracoFloat32Array(); decoder.GetAttributeFloatForAllPoints(mesh, att, arr);
      out[name] = Float32Array.from({ length: points * n }, (_, i) => arr.GetValue(i)); dec.destroy(arr);
    }
  }
  const ia = new dec.DracoInt32Array(), index = new Uint32Array(faces * 3);
  for (let f = 0; f < faces; f++) { decoder.GetFaceFromMesh(mesh, f, ia); for (let k = 0; k < 3; k++) index[f * 3 + k] = ia.GetValue(k); }
  out.index = index;
  dec.destroy(ia); dec.destroy(mesh); dec.destroy(buf); dec.destroy(decoder);
  return out;
}

/** Every source vertex has a decoded point at its position (within the quantization step) with a close normal, UV and the same skin. */
function compare(src, d, skinned) {
  const bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < src.nV; i++) for (let k = 0; k < 3; k++) { bmin[k] = Math.min(bmin[k], src.pos[i * 3 + k]); bmax[k] = Math.max(bmax[k], src.pos[i * 3 + k]); }
  const span = Math.max(...[0, 1, 2].map(k => bmax[k] - bmin[k]));
  const tolP = span / (1 << 14) * 2, cell = tolP * 4;
  const grid = new Map();
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < d.points; i++) { const k = key(d.POSITION[i * 3], d.POSITION[i * 3 + 1], d.POSITION[i * 3 + 2]); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(i); }
  let worstN = 0, worstUV = 0, worstP = 0, skinBad = 0, missing = 0;
  const degs = [];
  for (let i = 0; i < src.nV; i++) {
    const x = src.pos[i * 3], y = src.pos[i * 3 + 1], z = src.pos[i * 3 + 2];
    let best = null, bestScore = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const p of grid.get(`${Math.floor(x / cell) + dx},${Math.floor(y / cell) + dy},${Math.floor(z / cell) + dz}`) ?? []) {
        const dp = Math.hypot(d.POSITION[p * 3] - x, d.POSITION[p * 3 + 1] - y, d.POSITION[p * 3 + 2] - z);
        if (dp > tolP * 2) continue;
        const du = Math.hypot(d.TEXCOORD_0[p * 2] - src.uv[i * 2], d.TEXCOORD_0[p * 2 + 1] - src.uv[i * 2 + 1]);
        // (the source normals are int8: |n| = 0.99 … 1.01, so compare directions, not raw dot products)
        const ax = src.nor[i * 3], ay = src.nor[i * 3 + 1], az = src.nor[i * 3 + 2], bx = d.NORMAL[p * 3], by = d.NORMAL[p * 3 + 1], bz = d.NORMAL[p * 3 + 2];
        const dn = 1 - (ax * bx + ay * by + az * bz) / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz) || 1);
        const score = dn * 1e4 + du * 1e3 + dp / tolP;
        if (score < bestScore) { bestScore = score; best = { p, dp, du, dn }; }
      }
    }
    if (!best) { missing++; continue; }
    worstP = Math.max(worstP, best.dp); worstUV = Math.max(worstUV, best.du);
    const deg = Math.acos(Math.min(1, 1 - best.dn)) * 180 / Math.PI;
    worstN = Math.max(worstN, deg); degs.push(deg);
    if (skinned) for (let k = 0; k < 4; k++) if (d.JOINTS_0[best.p * 4 + k] !== src.joints[i * 4 + k] || d.WEIGHTS_0[best.p * 4 + k] !== src.weights[i * 4 + k]) { skinBad++; break; }
  }
  degs.sort((a, b) => a - b);
  const q = p => +(degs[Math.floor(p * (degs.length - 1))] ?? 0).toFixed(2);
  return { missing, normalDegP99: q(0.99), worstPos: +worstP.toFixed(5), posTol: +tolP.toFixed(5), worstUV: +worstUV.toFixed(5), worstNormalDeg: +worstN.toFixed(2), skinMismatch: skinBad };
}

const enc = await draco3d.createEncoderModule({});
const dec = await draco3d.createDecoderModule({});
let before = 0, after = 0;
for (const f of files) {
  const { glb, report } = await encodeFile(f, enc, dec);
  const dst = outDir ? path.join(outDir, path.basename(f)) : f;
  fs.writeFileSync(dst, glb);
  before += report.before; after += report.after;
  console.log(JSON.stringify(report));
}
console.log(`total ${before} -> ${after} B (${((1 - after / before) * 100).toFixed(1)} % smaller)`);
