import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AREA_FLAG, CHUNK_FLAG, DEM_N, type ChunkData, type FarData, SfFormatError, type WalkGraph, computeDistrictHash, decodeChunk, decodeChunkFile, decodeFar, decodeGraph,
  decodeGraphFile, demSample, encodeChunk, encodeFar, encodeGraph, gunzip, gzip,
} from '../src/opus-bay/world/sf/format';

// deterministic pseudo-random numbers
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };

function sampleChunk(cx: number, cz: number): ChunkData {
  const ox = cx * 128, oz = cz * 128;
  const y = new Float32Array(DEM_N * DEM_N);
  for (let j = 0; j < DEM_N; j++) for (let i = 0; i < DEM_N; i++) y[j * DEM_N + i] = Math.round((20 + 15 * Math.sin(i / 9) * Math.cos(j / 7)) * 500) / 500;
  // buildings: 3–8 vertex footprints, some overhanging the chunk
  const nb = 40, vs: number[] = [], xz: number[] = [];
  for (let b = 0; b < nb; b++) {
    const n = 3 + (b % 6), cxw = ox - 10 + rnd() * 148, czw = oz - 10 + rnd() * 148, r = 1 + rnd() * 6;
    vs.push(xz.length / 2);
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; xz.push(cxw + Math.cos(a) * r, czw + Math.sin(a) * r); }
  }
  vs.push(xz.length / 2);
  const roads: number[] = [], rs: number[] = [];
  for (let k = 0; k < 12; k++) {
    rs.push(roads.length / 3);
    const n = 2 + (k % 5);
    for (let p = 0; p < n; p++) roads.push(ox - 8 + rnd() * 144, rnd() * 60, oz - 8 + rnd() * 144);
  }
  rs.push(roads.length / 3);
  const areas = [ox - 1, oz - 1, ox + 129, oz - 1, ox + 129, oz + 129, ox - 1, oz + 129, ox + 20, oz + 20, ox + 40, oz + 20, ox + 30, oz + 40];
  return {
    cx, cz, flags: CHUNK_FLAG.land | CHUNK_FLAG.shore,
    dem: { originX: ox, originZ: oz, step: 2, cols: DEM_N, rows: DEM_N, y },
    buildings: {
      count: nb, style: Uint8Array.from({ length: nb }, (_, i) => i % 13), roof: Uint8Array.from({ length: nb }, (_, i) => i % 3), palette: Uint8Array.from({ length: nb }, (_, i) => i % 55),
      flags: Uint16Array.from({ length: nb }, (_, i) => (i * 37) & 511), height: Float32Array.from({ length: nb }, (_, i) => 3.6 + i * 1.07), baseY: Float32Array.from({ length: nb }, (_, i) => i * 0.9),
      osmId: Uint32Array.from({ length: nb }, (_, i) => (i % 2 ? 4000000000 - i * 977 : 26278061 + i * 13)), vStart: Uint32Array.from(vs), xz: Float32Array.from(xz),
    },
    roads: {
      count: 12, cls: Uint8Array.from({ length: 12 }, (_, i) => i % 15), width: Float32Array.from({ length: 12 }, (_, i) => [3.6, 4.4, 5.6, 1.2][i % 4]),
      nameIdx: Uint16Array.from({ length: 12 }, (_, i) => (i % 3 ? i : 0xffff)), flags: Uint8Array.from({ length: 12 }, (_, i) => (i * 17) & 255), pStart: Uint32Array.from(rs), xyz: Float32Array.from(roads),
    },
    areas: { count: 2, cls: Uint8Array.from([0, 2]), flags: Uint8Array.from([0, AREA_FLAG.hole]), pStart: Uint32Array.from([0, 4, 7]), xz: Float32Array.from(areas) },
    props: { count: 5, kind: Uint8Array.from([0, 0, 3, 4, 6]), variant: Uint8Array.from([0, 1, 0, 0, 0]), xz: Float32Array.from([ox + 1, oz + 2, ox + 3, oz + 4, ox + 50, oz + 60, ox + 70, oz + 80, ox + 127, oz + 127]), rot: Float32Array.from([0, 1, -1, 3, -3]) },
    places: { count: 2, place: Uint16Array.from([0, 1026]), xz: Float32Array.from([ox + 10, oz + 10, ox + 100, oz + 5]) },
  };
}

const near = (a: ArrayLike<number>, b: ArrayLike<number>, tol: number, what: string) => {
  assert.equal(a.length, b.length, `${what} length`);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) <= tol, `${what}[${i}]: ${a[i]} vs ${b[i]}`);
};

