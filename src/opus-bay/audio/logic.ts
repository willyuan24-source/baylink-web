/**
 * Pure, DOM-free helpers for the Opus Bay audio engine (unit-tested in tests/opus-bay-audio.test.ts).
 * Nothing in here touches Web Audio, window or import.meta.env.
 */
import type { Mood, Polygon, SurfaceKind, Vec2 } from '../core/types';
import { drain, type Job } from './slices';

// ---------------------------------------------------------------------------
// Small math
// ---------------------------------------------------------------------------

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
export const semis = (n: number) => Math.pow(2, n / 12);

/** Deterministic PRNG (mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string (FNV-1a). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const rand = (rng: () => number, lo: number, hi: number) => lo + (hi - lo) * rng();
export const pickOne = <T>(rng: () => number, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export function pointInPoly(x: number, z: number, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function distToSegment(px: number, pz: number, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? clamp(((px - a.x) * dx + (pz - a.z) * dz) / len2) : 0;
  const cx = a.x + dx * t, cz = a.z + dz * t;
  return Math.hypot(px - cx, pz - cz);
}

export function distToPolyline(px: number, pz: number, points: readonly Vec2[]): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(px - points[0].x, pz - points[0].z);
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) best = Math.min(best, distToSegment(px, pz, points[i], points[i + 1]));
  return best;
}

export function centroid(poly: Polygon): Vec2 {
  let x = 0, z = 0;
  for (const p of poly) { x += p.x; z += p.z; }
  return { x: x / Math.max(1, poly.length), z: z / Math.max(1, poly.length) };
}

// ---------------------------------------------------------------------------
// Listener / spatialisation
// ---------------------------------------------------------------------------

/**
 * Camera yaw convention assumed (actors/CameraRig): the camera sits at
 * target + (sin(yaw), cos(yaw)) * horizontalDistance, looking back at the target, so the view
 * direction on the ground is (-sin(yaw), -cos(yaw)) and screen-right is (cos(yaw), -sin(yaw)).
 * `yawSign` lets the integrator flip the convention without touching call sites.
 */
export const LISTENER_YAW_SIGN = 1;

export function listenerRight(yaw: number, yawSign = LISTENER_YAW_SIGN): Vec2 {
  const y = yaw * yawSign;
  return { x: Math.cos(y), z: -Math.sin(y) };
}

/** Stereo pan (-1 left … +1 right) of a source relative to the listener, softened so nothing is hard-panned. */
export function panFor(listener: Vec2, yaw: number, source: Vec2, width = 0.85, yawSign = LISTENER_YAW_SIGN): number {
  const dx = source.x - listener.x, dz = source.z - listener.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-3) return 0;
  const r = listenerRight(yaw, yawSign);
  // sources very close to the listener are centred (inside-the-head feel avoided)
  const nearFade = smoothstep(0.5, 6, d);
  return clamp(((dx * r.x + dz * r.z) / d) * width * nearFade, -1, 1);
}

