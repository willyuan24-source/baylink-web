import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Lane C2-2 / C2-3 (the SF look): over the published city, flat roofs are the norm and pitched roofs a believable
 * minority in the neighbourhoods that have them; walls stay light (Painted-Lady pastels, whites and creams; brick and
 * industrial excepted); flat tops sit darker than their walls; the far city lost its orange carpet; and what the
 * three tiers show from above agrees cell by cell (L0 ≈ L1 ≈ L2), walls and tops. Plus the green hills.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;

const look = await import('../src/opus-bay/world/sf/look');
const { buildL0, buildL1, chunkContext } = await import('../src/opus-bay/world/sf/build');
const { buildFar } = await import('../src/opus-bay/world/sf/far');
const { CitySites } = await import('../src/opus-bay/world/sf/sites');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const { STYLES, ROOFS } = await import('../src/opus-bay/world/sf/format');
const { CITY_PAL } = await import('../src/opus-bay/world/palette');
const { SEAM_FILL } = await import('../src/opus-bay/world/sf/cornersSeamData');
const { sfDisk } = await import('./opus-bay-sf-disk');

const sf = sfDisk();
const far = await sf.far();
const zones = look.lookZones(far);
const excludes = new CitySites().excludes();
const init = { palettes: sf.manifest.palettes, slab: DISTRICT.slab, excludes, zones };

type Style = (typeof STYLES)[number];
interface Row { style: Style; dataRoof: string; zone: string | null; area: number; pal: { wall: string } | null; look: ReturnType<typeof look.sfLook> }

/** Every published building through the look (what specOf feeds L0 and L1). */
const rows: Row[] = [];
for (const c of sf.manifest.chunks) {
  const d = (await sf.chunk(c.cx, c.cz))!;
  const b = d.buildings;
  for (let i = 0; i < b.count; i++) {
    const k0 = b.vStart[i], k1 = b.vStart[i + 1];
    let a = 0, cx = 0, cz = 0;
    for (let k = k0; k < k1; k++) { const n = k + 1 < k1 ? k + 1 : k0; a += b.xz[k * 2] * b.xz[n * 2 + 1] - b.xz[n * 2] * b.xz[k * 2 + 1]; cx += b.xz[k * 2]; cz += b.xz[k * 2 + 1]; }
    cx /= k1 - k0; cz /= k1 - k0;
    const style = STYLES[b.style[i]], zone = look.zoneAt(zones, cx, cz);
    const input = { style, roof: ROOFS[b.roof[i]], pal: sf.manifest.palettes[b.palette[i]] ?? null, seed: b.osmId[i], area: Math.abs(a) / 2, H: b.height[i], zone, flags: b.flags[i] };
    rows.push({ style, dataRoof: input.roof, zone, area: input.area, pal: input.pal, look: look.sfLook(input) });
  }
}

/** Neighbourhoods where a pitched house roof is believable (checkpoint §5.4 C2-2), written out independently of look.ts. */
const ALLOWED_PITCHED = new Set([
  'sunset-parkside', 'outer-richmond', 'inner-richmond', 'inner-sunset', 'lakeshore', 'oceanview-merced-ingleside', 'golden-gate-park',
  'marina', 'seacliff', 'presidio-heights', 'lincoln-park', 'west-of-twin-peaks', 'twin-peaks',
  'noe-valley', 'bernal-heights', 'glen-park', 'excelsior', 'portola', 'outer-mission', 'visitacion-valley', 'bayview-hunters-point', 'mclaren-park', 'treasure-island',
]);
const KEEP = new Set<Style>(['industrial', 'pier', 'civic']);

