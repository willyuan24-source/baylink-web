import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type * as THREE_NS from 'three';

/**
 * Hero regression (plan G0): pins the district-mode World — every static mesh's vertex / triangle counts and
 * a sha256 of its raw attribute + index bytes (positions, normals, colours, aInfo, uvs, instance data) — so
 * renderer refactors (recipes moved out of city.ts, TypedBatch, material patches) prove byte-identical output.
 * The World builds headless: the label atlas / board-shadow canvases are stubbed (their pixels are excluded;
 * label quad geometry and uvs are included). Regenerate after an intended district change with
 *   OB_HERO_PRINT=1 npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-hero-regression.test.ts
 * and paste the printed table over BASELINE (say why in the change).
 */

// --- headless canvas stub (must exist before world modules create their atlases) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { World } = await import('../src/opus-bay/world/world');
const { terrainGrid } = await import('../src/opus-bay/core/terrain');

type Row = readonly [name: string, vertices: number, triangles: number, hash: string];

/**
 * Static world meshes only: the diorama environment (sky / table / board shadow), labels, contact blobs, the
 * chunked ground / city / water, hero landmarks, the market, halos and lamp pools, and the instanced props.
 * Moving actors (streetcars, ferries, gulls, pedestrians, fx …) and the live clock hands belong to other lanes'
 * tests and are not pinned here.
 */