/** 1 at ≤ near, 0 at ≥ far, smooth in between (perceptually eased). */
export function proximity(d: number, near: number, far: number): number {
  if (d <= near) return 1;
  if (d >= far) return 0;
  const t = 1 - (d - near) / (far - near);
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Shore distance field
// ---------------------------------------------------------------------------

export interface ShoreSource {
  slab: Polygon;
  walk: { polygon: Polygon; height?: number; surface?: SurfaceKind }[];
  piers: { deck: Polygon }[];
  hills: { center: Vec2; radiusX: number; radiusZ: number }[];
  roads: { points: Vec2[]; width: number }[];
  ramps?: { points: Vec2[]; width: number }[];
  blocks: { footprint: Polygon }[];
  landmarks?: { collider?: { polygon: Polygon } | { radius: number }; position: Vec2 }[];
}

export interface ShoreField {
  cell: number;
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  /** distance (world units) from each cell centre to the nearest water cell */
  dist: Float32Array;
  /** 1 = land, 0 = water */
  land: Uint8Array;
  distanceAt(x: number, z: number): number;
  /** unit vector pointing towards the nearest water (zero on open water) */
  waterDirAt(x: number, z: number): Vec2;
}

/**
 * A shore field from a land test over a window (city mode, lane F10): each `cell` of `bounds` is land when
 * `isLand(centre)` says so (the streamed city's terrain: resident chunks, else the far 8 u map; pier decks and open water
 * are water), then the same chamfer distance transform. No assumption about where the water is: the Bay, the Golden Gate
 * and the Pacific all work. Water that does not reach the window's edge (Stow Lake, a reservoir, a park pond) counts as
 * land: the waves are the sea's.
 */
export interface ShoreGridSource {
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
  cell: number;
  isLand(x: number, z: number): boolean;
}

/**
 * The shore distance field. District (ShoreSource): coarse land/water classification of the diorama, then a chamfer
 * distance transform. Contract (DESIGN.md / district seed): the Bay is north (−z) of the waterfront, the city south.
 * A cell is land if it is covered by a non-pier walk area, hill, road, ramp, building or landmark
 * collider; everything south of the northern-most land cell of a column is filled as land (the city),
 * everything else on the slab is water. Pier decks count as water — you are standing over it.
 * City (ShoreGridSource `{bounds, cell, isLand}`): see shoreGridJob.
 */
export function buildShoreField(src: ShoreSource | ShoreGridSource, cell = 3): ShoreField {
  return drain('isLand' in src ? shoreGridJob(src) : shoreFieldJob(src, cell));
}

/** Land tests between two yields of shoreGridJob (a city land test is a raster lookup, well under a microsecond). */
export const SHORE_GRID_CHUNK = 256;

/** The city shore field as a sliced job: classify the window (yield every SHORE_GRID_CHUNK tests), then the transform. */
export function* shoreGridJob(src: ShoreGridSource): Job<ShoreField> {
  const { bounds: b, cell } = src;
  const cols = Math.max(1, Math.ceil((b.maxX - b.minX) / cell));
  const rows = Math.max(1, Math.ceil((b.maxZ - b.minZ) / cell));
  const land = new Uint8Array(cols * rows);
  let tests = 0;
  for (let r = 0; r < rows; r++) {
    const z = b.minZ + (r + 0.5) * cell;
    for (let c = 0; c < cols; c++) {
      if (src.isLand(b.minX + (c + 0.5) * cell, z)) land[r * cols + c] = 1;
      if (++tests % SHORE_GRID_CHUNK === 0) yield;
    }
  }
  // the sea reaches the window's edge: flood it in from there; enclosed water (lakes, ponds) becomes land
  const sea = new Uint8Array(cols * rows), stack: number[] = [];
  const seed = (i: number) => { if (!land[i] && !sea[i]) { sea[i] = 1; stack.push(i); } };
  for (let c = 0; c < cols; c++) { seed(c); seed((rows - 1) * cols + c); }
  for (let r = 0; r < rows; r++) { seed(r * cols); seed(r * cols + cols - 1); }
  let visits = 0;
  while (stack.length) {
    const i = stack.pop()!, c = i % cols;
    if (c > 0) seed(i - 1);
    if (c < cols - 1) seed(i + 1);
    if (i >= cols) seed(i - cols);
    if (i < (rows - 1) * cols) seed(i + cols);
    if (++visits % (SHORE_GRID_CHUNK * 4) === 0) yield;
  }
  for (let i = 0; i < land.length; i++) if (!land[i] && !sea[i]) land[i] = 1;
  return yield* fieldFromLand(land, cols, rows, cell, b.minX, b.minZ);
}

/** The city's windowed shore field: ±256 u round the listener in 4 u cells, rebuilt after 96 u of movement. */
export const CITY_SHORE = { half: 256, cell: 4, rebuildAfter: 96 } as const;

/** The window of the city shore field round (x, z), snapped to its cell grid (so rebuilds line up). */
export function shoreWindow(x: number, z: number, o: { half: number; cell: number } = CITY_SHORE) {
  const cx = Math.round(x / o.cell) * o.cell, cz = Math.round(z / o.cell) * o.cell;
  return { minX: cx - o.half, minZ: cz - o.half, maxX: cx + o.half, maxZ: cz + o.half };
}

/** Whether the listener has moved far enough from the field's centre (or there is none yet) to build a new one. */
export function shoreRebuildDue(centre: Vec2 | null, x: number, z: number, after: number = CITY_SHORE.rebuildAfter): boolean {
  return !centre || Math.hypot(x - centre.x, z - centre.z) > after;
}

/** Land tests between two yields of shoreFieldJob (a land test is a few microseconds on the district). */
export const SHORE_JOB_CHUNK = 8;

/** buildShoreField as a sliced job (audio/slices.ts): yields every SHORE_JOB_CHUNK land tests and every grid row. */
export function* shoreFieldJob(src: ShoreSource, cell = 3): Job<ShoreField> {
  const xs = src.slab.map(p => p.x), zs = src.slab.map(p => p.z);
  const minX = Math.min(...xs), minZ = Math.min(...zs);
  const cols = Math.max(1, Math.ceil((Math.max(...xs) - minX) / cell));
  const rows = Math.max(1, Math.ceil((Math.max(...zs) - minZ) / cell));
  const land = new Uint8Array(cols * rows);

  const pierDecks = src.piers.map(p => p.deck);
  const overWater = (area: ShoreSource['walk'][number]) => {
    const c = centroid(area.polygon);
    if (pierDecks.some(deck => pointInPoly(c.x, c.z, deck))) return true;
    return area.height !== undefined && area.height < 3 && area.surface === 'wood';
  };
  const landWalk = src.walk.filter(area => !overWater(area)).map(area => area.polygon);
  const strips = [...src.roads, ...(src.ramps ?? [])];
  const polyList: Polygon[] = [...landWalk, ...src.blocks.map(b => b.footprint)];
  const circles: { x: number; z: number; r: number }[] = [];
  for (const lm of src.landmarks ?? []) {
    if (!lm.collider) continue;
    if ('polygon' in lm.collider) polyList.push(lm.collider.polygon);
    else circles.push({ x: lm.position.x, z: lm.position.z, r: lm.collider.radius });
  }
  // bounding boxes make the (one-off) classification cheap even for a dense city
  const box = (pts: readonly Vec2[], pad: number) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
    return { x0: x0 - pad, z0: z0 - pad, x1: x1 + pad, z1: z1 + pad };
  };
  const polys = polyList.filter(p => p.length >= 3).map(poly => ({ poly, ...box(poly, 0) }));
  const stripBoxes = strips.filter(s => s.points.length >= 1).map(s => ({ s, ...box(s.points, s.width / 2) }));

  const isLand = (x: number, z: number) => {
    for (const hill of src.hills) {
      const dx = (x - hill.center.x) / hill.radiusX, dz = (z - hill.center.z) / hill.radiusZ;
      if (dx * dx + dz * dz < 1) return true;
    }
    for (const b of polys) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && pointInPoly(x, z, b.poly)) return true;
    for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r) return true;
    for (const b of stripBoxes) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && distToPolyline(x, z, b.s.points) < b.s.width / 2) return true;
    return false;
  };

  let tests = 0;
  for (let c = 0; c < cols; c++) {
    const x = minX + (c + 0.5) * cell;
    let frontier = -1;
    for (let r = 0; r < rows; r++) {
      if (isLand(x, minZ + (r + 0.5) * cell)) { frontier = r; break; }
      if (++tests % SHORE_JOB_CHUNK === 0) yield;
    }
    if (frontier >= 0) for (let r = frontier; r < rows; r++) land[r * cols + c] = 1;
    yield;
  }
  return yield* fieldFromLand(land, cols, rows, cell, minX, minZ);
}

