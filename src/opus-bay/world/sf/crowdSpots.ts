/**
 * Wave 5 · lane T (W5-T1, plan sf-w5-plan.md §4.3): crowd spots other lanes register — an event's visitors (lane R: 12–20
 * toy visitors round a stage at Hellman Hollow, stall tents at the Castro fair), a signature corner's "someone doing
 * something" (lane L: an early queue, a busker's circle, neighbours at a bus stop). Pure data (no three.js, no DOM), so
 * a lazy feature chunk imports it without pulling the crowd in; world/sf/cityLife.ts hands the pins to the crowd
 * (world/sf/crowd.ts), which keeps one sightseer standing on each pin near the player, facing the sight.
 *
 *   const off = addCrowdSpots('event:hardly-strictly', [{ x: -378, z: 1119, r: 9 }], { face: { x: -372, z: 1108 }, count: 16 });
 *   …
 *   off();                      // or removeCrowdSpots('event:hardly-strictly')
 *
 *   crowdWave(x, z)             // lane A's wave emote: crowd walkers within 6 u of (x, z) wave back (also on the game
 *                               // event { type: 'emote', who: 'player', emote: 'wave' })
 *
 * The 3 u clear-lane rule: every group keeps a lane 3 u wide free of standers — by default through the group's middle
 * toward what it faces (the aisle to the stage), or across its long axis when it faces nothing in particular (a queue
 * split in two) — so the player can always walk through a crowd; `lane` sets it explicitly. Standers never stand in any
 * group's lane (a later group's lane moves an earlier group's standers too). Same key again: replaces the group.
 */

export interface CrowdSpotInput {
  x: number;
  z: number;
  /** people stand within this of the spot (u); 0 / absent = on the spot itself (one person), wider when `count` asks more */
  r?: number;
}

export interface CrowdLane { ax: number; az: number; bx: number; bz: number }

export interface CrowdSpotOptions {
  /** what they look at (a stage, a busker, a shop window); default: the group's centre (a circle round a performer) */
  face?: { x: number; z: number };
  /** how many people stand there in all (default: one a spot); at most CROWD_SPOT_MAX a group */
  count?: number;
  /** the clear lane, 3 u wide (default: see above) */
  lane?: CrowdLane;
}

/** A standing position the crowd fills: one sightseer, facing `face` (a heading, rad: atan2(dx, dz)). */
export interface CrowdPin { id: string; key: string; x: number; z: number; face: number }

/** width of the lane every group keeps free (u) */
export const CLEAR_LANE = 3;
/** most standers a group asks for */
export const CROWD_SPOT_MAX = 24;
/** standers of a group keep at least this far apart (u) */
export const PIN_SPACING = 0.95;
/** the wave-back reach (u): walkers within this of the waving player wave back */
export const WAVE_REACH = 6;

interface Group { key: string; spots: CrowdSpotInput[]; opts: CrowdSpotOptions; lane: CrowdLane; look: { x: number; z: number }; raw: { x: number; z: number; face: number }[] }

const groups = new Map<string, Group>();
let pins: CrowdPin[] = [];
let version = 0;
const listeners = new Set<() => void>();

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Distance from (x, z) to segment (a, b), and the side (+1 left of a→b, −1 right). */
export function laneDistance(l: CrowdLane, x: number, z: number): { d: number; side: 1 | -1; t: number } {
  const dx = l.bx - l.ax, dz = l.bz - l.az, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - l.ax) * dx + (z - l.az) * dz) / L2));
  const px = l.ax + dx * t, pz = l.az + dz * t;
  const cross = dx * (z - l.az) - dz * (x - l.ax);
  return { d: Math.hypot(x - px, z - pz), side: cross >= 0 ? 1 : -1, t };
}

/** The standing positions a group asks for (before the lanes): `count` spread over the spots, sunflower-packed. */
function layout(spots: readonly CrowdSpotInput[], count: number): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  if (!spots.length) return out;
  const per = spots.map((_, i) => Math.floor(count / spots.length) + (i < count % spots.length ? 1 : 0));
  spots.forEach((s, i) => {
    const n = per[i];
    if (!n) return;
    // room for n people PIN_SPACING apart: a disc of radius ≈ 0.55 · spacing · √n (never smaller than asked)
    const need = n > 1 ? PIN_SPACING * 0.62 * Math.sqrt(n) + 0.3 : 0;
    const R = Math.max(s.r ?? 0, need);
    for (let k = 0; k < n; k++) {
      if (n === 1 && R < 0.01) { out.push({ x: s.x, z: s.z }); continue; }
      // sunflower: even density over the disc (the first one a little off the centre: the centre is often the sight)
      const rr = R * Math.sqrt((k + 0.5) / n), a = k * GOLDEN + i * 0.7;
      out.push({ x: s.x + Math.cos(a) * rr, z: s.z + Math.sin(a) * rr });
    }
  });
  return out;
}

/** The group's default lane: toward what it faces (from behind the group to the sight), else across its long axis. */
function defaultLane(pts: readonly { x: number; z: number }[], face: { x: number; z: number } | undefined): CrowdLane {
  let cx = 0, cz = 0;
  for (const p of pts) { cx += p.x; cz += p.z; }
  cx /= pts.length || 1; cz /= pts.length || 1;
  let reach = 1;
  for (const p of pts) reach = Math.max(reach, Math.hypot(p.x - cx, p.z - cz));
  reach += CLEAR_LANE;
  if (face && Math.hypot(face.x - cx, face.z - cz) > 1) {
    const d = Math.hypot(face.x - cx, face.z - cz), ux = (face.x - cx) / d, uz = (face.z - cz) / d;
    return { ax: cx - ux * reach, az: cz - uz * reach, bx: face.x, bz: face.z };
  }
  // the long axis (principal component of the spread); the lane runs across it through the middle
  let sxx = 0, szz = 0, sxz = 0;
  for (const p of pts) { const x = p.x - cx, z = p.z - cz; sxx += x * x; szz += z * z; sxz += x * z; }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  const ux = -Math.sin(ang), uz = Math.cos(ang);
  return { ax: cx - ux * reach, az: cz - uz * reach, bx: cx + ux * reach, bz: cz + uz * reach };
}