test('roofs: ≥ 80 % flat and ≤ 10 % gable city-wide; pitched house roofs only in the allowed neighbourhoods', () => {
  // + W6-W1's North Beach seam fill (the stream worker, and tests/opus-bay-sf-disk.ts, append it to its chunks)
  assert.equal(rows.length, sf.manifest.counts.buildings + SEAM_FILL.length);
  const n = { flat: 0, gable: 0, hip: 0 } as Record<string, number>;
  const bad: string[] = [];
  for (const r of rows) {
    n[r.look.roof]++;
    if (r.look.roof === 'flat') continue;
    if (KEEP.has(r.style)) { if (r.look.roof !== r.dataRoof) bad.push(`${r.style} roof changed`); continue; }
    if (!r.zone || !ALLOWED_PITCHED.has(r.zone)) bad.push(`${r.style} ${r.look.roof} in ${r.zone}`);
    if (['office', 'tower', 'deco', 'chinatown', 'brick'].includes(r.style)) bad.push(`${r.style} pitched`);
  }
  const total = rows.length;
  assert.ok(n.flat / total >= 0.8, `flat ${(n.flat / total * 100).toFixed(1)} %`);
  assert.ok(n.gable / total <= 0.1, `gable ${(n.gable / total * 100).toFixed(1)} %`);
  assert.deepEqual(bad.slice(0, 5), []);
  // the minority is real, not zero: the Sunset / Marina tiles and the hill cottages are there
  const pitchedIn = (zs: string[]) => rows.filter(r => r.look.roof !== 'flat' && r.zone && zs.includes(r.zone) && !KEEP.has(r.style)).length / Math.max(1, rows.filter(r => r.zone && zs.includes(r.zone) && !KEEP.has(r.style)).length);
  const sunset = pitchedIn(['sunset-parkside', 'outer-richmond']), marina = pitchedIn(['marina', 'seacliff']);
  assert.ok(sunset > 0.12 && sunset < 0.25, `Sunset / Richmond pitched ${sunset.toFixed(3)}`);
  assert.ok(marina > 0.3 && marina < 0.5, `Marina / Seacliff pitched ${marina.toFixed(3)}`);
  assert.ok(pitchedIn(['noe-valley', 'bernal-heights']) > 0.03, 'a few Noe / Bernal cottages keep their gables');
  assert.equal(pitchedIn(['mission', 'south-of-market', 'financial-district-south-beach', 'nob-hill', 'pacific-heights']), 0);
});

test('walls: light (HSL L ≥ 0.78) except brick / industrial / towers; Painted Ladies keep chroma; SoMa stays brick', () => {
  const EXEMPT = new Set<Style>(['brick', 'industrial', 'office', 'tower', 'civic', 'pier']);
  const range = (h: string) => { const c = look.hexRgb(h); return Math.max(...c) - Math.min(...c); };
  let dark = 0, house = 0, chroma = 0, palChroma = 0, vic = 0;
  for (const r of rows) {
    if (EXEMPT.has(r.style)) continue;
    house++;
    if (look.lightness(r.look.wall) < 0.78) dark++;
    if (r.style === 'victorian' && r.pal) { vic++; chroma += range(r.look.wall); palChroma += range(r.pal.wall); }
  }
  assert.equal(dark, 0, `${dark} of ${house} house walls darker than L 0.78`);
  // the Painted Ladies keep most of their colour (a quarter turn white, the rest are lifted only a touch)
  assert.ok(chroma / palChroma > 0.6, `Victorian chroma kept: ${(chroma / palChroma).toFixed(2)} (${vic} walls)`);
  // about a third of the Edwardian / residential walls are white or off-white
  const ed = rows.filter(r => r.style === 'edwardian' || r.style === 'residential');
  const white = ed.filter(r => { const [R, G, B] = look.hexRgb(r.look.wall); return look.lightness(r.look.wall) > 0.9 && Math.max(R, G, B) - Math.min(R, G, B) < 16; }).length;
  assert.ok(white / ed.length > 0.28 && white / ed.length < 0.45, `white share ${(white / ed.length).toFixed(2)}`);
  const brick = rows.filter(r => r.style === 'brick');
  assert.ok(brick.every(r => look.lightness(r.look.wall) < 0.6), 'SoMa brick stays brick');
});

test('flat tops sit darker than their walls (contact from the hills); pitched roofs are tile or slate', () => {
  const HOUSE = new Set<Style>(['victorian', 'edwardian', 'sunset', 'marina', 'residential', 'chinatown', 'deco']);
  let bad = 0, n = 0;
  for (const r of rows) {
    if (!HOUSE.has(r.style) || r.look.roof !== 'flat') continue;
    n++;
    if (look.lightness(r.look.roofColor) > look.lightness(r.look.wall) - 0.03) bad++;
  }
  assert.ok(n > 30000);
  assert.equal(bad, 0);
  for (const r of rows) if (r.look.roof !== 'flat' && !KEEP.has(r.style)) assert.ok(look.lightness(r.look.roofColor) < 0.7, r.look.roofColor);
});