/** Chamfer distance transform of a land / water grid (1 = land) and the field's lookups; yields every row. */
function* fieldFromLand(land: Uint8Array, cols: number, rows: number, cell: number, minX: number, minZ: number): Job<ShoreField> {
  // two-pass chamfer distance (cells), 8-neighbourhood with weights 1 / √2
  const INF = 1e9, D = Math.SQRT2;
  const dist = new Float32Array(cols * rows);
  for (let i = 0; i < dist.length; i++) dist[i] = land[i] ? INF : 0;
  const at = (c: number, r: number) => dist[r * cols + c];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      let v = dist[i];
      if (v === 0) continue;
      if (c > 0) v = Math.min(v, at(c - 1, r) + 1);
      if (r > 0) {
        v = Math.min(v, at(c, r - 1) + 1);
        if (c > 0) v = Math.min(v, at(c - 1, r - 1) + D);
        if (c < cols - 1) v = Math.min(v, at(c + 1, r - 1) + D);
      }
      dist[i] = v;
    }
    yield;
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      let v = dist[i];
      if (v === 0) continue;
      if (c < cols - 1) v = Math.min(v, at(c + 1, r) + 1);
      if (r < rows - 1) {
        v = Math.min(v, at(c, r + 1) + 1);
        if (c < cols - 1) v = Math.min(v, at(c + 1, r + 1) + D);
        if (c > 0) v = Math.min(v, at(c - 1, r + 1) + D);
      }
      dist[i] = v;
    }
    yield;
  }
  // no water anywhere: treat as far inland
  for (let i = 0; i < dist.length; i++) dist[i] = dist[i] >= INF ? 999 : dist[i] * cell;

  const sample = (fx: number, fz: number) => {
    const c = clamp(fx, 0, cols - 1), r = clamp(fz, 0, rows - 1);
    const c0 = Math.floor(c), r0 = Math.floor(r);
    const c1 = Math.min(cols - 1, c0 + 1), r1 = Math.min(rows - 1, r0 + 1);
    const tx = c - c0, tz = r - r0;
    const a = lerp(dist[r0 * cols + c0], dist[r0 * cols + c1], tx);
    const b = lerp(dist[r1 * cols + c0], dist[r1 * cols + c1], tx);
    return lerp(a, b, tz);
  };
  const toGrid = (x: number, z: number) => [(x - minX) / cell - 0.5, (z - minZ) / cell - 0.5] as const;

  return {
    cell, minX, minZ, cols, rows, dist, land,
    distanceAt(x, z) {
      const [fx, fz] = toGrid(x, z);
      return sample(fx, fz);
    },
    waterDirAt(x, z) {
      const [fx, fz] = toGrid(x, z);
      const gx = sample(fx + 1, fz) - sample(fx - 1, fz);
      const gz = sample(fx, fz + 1) - sample(fx, fz - 1);
      const len = Math.hypot(gx, gz);
      return len < 1e-4 ? { x: 0, z: 0 } : { x: -gx / len, z: -gz / len };
    },
  };
}