/** Push positions out of a lane (to CLEAR_LANE / 2 + a little from its line, on the side they stand). */
function clearOf(p: { x: number; z: number }, lane: CrowdLane, k: number) {
  const half = CLEAR_LANE / 2 + 0.05;
  const { d, side, t } = laneDistance(lane, p.x, p.z);
  if (d >= half) return;
  const dx = lane.bx - lane.ax, dz = lane.bz - lane.az, L = Math.hypot(dx, dz) || 1;
  // (exactly on the line: alternate sides)
  const s = d < 1e-3 ? (k % 2 ? 1 : -1) : side;
  const nx = (-dz / L) * s, nz = (dx / L) * s;
  const px = lane.ax + dx * t, pz = lane.az + dz * t;
  p.x = px + nx * half;
  p.z = pz + nz * half;
}

function rebuild() {
  const all = [...groups.values()];
  const next: CrowdPin[] = [];
  for (const g of all) {
    g.raw.forEach((q, i) => {
      const p = { x: q.x, z: q.z };
      // every group's lane (its own first): a stage's aisle stays open through a neighbouring group too
      clearOf(p, g.lane, i);
      for (const o of all) if (o !== g) clearOf(p, o.lane, i);
      // (facing the sight from where they end up standing; someone right on it keeps the group's way)
      const dx = g.look.x - p.x, dz = g.look.z - p.z;
      next.push({ id: `${g.key}#${i}`, key: g.key, x: p.x, z: p.z, face: Math.hypot(dx, dz) > 0.3 ? Math.atan2(dx, dz) : q.face });
    });
  }
  pins = next;
  version++;
  for (const fn of listeners) { try { fn(); } catch { /* a listener's error stays its own */ } }
}

/**
 * Register a group of standing people (`key`: the caller's id, e.g. `event:<id>`, `corner:irving`). Returns the remover.
 * Coordinates are city x / z; the crowd places nobody on unwalkable ground, the roadway or within 2.5 u of the player.
 */
export function addCrowdSpots(key: string, spots: readonly CrowdSpotInput[], opts: CrowdSpotOptions = {}): () => void {
  const list = spots.filter(s => Number.isFinite(s.x) && Number.isFinite(s.z)).map(s => ({ x: s.x, z: s.z, r: Math.max(0, Math.min(30, s.r ?? 0)) }));
  if (!list.length) { removeCrowdSpots(key); return () => {}; }
  const count = Math.max(1, Math.min(CROWD_SPOT_MAX, Math.round(opts.count ?? list.length)));
  const pts = layout(list, count);
  const face = opts.face;
  let cx = 0, cz = 0;
  for (const p of pts) { cx += p.x; cz += p.z; }
  cx /= pts.length; cz /= pts.length;
  const look = face ?? { x: cx, z: cz };
  const raw = pts.map(p => {
    // (someone standing right on the sight looks the way the group faces)
    const dx = look.x - p.x, dz = look.z - p.z;
    return { x: p.x, z: p.z, face: Math.hypot(dx, dz) > 0.3 ? Math.atan2(dx, dz) : Math.atan2(look.x - cx, look.z - cz) || 0 };
  });
  const group: Group = { key, spots: list, opts: { ...opts }, lane: opts.lane ?? defaultLane(pts, face), look, raw };
  groups.set(key, group);
  rebuild();
  return () => { if (groups.get(key) === group) removeCrowdSpots(key); };
}

/** Remove a group (its standers finish standing and wander off, out of view). */
export function removeCrowdSpots(key: string) {
  if (!groups.delete(key)) return;
  rebuild();
}

/** Every pin of every group (the crowd's input; a new array after each change). */
export function crowdPins(): readonly CrowdPin[] { return pins; }
/** Bumps on every add / remove (the crowd re-reads the pins). */
export function crowdPinsVersion(): number { return version; }
/** Every group's clear lane (tests, the crowd's walker lanes later). */
export function crowdLanes(): { key: string; lane: CrowdLane }[] { return [...groups.values()].map(g => ({ key: g.key, lane: g.lane })); }
/** Called on every change (cityLife: the crowd syncs its pinned standers). */
export function onCrowdSpots(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

// ---------------------------------------------------------------------------
// Wave back (lane A's emote wheel)
// ---------------------------------------------------------------------------

const waves: { x: number; z: number; r: number }[] = [];

/** Crowd walkers within `r` (default 6 u) of (x, z) turn and wave back (at most 8 requests queue up; the crowd drains them). */
export function crowdWave(x: number, z: number, r = WAVE_REACH) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return;
  if (waves.length >= 8) waves.shift();
  waves.push({ x, z, r: Math.max(0.5, Math.min(12, r)) });
}

/** The crowd's side: take the wave requests since the last call. */
export function takeCrowdWaves(): { x: number; z: number; r: number }[] {
  if (!waves.length) return [];
  return waves.splice(0, waves.length);
}

/** Tests: forget every group and wave request. */
export function __resetCrowdSpotsForTests() { groups.clear(); waves.length = 0; rebuild(); }