const STATIC = /^(sky|table|board-shadow|labels|blob-shadows|(ground|city|water)#\d+|hero:.+|market-(open|closed)|halos|lamp-pools|cones|crates|buoys|small-boats)$/;

function bytes(a: ArrayLike<number> & { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }) {
  return new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
}

function meshRow(m: THREE_NS.Mesh): Row {
  const geo = m.geometry;
  const h = createHash('sha256');
  const mat = Array.isArray(m.material) ? m.material.map(x => x.name).join('|') : m.material.name;
  h.update(`${m.type}|${mat}|${m.renderOrder}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}`);
  for (const name of Object.keys(geo.attributes).sort()) {
    const a = geo.getAttribute(name) as THREE_NS.BufferAttribute;
    h.update(`|${name}:${a.itemSize}:${a.normalized ? 1 : 0}:${a.array.constructor.name}`);
    h.update(bytes(a.array as Float32Array));
  }
  const idx = geo.getIndex();
  if (idx) { h.update(`|index:${idx.array.constructor.name}`); h.update(bytes(idx.array as Uint16Array)); }
  const inst = m as unknown as THREE_NS.InstancedMesh;
  if (inst.isInstancedMesh) {
    h.update(`|inst:${inst.count}`);
    h.update(bytes(inst.instanceMatrix.array as Float32Array));
    if (inst.instanceColor) h.update(bytes(inst.instanceColor.array as Float32Array));
  }
  h.update(`|m:${m.matrix.elements.join(',')}`);
  const verts = geo.getAttribute('position')?.count ?? 0;
  const tris = (idx ? idx.count : verts) / 3;
  return [m.name, verts, tris, h.digest('hex').slice(0, 16)];
}

function measure() {
  const world = new World();
  const rows: Row[] = [];
  world.root.traverse(o => {
    const m = o as THREE_NS.Mesh;
    if (!m.isMesh || !STATIC.test(m.name)) return;
    rows.push(meshRow(m));
  });
  const t = terrainGrid();
  const th = createHash('sha256');
  th.update(`${t.cell}|${t.minX}|${t.minZ}|${t.cols}|${t.rows}`);
  for (const a of [t.height, t.surface, t.kind, t.stand]) th.update(bytes(a));
  return { stats: { ...world.stats }, rows, terrain: th.digest('hex').slice(0, 16) };
}

// --- baseline (measured 2026-09-26, before the M0 renderer refactor) ---
const BASELINE_STATS = { vertices: 375899, triangles: 232511, chunks: 62 };
const BASELINE_TERRAIN = 'b7489cf5811ae266';
const BASELINE: Row[] = [
  ['sky', 561, 960, 'b1ae30626f35fd14'],
  ['table', 50, 48, 'e05e4d106a21a3ef'],
  ['board-shadow', 4, 2, '036754a49ef55eb6'],
  ['labels', 128, 64, 'e33f95de89741da6'],
  ['blob-shadows', 724, 362, 'e5d98d0a6fdbcdab'],
  ['ground#0', 8381, 6430, 'ee240326502b5af8'],
  ['ground#1', 13666, 11677, '47c0ef2b9065dab3'],
  ['ground#2', 5510, 3595, '6fa36a572d6d7dd4'],
  ['ground#3', 7131, 5032, 'ba119f1618cffc95'],
  ['ground#4', 4757, 2780, '32cd7b3207afeb8a'],
  ['ground#5', 3541, 1780, '3f7a28b6897e91da'],
  ['ground#6', 19889, 24622, '566f1b7d08a30537'],
  ['ground#7', 5055, 2666, '765fee2ac7ce9679'],
  ['ground#8', 3929, 2492, 'b91c50be9511bdb1'],
  ['ground#9', 3336, 1704, '409318911a7029f1'],
  ['ground#10', 5279, 3161, '5515e4a44a7af002'],
  ['ground#11', 2916, 2640, 'fc563c5ebf7ebb59'],
  ['ground#12', 962, 611, '5ad1e6d30754754d'],
  ['ground#13', 1590, 1165, 'a62634f0765fa1ab'],
  ['ground#14', 951, 490, '6edb432652721e1d'],
  ['ground#15', 1587, 1011, '7c0094bca741a10a'],
  ['ground#16', 239, 148, 'c2a10977a60f7d9c'],
  ['ground#17', 2220, 1395, '8200518c4a20ea4a'],
  ['ground#18', 679, 433, '41964da5d6feb302'],
  ['ground#19', 3093, 1936, '3bfb11c548cc0058'],
  ['ground#20', 2897, 2112, 'fa6c4e687c66685f'],
  ['ground#21', 3793, 3133, '403d9b0175c2526f'],
  ['ground#22', 3107, 1992, 'dd0f7bf24752dc64'],
  ['ground#23', 1383, 848, '3e9239a6aa4ec7ac'],
  ['ground#24', 2665, 1533, '4f66259956f4ebbe'],
  ['ground#25', 933, 502, '6fdc019d1ec58abc'],
  ['city#0', 16119, 7665, '6ee396bbbeb2a53b'],
  ['city#1', 25727, 11687, '71c446bcb9167258'],
  ['city#2', 44826, 26203, 'e197ea957354051e'],
  ['city#3', 44379, 23380, '3dbbb54837b648fe'],
  ['city#4', 65721, 26944, '5b9e8edc1bce023e'],
  ['city#5', 7670, 4198, '7adfb3a19bb2a777'],
  ['city#6', 16349, 8857, '811fa2d3cd9474f5'],
  ['city#7', 9197, 5111, 'bcd6d01d237bf45d'],
  ['city#8', 4182, 1618, '233184a55cb09884'],
  ['city#9', 1056, 352, '3709b14e73ce201e'],
  ['city#10', 5092, 1904, '14478849a6adb0cb'],
  ['city#11', 1266, 476, '1de44f4dd280e375'],
  ['city#12', 124, 56, 'a141f406fdd866f7'],
  ['city#13', 666, 264, '2e6137474f480356'],
  ['city#14', 254, 96, '4a30ef0c9eb59375'],
  ['city#15', 86, 32, 'df96951e60561282'],
  ['city#16', 189, 69, '747853c88aea6caa'],
  ['city#17', 461, 179, '1847bdc0648e5db8'],
  ['city#18', 146, 52, '7eba8ad00aee249f'],
  ['city#19', 2248, 948, 'bbb68efd39f8d4b3'],
  ['city#20', 200, 76, 'c006a22c86c55018'],
  ['city#21', 1170, 390, '47578b3c97c2cc66'],
  ['city#22', 810, 270, 'deacf1b2eba97b0c'],
  ['city#23', 1440, 480, 'ab17010b363951db'],
  ['city#24', 660, 220, 'e04db8d7c022889b'],
  ['city#25', 498, 166, 'ca0f580fa67d5715'],
  ['city#26', 1146, 382, '012b15c4229dc9ea'],
  ['water#0', 3593, 5558, '1e389479d2595369'],
  ['water#1', 4269, 6769, 'c1fd25c5b8728cb9'],
  ['water#2', 2446, 4325, '26db3c4816a3e7ad'],
  ['water#3', 2445, 4635, 'e1385054c2ba5c48'],
  ['water#4', 789, 1404, '359df0a70d6a3798'],
  ['water#5', 194, 309, '1880bb3daf3dacd4'],
  ['water#6', 487, 868, '4ec21e06431db0db'],
  ['water#7', 91, 142, 'd041978a5d853ab1'],
  ['water#8', 286, 474, '6c7d01c2b195798b'],
  ['hero:ferry-building', 1894, 1342, '826834188d229ca3'],
  ['hero:ferry-tower', 1367, 1017, 'bb0e9ce094e8627e'],
  ['hero:coit-tower', 1259, 816, '04f432e1d6836f11'],
  ['hero:transamerica', 817, 404, '921589125a926317'],
  ['hero:salesforce-tower', 464, 224, 'a6ebe9f1d7cfe2eb'],
  ['hero:pier39', 260, 136, 'e95359f48d8a779e'],
  ['hero:pier33', 548, 320, 'c6877075a4f4a048'],
  ['hero:cruise-terminal', 68, 34, '627e4954b4ba924b'],
  ['hero:weekly-board', 722, 390, '94e399b9904c2996'],
  ['hero:levis-plaza', 424, 256, 'db2e95d5f8c85885'],
  ['hero:streetcar-stops', 712, 368, 'd0abb3d6939816cf'],
  ['hero:telescopes', 1320, 792, '9de9ed8b82226c96'],
  ['market-open', 5280, 3900, '8903bb70786155a2'],
  ['market-closed', 1176, 588, 'ad1f1764f4b1b112'],
  ['halos', 4, 2, '75e5aa3d2e0281ca'],
  ['lamp-pools', 4, 2, '63deeeb1770e665e'],
  ['cones', 216, 132, '2897987ff00c16c7'],
  ['crates', 72, 36, '1a2125fc02733756'],
  ['buoys', 198, 132, 'fed4772a4ce807ed'],
  ['small-boats', 128, 68, 'fb053ac06ccce5bd'],
];

const result = measure();

if (process.env.OB_HERO_PRINT) {
  console.log(`const BASELINE_STATS = ${JSON.stringify(result.stats).replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ': ').replace('{', '{ ').replace('}', ' }')};`);
  console.log(`const BASELINE_TERRAIN = '${result.terrain}';`);
  console.log('const BASELINE: Row[] = [');
  for (const r of result.rows) console.log(`  ['${r[0]}', ${r[1]}, ${r[2]}, '${r[3]}'],`);
  console.log('];');
}

test('district World static geometry totals are pinned (vertices / triangles / chunks)', () => {
  assert.deepEqual(result.stats, BASELINE_STATS);
});

test('district terrain grid (height / surface / kind / stand) is byte-identical', () => {
  assert.equal(result.terrain, BASELINE_TERRAIN);
});

test('every district mesh is byte-identical to the baseline (per chunk: counts + attribute/index hash)', () => {
  const want = new Map(BASELINE.map(r => [r[0], r]));
  const got = new Map(result.rows.map(r => [r[0], r]));
  const diffs: string[] = [];
  for (const [name, r] of want) {
    const q = got.get(name);
    if (!q) diffs.push(`missing ${name}`);
    else if (q[1] !== r[1] || q[2] !== r[2] || q[3] !== r[3]) diffs.push(`${name}: v ${r[1]}→${q[1]} t ${r[2]}→${q[2]} hash ${r[3]}→${q[3]}`);
  }
  for (const name of got.keys()) if (!want.has(name)) diffs.push(`new ${name}`);
  assert.equal(result.rows.length, BASELINE.length, 'mesh count');
  assert.deepEqual(diffs, [], `district geometry changed:\n${diffs.join('\n')}`);
});

test('the World builds deterministically (two builds hash the same)', () => {
  const again = measure();
  assert.deepEqual(again.rows, result.rows);
});

// ---------------------------------------------------------------------------
// Renderer foundation for the streamed city (M0): TypedBatch, city recipes, material patches
// ---------------------------------------------------------------------------

const THREE = await import('three');
const fs = await import('node:fs');
const path = await import('node:path');
const { Batch } = await import('../src/opus-bay/world/builder');
const { TypedBatch } = await import('../src/opus-bay/world/typedBatch');
const { CITY_FLAG, CITY_ROOFS, CITY_STYLES, cityLook, toyBuildingL0, toyBuildingL1 } = await import('../src/opus-bay/world/recipes/city');
const { districtBuilding } = await import('../src/opus-bay/world/recipes/district');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const { GROUND, TOY } = await import('../src/opus-bay/world/materials');
type Spec = import('../src/opus-bay/world/recipes/city').CityBuildingSpec;

/** Rectangle rotated like SF's street grid, CCW. */
function rect(cx: number, cz: number, w: number, d: number, rot = 0.8): { x: number; z: number }[] {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => ({ x: cx + x * c - z * s, z: cz + x * s + z * c }));
}
/** 12-vertex notched footprint (the plan's simplification cap). */
function notched(cx: number, cz: number, w: number, d: number): { x: number; z: number }[] {
  const pts: [number, number][] = [[0, 0], [w * 0.4, 0], [w * 0.4, 0.6], [w * 0.6, 0.6], [w * 0.6, 0], [w, 0], [w, d * 0.7], [w - 0.8, d * 0.7], [w - 0.8, d], [0.8, d], [0.8, d * 0.7], [0, d * 0.7]];
  return pts.map(([x, z]) => ({ x: cx + x - w / 2, z: cz + z - d / 2 }));
}
const TALL = new Set(['office', 'tower']);
function specs(): Spec[] {
  const out: Spec[] = [];
  let seed = 1;
  for (const style of CITY_STYLES) for (const roof of CITY_ROOFS) for (const flags of [0, CITY_FLAG.shop, CITY_FLAG.shop | CITY_FLAG.corner, CITY_FLAG.glass]) {
    const tall = TALL.has(style);
    const H = style === 'tower' ? 48 : tall ? 18 : style === 'chinatown' || style === 'brick' || style === 'deco' ? 9 : 5.2;
    const [w, d] = tall ? [12, 12] : [5, 10];
    for (const poly of [rect(seed * 3, 40, w, d), notched(seed * 3, 80, w, d)]) {
      out.push({ poly, baseY: 2.5, H, style, roof, palette: seed, seed: 90000 + seed * 7919, flags, front: seed % 2 ? 0 : undefined });
      seed++;
    }
  }
  return out;
}