test('far city: no orange carpet (≤ 5 % orange prism tops), towers light', () => {
  let orange = 0;
  const hue = (h: string) => {
    const [r, gg, b] = look.hexRgb(h).map(v => v / 255);
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), d = mx - mn;
    if (d < 1e-6) return { h: 0, s: 0 };
    const hh = mx === r ? ((gg - b) / d) % 6 : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4;
    const l = (mx + mn) / 2;
    return { h: (hh * 60 + 360) % 360, s: d / (1 - Math.abs(2 * l - 1)) };
  };
  const p = far.prisms;
  for (let i = 0; i < p.count; i++) {
    let cx = 0, cz = 0;
    const a = p.vStart[i], b = p.vStart[i + 1];
    for (let k = a; k < b; k++) { cx += p.xz[k * 2]; cz += p.xz[k * 2 + 1]; }
    const wall = `#${[0, 1, 2].map(k => p.wallRgb[i * 3 + k].toString(16).padStart(2, '0')).join('')}`;
    const roof = `#${[0, 1, 2].map(k => p.roofRgb[i * 3 + k].toString(16).padStart(2, '0')).join('')}`;
    const c = look.farPrismColors({ wall, roof, kind: p.kind[i], tall: p.height[i] > 12, zone: look.zoneAt(zones, cx / (b - a), cz / (b - a)), u: 0.5 });
    const q = hue(c.roof);
    if (q.h > 8 && q.h < 40 && q.s > 0.35) orange++;
    if (p.kind[i] === 1) assert.ok(look.lightness(c.roof) > 0.7, 'tower tops stay light');
  }
  assert.ok(orange / p.count <= 0.05, `orange far tops ${(orange / p.count * 100).toFixed(1)} %`);
});

// ---------------------------------------------------------------------------
// tier agreement: what each tier shows from above, cell by cell
// ---------------------------------------------------------------------------

type Arr = { position: Float32Array; color: Uint8Array; index: ArrayLike<number>; indexCount: number };
const toS = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255;
const R = 0.5, N = 128;