test('OBC1 chunk round trip: decoded values within quantisation, re-encode is byte-identical', () => {
  for (const [cx, cz] of [[0, 0], [-8, 16], [11, -7], [-3, 5]]) {
    const d = sampleChunk(cx, cz);
    const bytes = encodeChunk(d);
    const back = decodeChunk(bytes);
    assert.equal(back.cx, cx); assert.equal(back.cz, cz); assert.equal(back.flags, d.flags);
    near(back.dem.y, d.dem.y, 1e-3, 'dem');
    assert.equal(back.dem.originX, cx * 128); assert.equal(back.dem.step, 2);
    assert.equal(back.buildings.count, d.buildings.count);
    near(back.buildings.xz, d.buildings.xz, 1 / 256 + 1e-4, 'building xz');
    near(back.buildings.height, d.buildings.height, 0.005 + 1e-6, 'building height');
    near(back.buildings.baseY, d.buildings.baseY, 0.001 + 1e-6, 'building baseY');
    assert.deepEqual([...back.buildings.osmId], [...d.buildings.osmId]);
    assert.deepEqual([...back.buildings.vStart], [...d.buildings.vStart]);
    assert.deepEqual([...back.buildings.style], [...d.buildings.style]);
    assert.deepEqual([...back.buildings.flags], [...d.buildings.flags]);
    near(back.roads.xyz, d.roads.xyz, 1 / 256 + 1e-4, 'road xyz');
    assert.deepEqual([...back.roads.pStart], [...d.roads.pStart]);
    assert.deepEqual([...back.roads.nameIdx], [...d.roads.nameIdx]);
    near(back.roads.width, d.roads.width, 0.05 + 1e-6, 'road width');
    near(back.areas.xz, d.areas.xz, 1 / 256 + 1e-4, 'area xz');
    assert.deepEqual([...back.areas.flags], [...d.areas.flags]);
    near(back.props.xz, d.props.xz, 1 / 256 + 1e-4, 'prop xz');
    near(back.props.rot, d.props.rot, Math.PI / 128 + 1e-6, 'prop rot');
    assert.deepEqual([...back.places.place], [0, 1026]);
    assert.deepEqual(encodeChunk(back), bytes, 're-encode is stable');
    assert.ok(Math.abs(demSample(back.dem, cx * 128 + 1, cz * 128 + 1) - (back.dem.y[0] + back.dem.y[1] + back.dem.y[DEM_N] + back.dem.y[DEM_N + 1]) / 4) < 1e-5);
  }
});

test('OBC1 rejects a version mismatch, a byte-length mismatch, truncation and bad magic', () => {
  const bytes = encodeChunk(sampleChunk(1, 2));
  const v = bytes.slice(); v[4] = 2;
  assert.throws(() => decodeChunk(v), (e: unknown) => e instanceof SfFormatError && /version mismatch/.test(e.message));
  const longer = new Uint8Array(bytes.length + 1); longer.set(bytes);
  assert.throws(() => decodeChunk(longer), /byte length mismatch/);
  assert.throws(() => decodeChunk(bytes.slice(0, bytes.length - 7)), /byte length mismatch/);
  assert.throws(() => decodeChunk(bytes.slice(0, 20)), SfFormatError);
  const m = bytes.slice(); m[0] = 0x58;
  assert.throws(() => decodeChunk(m), /bad magic/);
  // a section whose declared length disagrees with its content
  const s = bytes.slice(), dv = new DataView(s.buffer);
  const table = 32 + 12 * 1; // second section (buildings)
  dv.setUint32(table + 8, dv.getUint32(table + 8, true) - 4, true);
  assert.throws(() => decodeChunk(s), SfFormatError);
  // encoder refuses out-of-range data instead of wrapping
  const bad = sampleChunk(0, 0); bad.buildings.xz[0] = 5000;
  assert.throws(() => encodeChunk(bad), SfFormatError);
});

test('gzip → DecompressionStream → decode works in node (as in a module worker); plain bytes pass through', async () => {
  const d = sampleChunk(-2, 7);
  const raw = encodeChunk(d);
  const gz = await gzip(raw);
  assert.ok(gz[0] === 0x1f && gz[1] === 0x8b && gz.length < raw.length);
  assert.deepEqual(await gunzip(gz), raw);
  assert.deepEqual(await gunzip(raw), raw);
  const back = await decodeChunkFile(gz);
  assert.equal(back.buildings.count, 40);
});