test('TypedBatch writes the same geometry as Batch (quantized normals / colours, 36 B per vertex)', () => {
  const tb = new TypedBatch(16), fb = new Batch();
  for (const s of specs()) { toyBuildingL0(tb, s); toyBuildingL0(fb, s); toyBuildingL1(tb, s); toyBuildingL1(fb, s); }
  DISTRICT.blocks.slice(0, 60).forEach((lot, i) => { districtBuilding(tb, lot, i, () => 1.5); districtBuilding(fb, lot, i, () => 1.5); });
  fb.ribbon([{ x: 0, z: 0 }, { x: 5, z: 1 }, { x: 9, z: -2 }], 1.2, x => x * 0.1, '#a29d96', [5, 0, 0, 1]);
  tb.ribbon([{ x: 0, z: 0 }, { x: 5, z: 1 }, { x: 9, z: -2 }], 1.2, x => x * 0.1, '#a29d96', [5, 0, 0, 1]);
  const a = tb.toArrays();
  assert.equal(a.vertexCount, fb.vertexCount);
  assert.equal(a.indexCount, fb.idx.length);
  assert.ok(a.vertexCount > 65535 ? a.index instanceof Uint32Array : a.index instanceof Uint16Array);
  let maxN = 0, maxC = 0;
  for (let i = 0; i < a.vertexCount; i++) {
    for (let k = 0; k < 3; k++) {
      assert.equal(a.position[i * 3 + k], Math.fround(fb.pos[i * 3 + k]));
      maxN = Math.max(maxN, Math.abs(a.normal[i * 4 + k] / 127 - fb.nor[i * 3 + k]));
      maxC = Math.max(maxC, Math.abs(a.color[i * 4 + k] / 255 - Math.min(1, Math.max(0, fb.col[i * 3 + k]))));
    }
    assert.equal(a.normal[i * 4 + 3], 0);
    assert.equal(a.color[i * 4 + 3], 255);
    for (let k = 0; k < 4; k++) assert.equal(a.info[i * 4 + k], Math.fround(fb.inf[i * 4 + k]));
  }
  assert.ok(maxN <= 0.5 / 127 + 1e-6, `normal error ${maxN}`);
  assert.ok(maxC <= 0.5 / 255 + 1e-6, `colour error ${maxC}`);
  for (let i = 0; i < a.indexCount; i++) assert.equal(a.index[i], fb.idx[i]);
  const perVertex = (a.position.byteLength + a.normal.byteLength + a.color.byteLength + a.info.byteLength) / a.vertexCount;
  assert.equal(perVertex, 36);
});