/** Top view of a 64 u cell at 0.5 u: the highest up-facing surface per pixel (its linear vertex colour). */
function topView(a: Arr | null, cs: number, x0: number, z0: number) {
  const Y = new Float32Array(N * N).fill(-1e9), C = new Float32Array(N * N * 3);
  if (!a) return { Y, C };
  for (let t = 0; t < a.indexCount; t += 3) {
    const I = [a.index[t], a.index[t + 1], a.index[t + 2]];
    const P = I.map(i => [a.position[i * 3], a.position[i * 3 + 1], a.position[i * 3 + 2]]);
    const ux = P[1][0] - P[0][0], uy = P[1][1] - P[0][1], uz = P[1][2] - P[0][2], vx = P[2][0] - P[0][0], vy = P[2][1] - P[0][1], vz = P[2][2] - P[0][2];
    const ny = uz * vx - ux * vz, L = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx);
    if (L < 1e-9 || Math.abs(ny) / L < 0.25) continue;
    const det = ux * vz - uz * vx;
    if (Math.abs(det) < 1e-9) continue;
    const col = [0, 1, 2].map(k => (a.color[I[0] * cs + k] + a.color[I[1] * cs + k] + a.color[I[2] * cs + k]) / 765);
    const i0 = Math.max(0, Math.floor((Math.min(P[0][0], P[1][0], P[2][0]) - x0) / R)), i1 = Math.min(N - 1, Math.floor((Math.max(P[0][0], P[1][0], P[2][0]) - x0) / R));
    const j0 = Math.max(0, Math.floor((Math.min(P[0][2], P[1][2], P[2][2]) - z0) / R)), j1 = Math.min(N - 1, Math.floor((Math.max(P[0][2], P[1][2], P[2][2]) - z0) / R));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = x0 + (i + 0.5) * R - P[0][0], pz = z0 + (j + 0.5) * R - P[0][2];
      const s = (px * vz - pz * vx) / det, q = (ux * pz - uz * px) / det;
      if (s < 0 || q < 0 || s + q > 1) continue;
      const y = P[0][1] + uy * s + vy * q, k = j * N + i;
      if (y > Y[k]) { Y[k] = y; C[k * 3] = col[0]; C[k * 3 + 1] = col[1]; C[k * 3 + 2] = col[2]; }
    }
  }
  return { Y, C };
}
/** mean sRGB colour of the building tops (pixels ≥ 1.5 u above the ground) */
function meanTop(v: ReturnType<typeof topView>, ground: (x: number, z: number) => number, x0: number, z0: number) {
  let r = 0, gg = 0, b = 0, n = 0;
  for (let k = 0; k < N * N; k++) {
    if (v.Y[k] <= ground(x0 + ((k % N) + 0.5) * R, z0 + (Math.floor(k / N) + 0.5) * R) + 1.5) continue;
    r += v.C[k * 3]; gg += v.C[k * 3 + 1]; b += v.C[k * 3 + 2]; n++;
  }
  return n > 400 ? [toS(r / n), toS(gg / n), toS(b / n)] : null;
}
/** mean sRGB colour of the walls (area-weighted, facing sideways) */
function meanWall(a: Arr | null, cs: number, x0: number, z0: number) {
  if (!a) return null;
  let r = 0, gg = 0, b = 0, w = 0;
  for (let t = 0; t < a.indexCount; t += 3) {
    const I = [a.index[t], a.index[t + 1], a.index[t + 2]];
    const P = I.map(i => [a.position[i * 3], a.position[i * 3 + 1], a.position[i * 3 + 2]]);
    const cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cz = (P[0][2] + P[1][2] + P[2][2]) / 3;
    if (cx < x0 || cz < z0 || cx >= x0 + 64 || cz >= z0 + 64) continue;
    const ux = P[1][0] - P[0][0], uy = P[1][1] - P[0][1], uz = P[1][2] - P[0][2], vx = P[2][0] - P[0][0], vy = P[2][1] - P[0][1], vz = P[2][2] - P[0][2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, L = Math.hypot(nx, ny, nz);
    if (L < 1e-9 || Math.abs(ny) / L > 0.3) continue;
    for (const i of I) { r += (a.color[i * cs] / 255) * L; gg += (a.color[i * cs + 1] / 255) * L; b += (a.color[i * cs + 2] / 255) * L; w += L; }
  }
  return w > 0 ? [toS(r / w), toS(gg / w), toS(b / w)] : null;
}
const dist = (p: number[] | null, q: number[] | null) => (p && q ? Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) : null);
const pct = (a: number[], f: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };

test('tiers agree from above: L0 ≈ L1 ≈ L2 building tops and walls per cell (Mission, Noe, Sunset, Marina, Richmond, downtown)', async () => {
  const fr = buildFar(far, { slab: DISTRICT.slab, excludes });
  const farBy = new Map(fr.cells.map(c => [`${c.ix},${c.iz}`, c]));
  const d01: number[] = [], d12: number[] = [], w01: number[] = [], w12: number[] = [];
  for (const [cx, cz] of [[2, 6], [1, 7], [2, 10], [-2, 11], [-3, 3], [-4, 8], [0, 4]]) {
    const c = await sf.chunk(cx, cz);
    assert.ok(c, `${cx}_${cz}`);
    const ctx = chunkContext(c, init);
    const l1 = buildL1(ctx);
    for (let sub = 0; sub < 4; sub++) {
      const x0 = cx * 128 + (sub & 1) * 64, z0 = cz * 128 + (sub >> 1) * 64;
      const l0 = buildL0(ctx, sub);
      const f = farBy.get(`${Math.floor(x0 / 64)},${Math.floor(z0 / 64)}`);
      const t0 = meanTop(topView(l0.toy as Arr, 4, x0, z0), ctx.height, x0, z0), t1 = meanTop(topView(l1.cells[sub].toy as Arr, 3, x0, z0), ctx.height, x0, z0);
      const t2 = meanTop(topView((f?.toy ?? null) as Arr | null, 3, x0, z0), ctx.height, x0, z0);
      for (const [arr, v] of [[d01, dist(t0, t1)], [d12, dist(t1, t2)], [w01, dist(meanWall(l0.toy as Arr, 4, x0, z0), meanWall(l1.cells[sub].toy as Arr, 3, x0, z0))], [w12, dist(meanWall(l1.cells[sub].toy as Arr, 3, x0, z0), meanWall((f?.toy ?? null) as Arr | null, 3, x0, z0))]] as const) if (v !== null) arr.push(v);
    }
  }
  assert.ok(d01.length >= 20 && d12.length >= 20, `${d01.length} / ${d12.length} cells compared`);
  // sRGB distance (0…441): L0 → L1 is the swap at 125–165 u, L1 → L2 at 300–350 u
  assert.ok(pct(d01, 0.5) <= 10 && pct(d01, 0.9) <= 25, `tops L0-L1 median ${pct(d01, 0.5).toFixed(1)} p90 ${pct(d01, 0.9).toFixed(1)}`);
  assert.ok(pct(d12, 0.5) <= 16 && pct(d12, 0.9) <= 32, `tops L1-L2 median ${pct(d12, 0.5).toFixed(1)} p90 ${pct(d12, 0.9).toFixed(1)}`);
  assert.ok(pct(w01, 0.9) <= 12, `walls L0-L1 p90 ${pct(w01, 0.9).toFixed(1)}`);
  assert.ok(pct(w12, 0.9) <= 14, `walls L1-L2 p90 ${pct(w12, 0.9).toFixed(1)}`);
});

test('green hills (C2-3): hill land turns to grass above 30 u, only steep ground shows earth, scrub is green', () => {
  assert.equal(look.hillMix(10), 0);
  assert.equal(look.hillMix(30), 0);
  assert.ok(look.hillMix(45) > 0.2 && look.hillMix(80) === look.HILL.max);
  assert.equal(look.slopeEarth(0.9), 0);
  assert.ok(look.slopeEarth(1.2) > 0 && look.slopeEarth(5) === look.HILL.slopeMax);
  const green = (h: string) => { const [r, gg, b] = look.hexRgb(h); return gg > r && gg > b; };
  assert.ok(green(CITY_PAL.scrub) && green(CITY_PAL.hillGrass), 'scrub and hill grass read green');
});

test('zones: the far.obc grid answers the DataSF neighbourhoods the look keys on', () => {
  assert.equal(look.zoneAt(zones, -187, 1542), 'sunset-parkside');
  assert.equal(look.zoneAt(zones, 365, 518), 'mission');
  assert.equal(look.zoneAt(zones, -403, 325), 'marina');
  assert.equal(look.zoneAt(null, 0, 0), null);
  assert.equal(look.zoneAt(zones, 1e5, 1e5), null);
});

test('W4-V part b (verify-visual F7): Yerba Buena Island\'s hill paints as forest; its flat shore, the causeway, Treasure Island and the city stay as the data says', async () => {
  const { LAND_PATCHES, landPatchAt } = await import('../src/opus-bay/world/sf/look');
  const { project } = await import('../src/opus-bay/core/geo');
  const summit = project(37.8105, -122.3645);
  assert.equal(landPatchAt(summit.x, summit.z, 20), 'forest', 'the summit');
  assert.equal(landPatchAt(summit.x + 60, summit.z + 20, 6), 'forest', 'a slope');
  assert.equal(landPatchAt(summit.x + 60, summit.z + 20, 1.5), null, 'the flat shore under y0');
  const ti = project(37.8235, -122.3700);
  assert.equal(landPatchAt(ti.x, ti.z, 3), null, 'Treasure Island');
  assert.equal(landPatchAt(150, 0, 5), null, 'the Ferry Building');
  assert.equal(landPatchAt(-30, 700, 60), null, 'a city hill keeps the hill rule');
  for (const p of LAND_PATCHES) assert.ok(Math.hypot(p.x - ti.x, p.z - ti.z) > p.r + 50, `${p.id}: clear of Treasure Island`);
});