test('OBF1 far city and OBG1 graph round trip', async () => {
  const far: FarData = {
    dem: { originX: -1000, originZ: -800, step: 16, cols: 5, rows: 4, y: Float32Array.from({ length: 20 }, (_, i) => i * 1.5) },
    prisms: { count: 2, kind: Uint8Array.from([0, 1]), roof: Uint8Array.from([1, 0]), wallRgb: Uint8Array.from([1, 2, 3, 250, 251, 252]), roofRgb: Uint8Array.from([9, 8, 7, 6, 5, 4]), height: Float32Array.from([4.5, 41.08]), baseY: Float32Array.from([10.2, 3]), vStart: Uint32Array.from([0, 4, 7]), xz: Float32Array.from([-1000, -800, 1500, -800, 1500, 2100, -1000, 2100, 0, 0, 10, 0, 5, 5]) },
    areas: { count: 1, cls: Uint8Array.from([0]), flags: Uint8Array.from([0]), pStart: Uint32Array.from([0, 3]), xz: Float32Array.from([0, 0, 100.125, 0, 50, 75.5]) },
    lines: { count: 1, cls: Uint8Array.from([2]), width: Float32Array.from([5.6]), nameIdx: Uint16Array.from([1]), flags: Uint8Array.from([0]), pStart: Uint32Array.from([0, 2]), xyz: Float32Array.from([0, 1, 0, 800, 20, 900]) },
    zones: [{ id: 'mission', zh: '教会区', en: 'Mission', rings: [{ hole: false, xz: Float32Array.from([200, 500, 300, 500, 300, 700]) }] }],
    names: ['Market Street', 'Valencia Street'],
    landmarks: [{ id: 'sutro-tower', x: 73.25, z: 973.75, baseY: 46.5, height: 46.1, radius: 3 }],
    zoneGrid: { originX: -1008, originZ: -808, step: 16, cols: 3, rows: 2, idx: Uint8Array.from([0, 1, 2, 3, 4, 5]) },
  };
  const f = decodeFar(encodeFar(far));
  near(f.dem.y, far.dem.y, 1e-3, 'far dem');
  assert.equal(f.dem.cols, 5); assert.equal(f.dem.originX, -1000);
  near(f.prisms.xz, far.prisms.xz, 1 / 16 + 1e-4, 'prism xz');
  near(f.prisms.height, far.prisms.height, 0.005 + 1e-6, 'prism height');
  assert.deepEqual([...f.prisms.wallRgb], [...far.prisms.wallRgb]);
  near(f.lines.xyz, far.lines.xyz, 1 / 16 + 1e-4, 'line xyz');
  assert.equal(f.names[f.lines.nameIdx[0]], 'Valencia Street');
  assert.equal(f.zones[0].zh, '教会区'); near(f.zones[0].rings[0].xz, far.zones[0].rings[0].xz, 1 / 16, 'zone ring');
  assert.equal(f.landmarks[0].id, 'sutro-tower');
  assert.deepEqual([...f.zoneGrid.idx], [0, 1, 2, 3, 4, 5]);

  const g: WalkGraph = {
    nodeCount: 4, edgeCount: 6, xyz: Float32Array.from([0, 0, 0, 10, 1, 0, 10, 2, 10, -500, 30, 1900]), nodeFlags: Uint8Array.from([1, 2, 0, 0]),
    offsets: Uint32Array.from([0, 1, 3, 5, 6]), targets: Uint32Array.from([1, 0, 2, 1, 3, 2]), cost: Float32Array.from([10, 10, 10.5, 10.5, 600, 600]), kind: Uint8Array.from([0, 0, 1, 1, 2, 2]),
  };
  const gg = decodeGraph(encodeGraph(g));
  assert.deepEqual([...gg.offsets], [...g.offsets]); assert.deepEqual([...gg.targets], [...g.targets]);
  near(gg.xyz, g.xyz, 1 / 16 + 1e-4, 'graph xyz'); near(gg.cost, g.cost, 0.005, 'graph cost');
  const viaGz = await decodeGraphFile(await gzip(encodeGraph(g)));
  assert.equal(viaGz.nodeCount, 4);
  const bad = encodeGraph(g); bad[4] = 9;
  assert.throws(() => decodeGraph(bad), /version mismatch/);
});

test('districtHash is stable and changes with the hero lots', () => {
  const d = { slab: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 0, z: 10 }], blocks: [{ id: 'lot-1', height: 5, footprint: [{ x: 1, z: 1 }, { x: 2, z: 1 }, { x: 2, z: 2 }] }] };
  const h = computeDistrictHash(d);
  assert.match(h, /^[0-9a-f]{8}$/);
  assert.equal(computeDistrictHash(JSON.parse(JSON.stringify(d))), h);
  d.blocks[0].height = 5.01;
  assert.notEqual(computeDistrictHash(d), h);
});