test('TypedBatch arrays: trimmed transferable buffers, bounds, geometry layout the TOY / GROUND programs accept', () => {
  const tb = new TypedBatch(8);
  toyBuildingL0(tb, { poly: rect(100, -50, 6, 10), baseY: 3, H: 12, style: 'deco', roof: 'flat', palette: 1, seed: 7, flags: 0 });
  const a = tb.toArrays();
  const bufs = TypedBatch.transferables(a);
  assert.equal(new Set(bufs).size, 6, 'six distinct buffers');
  assert.equal(a.position.buffer.byteLength, a.vertexCount * 12, 'trimmed, not the grown capacity');
  const [x0, y0, z0, x1, y1, z1] = a.bounds;
  for (let i = 0; i < a.vertexCount; i++) {
    const x = a.position[i * 3], y = a.position[i * 3 + 1], z = a.position[i * 3 + 2];
    assert.ok(x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1);
  }
  const geo = TypedBatch.toGeometry(a);
  const color = geo.getAttribute('color') as THREE_NS.InterleavedBufferAttribute;
  assert.equal(color.itemSize, 3, 'a 3-component colour keeps the district programs (no vertex-alpha variant)');
  assert.equal(color.data.stride, 4);
  assert.ok(color.normalized);
  assert.ok(Math.abs(color.getX(0) - a.color[0] / 255) < 1e-6);
  const normal = geo.getAttribute('normal') as THREE_NS.BufferAttribute;
  assert.ok(normal.normalized && normal.array instanceof Int8Array && normal.itemSize === 4);
  assert.equal(geo.getAttribute('aInfo').itemSize, 4);
  assert.ok(geo.boundingSphere && geo.boundingSphere.radius > 5);
  // a BatchedMesh accepts it (L1 / L2 pools) and repacks the colour into its own buffer
  const pool = new THREE.BatchedMesh(4, 4096, 8192, TOY);
  const id = pool.addGeometry(geo);
  pool.addInstance(id);
  const pc = pool.geometry.getAttribute('color') as THREE_NS.BufferAttribute;
  assert.equal(pc.itemSize, 3);
  assert.ok(Math.abs(pc.getX(0) - color.getX(0)) < 1 / 255 + 1e-6);
  tb.reset();
  assert.equal(tb.vertexCount, 0);
  assert.equal(tb.toArrays().bounds.length, 6);
});