// ---------------------------------------------------------------------------
// Rate limiting (token bucket)
// ---------------------------------------------------------------------------

export function createRateLimiter(perSecond: number, burst = 1) {
  let tokens = burst;
  let last = -Infinity;
  return (now: number) => {
    if (last === -Infinity) last = now;
    tokens = Math.min(burst, tokens + (now - last) * perSecond);
    last = now;
    if (tokens >= 1) { tokens -= 1; return true; }
    return false;
  };
}

// ---------------------------------------------------------------------------
// Footstep recipes
// ---------------------------------------------------------------------------

export interface FootstepRecipe {
  /** resonant body tone (Hz, 0 = none) and its decay (s) */
  tone: number;
  toneDecay: number;
  toneGain: number;
  /** noise transient */
  noiseType: BiquadFilterType;
  noiseFreq: number;
  noiseQ: number;
  noiseDecay: number;
  noiseGain: number;
  attack: number;
  /** number of micro grains (sand / dirt crunch) */
  grains: number;
  color: 'white' | 'pink' | 'brown';
}

export const FOOTSTEPS: Record<SurfaceKind, FootstepRecipe> = {
  // hollow boardwalk thunk
  wood: { tone: 185, toneDecay: 0.1, toneGain: 0.5, noiseType: 'bandpass', noiseFreq: 950, noiseQ: 1.3, noiseDecay: 0.07, noiseGain: 0.4, attack: 0.002, grains: 0, color: 'pink' },
  // crisp concrete tap
  pavement: { tone: 115, toneDecay: 0.04, toneGain: 0.2, noiseType: 'highpass', noiseFreq: 2300, noiseQ: 0.7, noiseDecay: 0.035, noiseGain: 0.42, attack: 0.001, grains: 0, color: 'white' },
  // smooth stone plaza, a touch brighter and harder
  plaza: { tone: 140, toneDecay: 0.035, toneGain: 0.18, noiseType: 'bandpass', noiseFreq: 3300, noiseQ: 0.9, noiseDecay: 0.03, noiseGain: 0.5, attack: 0.001, grains: 0, color: 'white' },
  // soft grass swish
  grass: { tone: 0, toneDecay: 0, toneGain: 0, noiseType: 'lowpass', noiseFreq: 1700, noiseQ: 0.5, noiseDecay: 0.1, noiseGain: 0.34, attack: 0.018, grains: 2, color: 'pink' },
  // granular sand crunch
  sand: { tone: 0, toneDecay: 0, toneGain: 0, noiseType: 'bandpass', noiseFreq: 2600, noiseQ: 1.1, noiseDecay: 0.05, noiseGain: 0.26, attack: 0.006, grains: 5, color: 'white' },
  // wooden steps: deeper hollow knock
  stairs: { tone: 150, toneDecay: 0.08, toneGain: 0.46, noiseType: 'bandpass', noiseFreq: 1300, noiseQ: 1, noiseDecay: 0.05, noiseGain: 0.36, attack: 0.001, grains: 0, color: 'pink' },
  // packed dirt path
  dirt: { tone: 95, toneDecay: 0.05, toneGain: 0.18, noiseType: 'lowpass', noiseFreq: 1200, noiseQ: 0.6, noiseDecay: 0.07, noiseGain: 0.34, attack: 0.008, grains: 3, color: 'brown' },
  // city asphalt: a duller, lower pavement tap
  road: { tone: 100, toneDecay: 0.04, toneGain: 0.16, noiseType: 'highpass', noiseFreq: 1800, noiseQ: 0.6, noiseDecay: 0.035, noiseGain: 0.36, attack: 0.001, grains: 0, color: 'white' },
};

// ---------------------------------------------------------------------------
// Bump classification
// ---------------------------------------------------------------------------

export type BumpVoice = 'plastic' | 'wood' | 'rubber' | 'metal' | 'squeak' | 'thud';

export function bumpVoice(kind: string): BumpVoice {
  const k = kind.toLowerCase();
  if (/cone|bin-lid|plastic/.test(k)) return 'plastic';
  if (/crate|box|barrel|bench|stall|board|kiosk|wood/.test(k)) return 'wood';
  if (/buoy|ball|float|rubber/.test(k)) return 'rubber';
  if (/lamp|bollard|bin|mailbox|sign|rack|pole|rail|metal|telescope|bell/.test(k)) return 'metal';
  if (/baybay|otter|npc|player|family|jogger|vendor|fisher|person|guide/.test(k)) return 'squeak';
  return 'thud';
}

/** Normalises a landing impact: either already 0..1 or a vertical speed in u/s. */
export function normaliseImpact(impact: number): number {
  if (!Number.isFinite(impact)) return 0.4;
  const v = Math.abs(impact);
  return clamp(v > 1.5 ? v / 12 : v);
}

// ---------------------------------------------------------------------------
// Dialogue blips
// ---------------------------------------------------------------------------

const CJK = /[㐀-鿿豈-﫿぀-ヿ가-힯]/;

/** Rough syllable count: every CJK glyph is one, latin words count vowel groups, digit runs count 1. */
export function syllableCount(text: string): number {
  let count = 0;
  for (const ch of text) if (CJK.test(ch)) count++;
  const latin = text.replace(/[㐀-鿿豈-﫿぀-ヿ가-힯]/g, ' ');
  for (const word of latin.toLowerCase().match(/[a-z']+|\d+/g) ?? []) {
    if (/^\d+$/.test(word)) { count += 1; continue; }
    const groups = word.replace(/e$/, '').match(/[aeiouy]+/g);
    count += Math.max(1, groups ? groups.length : 0);
  }
  return count;
}

export type Voicing = 'baybay' | 'npc' | 'player';

export interface Blip {
  /** seconds from utterance start */
  at: number;
  /** semitones relative to the voice's base pitch */
  semi: number;
  dur: number;
  /** 0..1 */
  gain: number;
}

export interface BlipOptions {
  voicing: Voicing;
  mood?: Mood;
  seed?: number;
  /** cap on blips (keeps long lines unobtrusive) */
  max?: number;
}

const BLIP_SCALE = [0, 2, 4, 7, 9, 12];

/**
 * A little melodic "voice" for a line: one blip per ~syllable (capped), pentatonic steps,
 * questions rise at the end, exclamations get accents, statements settle down.
 */
export function blipPlan(text: string, opts: BlipOptions): Blip[] {
  const rng = mulberry32(opts.seed ?? hashString(text));
  const trimmed = text.trim();
  if (!trimmed) return [];
  const syl = syllableCount(trimmed);
  const max = opts.max ?? (opts.voicing === 'baybay' ? 14 : 10);
  const every = syl > max ? syl / max : 1;
  const n = Math.max(1, Math.min(max, Math.round(syl / every)));
  const mood = opts.mood ?? 'happy';
  const rate = opts.voicing === 'npc' ? 11 : mood === 'excited' ? 15 : mood === 'thinking' ? 9 : 13;
  const step = 1 / rate;
  const question = /[?？]\s*$/.test(trimmed);
  const exclaim = /[!！]/.test(trimmed);
  const moodShift = mood === 'excited' ? 3 : mood === 'proud' ? 2 : mood === 'thinking' ? -2 : 0;
  const blips: Blip[] = [];
  let degree = 2 + Math.floor(rng() * 2);
  let t = 0;
  for (let i = 0; i < n; i++) {
    const move = rng();
    degree += move < 0.35 ? -1 : move < 0.7 ? 1 : move < 0.85 ? 0 : rng() < 0.5 ? 2 : -2;
    degree = Math.max(0, Math.min(BLIP_SCALE.length - 1, degree));
    let semi = BLIP_SCALE[degree] + moodShift;
    const last = i === n - 1, penult = i === n - 2;
    if (question && (last || penult)) semi = BLIP_SCALE[BLIP_SCALE.length - 1] + moodShift + (last ? 2 : 0);
    else if (!question && last && !exclaim) semi = Math.min(semi, BLIP_SCALE[1] + moodShift);
    const accent = exclaim && (i === 0 || rng() < 0.18);
    blips.push({
      at: t,
      semi,
      dur: step * (0.55 + rng() * 0.2) * (last ? 1.5 : 1),
      gain: (accent ? 1 : 0.72 + rng() * 0.18) * (last ? 0.85 : 1),
    });
    // word-ish grouping: occasional micro pause
    t += step * (rng() < 0.16 ? 1.7 : 0.9 + rng() * 0.25);
  }
  return blips;
}

export type VoiceLang = 'zh' | 'en';
export const VOICE_IDS = ['zh-hi', 'zh-this-way', 'zh-wow', 'zh-yay', 'zh-arrived', 'zh-think', 'en-hi', 'en-this-way', 'en-yay', 'en-arrived'] as const;
export type VoiceId = (typeof VOICE_IDS)[number];

/** Which short voice bark (if any) fits a BAYBAY line. */
export function voiceClipForMood(mood: Mood | undefined, lang: VoiceLang, rng: () => number = Math.random): string | null {
  switch (mood) {
    case 'wave': return `${lang}-hi`;
    case 'excited': return lang === 'zh' ? (rng() < 0.5 ? 'zh-wow' : 'zh-yay') : 'en-yay';
    case 'proud': return `${lang}-yay`;
    case 'point': return `${lang}-this-way`;
    case 'thinking': return lang === 'zh' ? 'zh-think' : null;
    default: return null;
  }
}

/** Only these moods are important enough to play a recorded clip (others use synth chirps). */
export const CLIP_MOODS: readonly Mood[] = ['wave', 'excited'];

// ---------------------------------------------------------------------------
// Music theory
// ---------------------------------------------------------------------------

export type TimeOfDayName = 'morning' | 'day' | 'golden' | 'night';
export type ModeName = 'onboarding' | 'tour' | 'week' | 'free';

export interface MusicMood {
  rootMidi: number;
  minor: boolean;
  bpm: number;
  /** pluck brightness 0..1 */
  brightness: number;
  /** probability multiplier for melody notes */
  density: number;
  padLevel: number;
  /** chance of a high glockenspiel sparkle each other bar */
  sparkle: number;
  /** melody register shift in semitones */
  lift: number;
  swing: number;
}

const BASE_MOODS: Record<TimeOfDayName, MusicMood> = {
  morning: { rootMidi: 62, minor: false, bpm: 80, brightness: 0.62, density: 0.9, padLevel: 0.8, sparkle: 0.2, lift: 0, swing: 0.1 },
  day: { rootMidi: 60, minor: false, bpm: 82, brightness: 0.66, density: 1, padLevel: 0.75, sparkle: 0.12, lift: 0, swing: 0.12 },
  golden: { rootMidi: 58, minor: false, bpm: 76, brightness: 0.5, density: 0.85, padLevel: 0.95, sparkle: 0.3, lift: 0, swing: 0.1 },
  night: { rootMidi: 57, minor: true, bpm: 72, brightness: 0.36, density: 0.7, padLevel: 1.1, sparkle: 0.35, lift: -2, swing: 0.06 },
};

export function musicMoodFor(time: TimeOfDayName, mode: ModeName): MusicMood {
  const m = { ...BASE_MOODS[time] };
  if (mode === 'tour') {
    m.bpm = Math.min(84, m.bpm + 4);
    m.brightness = clamp(m.brightness + 0.14);
    m.density *= 1.12;
    m.lift += m.minor ? 0 : 2;
  } else if (mode === 'week') {
    m.bpm = Math.min(84, m.bpm + 2);
    m.density *= 1.05;
    m.brightness = clamp(m.brightness + 0.05);
  } else if (mode === 'onboarding') {
    m.density *= 0.75;
  }
  m.bpm = clamp(m.bpm, 72, 84);
  return m;
}

export const PENTA_MAJOR = [0, 2, 4, 7, 9];
export const PENTA_MINOR = [0, 3, 5, 7, 10];

/** Pentatonic degree index (any integer; wraps octaves) → midi note. */
export function scaleMidi(root: number, minor: boolean, degree: number): number {
  const scale = minor ? PENTA_MINOR : PENTA_MAJOR;
  const oct = Math.floor(degree / scale.length);
  const idx = ((degree % scale.length) + scale.length) % scale.length;
  return root + oct * 12 + scale[idx];
}

export interface Chord { offset: number; minor: boolean }

export const PROGRESSIONS_MAJOR: Chord[][] = [
  [{ offset: 0, minor: false }, { offset: 9, minor: true }, { offset: 5, minor: false }, { offset: 7, minor: false }],
  [{ offset: 0, minor: false }, { offset: 5, minor: false }, { offset: 9, minor: true }, { offset: 7, minor: false }],
  [{ offset: 5, minor: false }, { offset: 0, minor: false }, { offset: 2, minor: true }, { offset: 7, minor: false }],
  [{ offset: 0, minor: false }, { offset: 4, minor: true }, { offset: 5, minor: false }, { offset: 5, minor: false }],
];
export const PROGRESSIONS_MINOR: Chord[][] = [
  [{ offset: 0, minor: true }, { offset: 8, minor: false }, { offset: 3, minor: false }, { offset: 10, minor: false }],
  [{ offset: 0, minor: true }, { offset: 5, minor: true }, { offset: 8, minor: false }, { offset: 10, minor: false }],
];

export function progressionFor(minor: boolean, variant: number): Chord[] {
  const list = minor ? PROGRESSIONS_MINOR : PROGRESSIONS_MAJOR;
  return list[((variant % list.length) + list.length) % list.length];
}

/** Pitch classes (0..11) of a chord as [root, third, fifth, colour] where colour is the add9. */
export function chordPitchClasses(root: number, chord: Chord): number[] {
  const r = root + chord.offset;
  const pcs = [r, r + (chord.minor ? 3 : 4), r + 7, r + 2];
  return pcs.map(p => ((p % 12) + 12) % 12);
}

/**
 * Smooth voice leading: choose, for each target pitch class, the octave that is nearest the previous
 * voicing (or the middle of [low, high]); returns sorted midi notes within range.
 */
export function voiceLead(prev: number[] | null, pcs: number[], low: number, high: number): number[] {
  const centre = (low + high) / 2;
  const nearest = (pc: number, anchor: number) => {
    let best = -1, bestD = Infinity;
    for (let m = low; m <= high; m++) {
      if (((m % 12) + 12) % 12 !== pc) continue;
      const d = Math.abs(m - anchor);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  };
  const anchors = prev && prev.length === pcs.length ? prev : pcs.map(() => centre);
  // try every assignment of chord tones to voices (≤ 4 voices → ≤ 24 permutations), keep the smoothest
  const perms = (list: number[]): number[][] => (list.length <= 1 ? [list] : list.flatMap((x, i) => perms([...list.slice(0, i), ...list.slice(i + 1)]).map(rest => [x, ...rest])));
  let best: number[] = [], bestCost = Infinity;
  for (const order of perms(pcs)) {
    const notes = order.map((pc, i) => nearest(pc, anchors[i]));
    if (notes.some(n => n < 0) || new Set(notes).size !== notes.length) continue;
    const cost = notes.reduce((s, n, i) => s + Math.abs(n - anchors[i]), 0);
    if (cost < bestCost) { bestCost = cost; best = notes; }
  }
  if (!best.length) best = pcs.map(pc => nearest(pc, centre)).filter(n => n >= 0);
  return [...best].sort((a, b) => a - b);
}

const RHYTHMS: number[][] = [
  [1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0],
  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
  [0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0],
  [1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0],
  [1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0],
];

/** A 2-bar (16 eighths) melodic motif as pentatonic degree offsets or null for rests. */
export function makeMotif(rng: () => number, density = 1): (number | null)[] {
  const rhythm = pickOne(rng, RHYTHMS);
  const out: (number | null)[] = [];
  let degree = pickOne(rng, [0, 2, 4, 5]);
  for (let i = 0; i < 16; i++) {
    const on = rhythm[i] === 1 ? rng() < clamp(0.8 * density, 0.2, 1) : rng() < 0.06 * density;
    if (!on) { out.push(null); continue; }
    const r = rng();
    degree += r < 0.38 ? 1 : r < 0.76 ? -1 : r < 0.88 ? 2 : r < 0.96 ? -2 : 0;
    degree = Math.max(-2, Math.min(8, degree));
    out.push(degree);
  }
  // land the phrase on a stable tone (root / fifth) when the last note is loose
  for (let i = 15; i >= 0; i--) {
    const d = out[i];
    if (d === null) continue;
    const pos = ((d % 5) + 5) % 5;
    if (pos !== 0 && pos !== 3) out[i] = d - pos + (pos < 2 ? 0 : 3);
    break;
  }
  if (!out.some(v => v !== null)) out[0] = 0;
  return out;
}

/** A' variation: keep the head, re-roll a few tail notes. */
export function varyMotif(motif: (number | null)[], rng: () => number): (number | null)[] {
  return motif.map((d, i) => {
    if (d === null || i < 8) return d;
    const r = rng();
    return r < 0.3 ? d + (rng() < 0.5 ? 1 : -1) : r < 0.38 ? null : d;
  });
}

// ---------------------------------------------------------------------------
// Karplus–Strong pluck (rendered once into a buffer, replayed with playbackRate)
// ---------------------------------------------------------------------------

export interface PluckRender { data: Float32Array; baseFreq: number }

export function renderPluck(freq: number, sampleRate: number, seconds: number, brightness: number, decay: number, rng: () => number): PluckRender {
  const n = Math.max(2, Math.floor(sampleRate / freq - 0.5));
  const ring = new Float32Array(n);
  const coeff = 0.12 + 0.86 * clamp(brightness);
  let lp = 0, mean = 0;
  for (let i = 0; i < n; i++) { lp += coeff * (rng() * 2 - 1 - lp); ring[i] = lp; mean += lp; }
  mean /= n;
  for (let i = 0; i < n; i++) ring[i] -= mean;
  const len = Math.max(n * 2, Math.floor(seconds * sampleRate));
  const data = new Float32Array(len);
  let idx = 0, peak = 1e-6;
  for (let i = 0; i < len; i++) {
    const cur = ring[idx];
    const nextIdx = idx + 1 === n ? 0 : idx + 1;
    data[i] = cur;
    ring[idx] = decay * 0.5 * (cur + ring[nextIdx]);
    idx = nextIdx;
    const a = Math.abs(cur);
    if (a > peak) peak = a;
  }
  const norm = 0.9 / peak;
  const fade = Math.min(len, Math.floor(sampleRate * 0.02));
  for (let i = 0; i < len; i++) {
    let g = norm;
    if (i < 8) g *= i / 8;
    if (i > len - fade) g *= (len - i) / fade;
    data[i] *= g;
  }
  return { data, baseFreq: sampleRate / (n + 0.5) };
}

// ---------------------------------------------------------------------------
// Calendar helpers (Bay Area clock)
// ---------------------------------------------------------------------------

/** 0 = Sunday … 6 = Saturday, in America/Los_Angeles. */
export function bayWeekday(date: Date): number {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' }).format(date);
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
  } catch {
    return date.getDay();
  }
}

/** Ferry Plaza Farmers Market runs Tue / Thu / Sat. */
export const isMarketDay = (date: Date) => [2, 4, 6].includes(bayWeekday(date));

/**
 * City transit events (lane F, `transit` game events) → a sound: the gripman's bell (quieter for a car farther away),
 * the grip clank when a car takes the cable, the turntable creak when someone pushes and its rumble when a car has
 * turned, the ferry's horn, a walker's squeak as they hop out of a vehicle's way. Null = silent (board / depart /
 * arrive / ride are covered by the bell that comes with them, or by lines). Where the event happened (audio/cityHooks
 * emitAt) sets the pan; `strength` is already the distance.
 */
export type TransitSoundKind = 'cable-bell' | 'grip-clank' | 'turntable-creak' | 'turntable-rumble' | 'ferry-horn' | 'hop-squeak'
  // wave 4 (lane T): the sightseeing bus and the Muni Metro (audio/lines.ts)
  | 'bus-arrive' | 'door-open' | 'door-close' | 'stop-bell' | 'lrv-gong' | 'bus-horn';
export type TransitSound = { kind: TransitSoundKind; gain: number; strikes: number };
export function transitSound(what: string, kind: string, strength = 1): TransitSound | null {
  const k = clamp(strength, 0.15, 1);
  if (what === 'hop-aside') return { kind: 'hop-squeak', gain: 0.5 * k, strikes: 1 };
  if (kind === 'ferry') return what === 'horn' ? { kind: 'ferry-horn', gain: k, strikes: 1 } : null;
  if (kind === 'bus' || kind === 'light-rail') {
    const bus = kind === 'bus';
    switch (what) {
      // the air brake and the doors opening (bus) / the doors (LRV)
      case 'arrive': return { kind: bus ? 'bus-arrive' : 'door-open', gain: k, strikes: 1 };
      case 'depart': return { kind: 'door-close', gain: 0.8 * k, strikes: 1 };
      // the stop request's ding (bus: 下一站下车) / the LRV's gong (H, someone on the track, a passing train)
      case 'bell': return bus ? { kind: 'stop-bell', gain: k, strikes: 1 } : { kind: 'lrv-gong', gain: k, strikes: 2 };
      case 'horn': return bus ? { kind: 'bus-horn', gain: k, strikes: 1 } : { kind: 'lrv-gong', gain: k, strikes: 2 };
      default: return null;
    }
  }
  if (kind !== 'cable-car') return null;
  switch (what) {
    case 'bell': return { kind: 'cable-bell', gain: k, strikes: k > 0.6 ? 3 : 2 };
    case 'grip': return { kind: 'grip-clank', gain: 0.35 * k, strikes: 1 };
    case 'push': return { kind: 'turntable-creak', gain: 1, strikes: 1 };
    case 'turned': return { kind: 'turntable-rumble', gain: 0.6 * k, strikes: 1 };
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// City soundscape (lane F10): pure level helpers
// ---------------------------------------------------------------------------

/** How much of a ring of ground samples is park (grass, woodland dirt): 0 … 1. */
export function parkShare(samples: readonly (SurfaceKind | null)[]): number {
  if (!samples.length) return 0;
  let n = 0;
  for (const s of samples) if (s === 'grass' || s === 'dirt') n++;
  return n / samples.length;
}

/**
 * The Pacific side from the signed distance to the Golden Gate Bridge's line (negative seaward: Baker Beach, Lands End,
 * Ocean Beach): 1 out there, 0 inside the Bay, smooth over 100 u across the strait.
 */
export function pacificSide(signedDist: number): number {
  return smoothstep(30, -70, signedDist);
}

/** The cable's hum and the sheaves' clack under the slot: loud over it, gone 16 u away. */
export const cableHumLevel = (d: number) => proximity(d, 1.5, 16);

/** A busker's music: close by at 5 u, a hint at 30 u, gone at 40 u. */
export const buskerLevel = (d: number) => proximity(d, 5, 40);

/** Distance from (px, pz) to a polyline stored flat (x, y, z triples with stride 3, or x, z pairs with stride 2). */
export function distToFlatPolyline(px: number, pz: number, pts: ArrayLike<number>, stride = 3): number {
  const n = Math.floor(pts.length / stride);
  let best = Infinity;
  for (let i = 1; i < n; i++) {
    const ax = pts[(i - 1) * stride], az = pts[(i - 1) * stride + stride - 1], bx = pts[i * stride], bz = pts[i * stride + stride - 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / L2) : 0;
    const d = Math.hypot(px - ax - dx * t, pz - az - dz * t);
    if (d < best) best = d;
  }
  return best;
}