test('city toy buildings stay in budget: L0 house <= 250 tris, tower <= 600 (up to 12-vertex footprints, storefront + corner), L1 10-14', () => {
  const worst: Record<string, number> = {};
  for (const s of specs()) {
    const b0 = new TypedBatch(), b1 = new TypedBatch();
    toyBuildingL0(b0, s);
    toyBuildingL1(b1, s);
    const cap = TALL.has(s.style) ? 600 : 250;
    assert.ok(b0.triangleCount <= cap, `${s.style}/${s.roof}/${s.flags} n=${s.poly.length}: ${b0.triangleCount} L0 tris`);
    assert.ok(b1.triangleCount >= 10 && b1.triangleCount <= 14, `${s.style}/${s.roof} L1 ${b1.triangleCount}`);
    worst[s.style] = Math.max(worst[s.style] ?? 0, b0.triangleCount);
  }
  if (process.env.OB_HERO_PRINT) console.log('worst L0 triangles per style', worst);
  // every style draws walls with TOY procedural windows and a per-building (negative) window seed
  for (const style of CITY_STYLES) {
    const b = new TypedBatch();
    toyBuildingL0(b, { poly: rect(0, 0, 8, 10), baseY: 0, H: 9, style, roof: 'flat', palette: 0, seed: 5, flags: 0 });
    const a = b.toArrays();
    let windows = 0;
    for (let i = 0; i < a.vertexCount; i++) if (a.info[i * 4] > 0.5 && a.info[i * 4] < 8.5 && a.info[i * 4] !== 7 && a.info[i * 4 + 2] < 0) windows++;
    assert.ok(windows >= 16, `${style} has window walls`);
  }
  assert.equal(Object.keys(worst).length, CITY_STYLES.length);
});

test('city recipes are deterministic and L0 / L1 share one look (no colour pop between tiers)', () => {
  for (const s of specs().slice(0, 24)) {
    const a = new TypedBatch(), b = new TypedBatch();
    toyBuildingL0(a, s); toyBuildingL0(b, s);
    assert.deepEqual(a.toArrays().position, b.toArrays().position);
    assert.deepEqual(a.toArrays().color, b.toArrays().color);
    const l1 = new TypedBatch();
    toyBuildingL1(l1, s);
    const look = cityLook(s);
    const wall = [look.wall.r, look.wall.g, look.wall.b].map(v => Math.round(Math.min(1, v) * 255));
    const has = (arr: Uint8Array) => { for (let i = 0; i < arr.length; i += 4) if (arr[i] === wall[0] && arr[i + 1] === wall[1] && arr[i + 2] === wall[2]) return true; return false; };
    assert.ok(has(a.toArrays().color) && has(l1.toArrays().color), `${s.style} wall colour in both tiers`);
  }
});

test('recipe enums match the chunk format (lane A world/sf/format.ts STYLES / ROOFS, flag bits disjoint)', async () => {
  const fmt = await import('../src/opus-bay/world/sf/format');
  assert.deepEqual([...CITY_STYLES], [...fmt.STYLES]);
  assert.deepEqual([...CITY_ROOFS], [...fmt.ROOFS]);
  const sfBits = Object.values(fmt.BUILDING_FLAG).reduce((m, v) => m | v, 0);
  for (const bit of Object.values(CITY_FLAG)) assert.equal(bit & sfBits, 0, `CITY_FLAG ${bit} collides with BUILDING_FLAG`);
  assert.ok(Math.max(...Object.values(CITY_FLAG)) <= 0xffff, 'fits the u16 flags');
});

test('worker-safe: typedBatch.ts and recipes/* import only three, builder, palette and each other', () => {
  const root = path.resolve('src/opus-bay/world');
  const allowed = new Set(['builder.ts', 'typedBatch.ts', 'palette.ts', '../core/geo.ts', 'recipes/city.ts', 'recipes/shapes.ts', 'recipes/palettes.ts', 'recipes/district.ts']);
  const seen = new Set<string>();
  const walk = (rel: string) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    assert.ok(allowed.has(rel), `worker bundle would pull in ${rel}`);
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(!/\bdocument\.|\bwindow\./.test(src), `${rel} touches the DOM`);
    for (const m of src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm)) {
      const spec = m[1];
      if (spec === 'three') continue;
      assert.ok(spec.startsWith('.'), `bare import ${spec} in ${rel}`);
      walk(path.relative(root, path.resolve(path.dirname(path.join(root, rel)), spec)).replace(/\\/g, '/') + '.ts');
    }
  };
  walk('typedBatch.ts');
  walk('recipes/city.ts');
  assert.ok(seen.has('recipes/shapes.ts') && seen.has('builder.ts'));
});

test('TOY / GROUND patches apply to the standard shader (instancing + batching normal, window fade, city flag)', () => {
  const lib = THREE.ShaderLib.standard;
  const run = (m: THREE_NS.Material) => {
    const shader = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: {} } as unknown as THREE_NS.WebGLProgramParametersWithUniforms;
    m.onBeforeCompile(shader, undefined as unknown as THREE_NS.WebGLRenderer);
    return shader;
  };
  const toy = run(TOY);
  assert.match(toy.vertexShader, /obBm = mat3\(batchingMatrix\)/);
  assert.match(toy.vertexShader, /obIm = mat3\(instanceMatrix\)/);
  assert.match(toy.vertexShader, /obWp = batchingMatrix \* obWp/);
  assert.match(toy.fragmentShader, /float unres = smoothstep\(0\.35, 1\.2/);
  assert.ok(toy.vertexShader.indexOf('#include <batching_vertex>') < toy.vertexShader.indexOf('obBm'), 'batchingMatrix is declared before the normal patch');
  const ground = run(GROUND);
  assert.match(ground.fragmentShader, /uBDistOn > 0\.5 && vInfo\.w < 0\.5/);
});

test('W4-V part b (verify-visual F9): city mode carries the F-line poles on along Jefferson St to the wires\' end; district mode draws exactly what it did', async () => {
  const { buildGround } = await import('../src/opus-bay/world/ground');
  const { Batch } = await import('../src/opus-bay/world/builder');
  const { DISTRICT, stationOf } = await import('../src/opus-bay/data/district');
  const run = (wharfPoles?: boolean) => { const g = new Batch(), t = new Batch(); buildGround(g, t, { slab: false, wharfPoles }); return { g: g.vertexCount, t: t.vertexCount, pos: (t as unknown as { pos: number[] }).pos }; };
  const plain = run(), again = run(false), city = run(true);
  assert.deepEqual([again.g, again.t], [plain.g, plain.t], 'the option off is the district path');
  assert.equal(city.g, plain.g, 'no ground change');
  const added = city.t - plain.t;
  assert.ok(added > 0 && added < 400, `${added} vertices of poles`);
  // the new vertices are poles (0 … 5.6 u high) beyond station 368 on the median, and the last stands within 7 u of the wires' end
  const median = DISTRICT.roads.find(r => r.id === 'embarcadero-median')!;
  const end = median.points[median.points.length - 1];
  // the poles go in where the district's stop (buildRoads, before the ramps and piers): the first differing vertex
  let at = 0;
  while (at < plain.t && plain.pos[at * 3] === city.pos[at * 3] && plain.pos[at * 3 + 1] === city.pos[at * 3 + 1] && plain.pos[at * 3 + 2] === city.pos[at * 3 + 2]) at++;
  for (let i = at; i < plain.t; i++) for (let k = 0; k < 3; k++) assert.equal(city.pos[(i + added) * 3 + k], plain.pos[i * 3 + k], 'the rest follows unchanged');
  let near = Infinity, maxY = 0, beyond = true;
  for (let i = at; i < at + added; i++) {
    const x = city.pos[i * 3], y = city.pos[i * 3 + 1], z = city.pos[i * 3 + 2];
    maxY = Math.max(maxY, y);
    if (stationOf({ x, z }).st < 360) beyond = false;
    near = Math.min(near, Math.hypot(x - end.x, z - end.z));
  }
  assert.ok(beyond, 'only beyond the district poles');
  assert.ok(maxY < 5.8, `top ${maxY}`);
  assert.ok(near < 7, `last pole ${near.toFixed(1)} u from the wires' end`);
});
