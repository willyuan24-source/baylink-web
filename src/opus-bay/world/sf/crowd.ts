import * as THREE from 'three';
import type { Obstacle } from '../../actors/controller';
import type { Quality } from '../../core/store';
import { Batch, CYL, M, SPHERE } from '../builder';
import { crowdPeopleMaterial, personGeometry } from '../life';
import { EK, type RoadVehicle, type StreetEdge, type StreetNet, centreLineDistance, lifeRng, predictApproach } from './streetNet';
import { type CrowdPin, type WalkerLane, laneDistance } from './crowdSpots';
import { obstaclePool } from './recordPool';

/**
 * The city crowd (lane F, checkpoint F11): up to 64 instanced walkers on the sidewalks around the player, in city mode
 * only (hosted by world/sf/cityLife.ts inside the lazy transit chunk).
 *
 * - **Where they walk.** On the walking graph (world/sf/streetNet.ts): along a street they keep to a sidewalk, just past
 *   the kerb the terrain measures (keep right: the walkers on the street side of a sidewalk go one way, the ones on the
 *   house side the other); on footways, plaza ways and park paths they walk the path itself. At a junction the sidewalk
 *   ends at the corner; the walker then crosses to the next street's sidewalk on the same side (straight on: along the
 *   crosswalk; a turn away from its side: across the street), which is the only time a walker is on the roadway, and
 *   the toy traffic waits for them (`onRoad`). A blocked sidewalk (a building right at the kerb, a lamp, a tree) moves
 *   the walker to the first free offset.
 * - **Sightseers** stand about on plazas and at landmarks (the host passes those spots), facing the sight.
 * - **Hop aside.** A walker a road vehicle is about to reach (its body predicted within 1.2 u of the walker's centre —
 *   more for wide vehicles — and closing) hops sideways off its path with a little jump and stays aside a moment; the
 *   host turns the hop into a `transit` 'hop-aside' event (audio). The player and BAYBAY are stepped around.
 * - **Around the player only.** Walkers live within 90 u (CROWD.radius) of the focus; one that falls behind, or whose
 *   ground stops being known, is recycled to a spot out of view (≥ 34 u away) or far away in view, and fades in. A jump
 *   of the focus (fast travel, a teleport) refills the crowd around the new spot. Fewer walkers at night.
 * - **Pinned standers** (W5-T1): other lanes' crowd spots (world/sf/crowdSpots.ts `addCrowdSpots`: an event's visitors, a
 *   corner's queue) each keep one sightseer standing on them while they are near the player, facing the sight; they
 *   count in the crowd (the walkers make room) and are never recycled while their spot is registered.
 * - **Wave back** (W5-T1): the player's wave (crowdSpots `crowdWave`, the 'emote' event) makes the walkers within 6 u
 *   stop, turn to the player and wave a hand (the people material's wave channel: aWalk < 0).
 * - **Clear lanes** (W5-T5, plan MF2): the host's lanes (crowdSpots `walkerLanes`: every crowd group's aisle, the GGB
 *   deck's centre) stay clear — a walker going along one or a sightseer standing in one steps sideways out of it
 *   (`laneStep`, eased), no sightseer spawns in one, and no crossing runs down one (none at all across a `noCross` lane).
 * - **Drawn** as two InstancedMeshes (near figure = the promenade walker; far figure ≈ 80 triangles beyond 24 u from the camera), one
 *   material instance for that one object kind (life.ts `crowdPeopleMaterial`, warmed as 'f-crowd'); no shadows (like
 *   the promenade's). Budget: ≤ 18 near figures (324 triangles) + the rest far (92): ≤ 10.3k triangles and 2 calls.
 */

export const CROWD = {
  count: { high: 64, mid: 44, low: 24 } as Record<Quality, number>,
  /** walkers live within this of the focus (u) */
  radius: 90,
  /** recycled walkers come back at least this far from the focus (u; out of view) */
  spawnMin: 14,
  /** …and this far when the spot is in view (u) */
  spawnInView: 58,
  /** an unseen walker farther than this is brought back nearer, one every half second (u) */
  thinBeyond: 60,
  /** fewer than this share of the crowd within 30 u of the player: walkers may come in near, fading in */
  nearShare: 0.22,
  /** walking speed range (u/s) */
  speed: [0.85, 1.45] as const,
  /** offsets past the kerb for the two walking directions (keep right) */
  laneIn: 0.3,
  laneOut: 0.9,
  /** hop aside: centre-line distance (u) that triggers it for a car (wide vehicles: half width + 0.55), look-ahead (s) */
  hopWithin: 1.2,
  hopHorizon: 1.2,
  hopTime: 0.42,
  hopHeight: 0.32,
  /** near figures within this of the camera (u), far figures beyond */
  nearLod: 24,
  /** at most this many near figures (the closest; a crowded plaza stays within budget) */
  nearMax: 18,
  /** share of the crowd standing about at sights */
  standShare: 0.2,
  /** obstacle radius of a walker (u) */
  r: 0.28,
  /** night keeps this share of the crowd */
  night: 0.55,
  /** too many walkers and all in view: the ones farther than this from the focus may fade out (u) */
  dropSeenBeyond: 16,
} as const;

const TAU = Math.PI * 2;
/** edge kinds walkers use */
const WALK_KINDS = new Set<number>([EK.street, EK.steps, EK.path, EK.pedestrian]);
/** stand check radius (a walker is slimmer than the player's STAND_RADIUS) */
const STAND_R = 0.22;
/** walkers the far side of a focus jump this long refill at once */
const JUMP = 60;
/** a crossing this long (u) halves the chance of taking that way at a corner */
const CROSS_COST = 3;
/** "near the player" for the density check (u) */
const NEAR_R = 30;
type SpawnMode = 'fill' | 'near' | 'recycle';
/** offsets past the kerb tried when a sidewalk is blocked (streets), or off the centre line (footways, paths) */
const LANES_ROAD = [0.25, 0.5, 0.8, 1.1, 1.5, 2];
const LANES_PATH = [0.1, 0.4, 0.8];

export type WalkerMode = 'walk' | 'cross' | 'stand';

export interface Walker {
  id: number;
  on: boolean;
  mode: WalkerMode;
  /** edge, arc along it, side (+1 left of travel / −1 right), wanted offset past the kerb, smoothed offset */
  e: number;
  s: number;
  side: 1 | -1;
  lane: number;
  laneT: number;
  v: number;
  ph: number;
  color: number;
  scale: number;
  /** crossing: from → to, then the next edge at `ns` on side `nside` */
  x0: number; z0: number; x1: number; z1: number;
  ne: number; ns: number; nside: 1 | -1;
  /** standing: seconds left, facing */
  standT: number;
  face: number;
  /** displacement from the path (stepping round the player, a hop), held `pushHold` s before it relaxes */
  px: number; pz: number;
  pushHold: number;
  /** hop: time into it (−1 = none), start and end displacement */
  hopT: number;
  hx0: number; hz0: number; hx1: number; hz1: number;
  hopCool: number;
  /** a startle after a hop: the walker waits this long */
  pause: number;
  /** speed factor this frame (0 … 1): someone slower just ahead on the same sidewalk */
  pace: number;
  /** distance since the last sidewalk check */
  check: number;
  /** pose */
  x: number; y: number; z: number;
  heading: number;
  /** 0 standing … 1 walking (leg swing) */
  walking: number;
  /** fade-in 0 … 1 */
  grow: number;
  /** recently on the roadway (crossing): the traffic yields */
  onRoad: boolean;
  /** fading out (more walkers than wanted, all in view): off once `grow` reaches 0 */
  leave: boolean;
  /** (W5-T1) the crowd spot this sightseer stands on (crowdSpots pin id), null for everyone else */
  pin: string | null;
  /** (W5-T1) waving back: seconds of the wave left (≤ 0 none), the delay before it starts, whom they wave at */
  waveT: number;
  waveDelay: number;
  wx: number; wz: number;
  /** (W5-T5) the sideways step out of a clear lane (eased), added to the pose */
  lx: number; lz: number;
}

/**
 * Where people stand about: around (x, z) within `r` (a place: a sightseer 1.5 u + up to r from it, facing it), or on
 * the spot itself (`exact`, a landmark plaza spot: within r of it, facing the sight at `face`).
 */
export interface StandSpot { x: number; z: number; r: number; exact?: boolean; face?: { x: number; z: number } }

export interface CrowdEnv {
  /** where the crowd lives around (the player) */
  focus(): { x: number; z: number };
  /** people the walkers step around (the player, BAYBAY) */
  avoid(out: { x: number; z: number }[]): void;
  /** rough "could the player see this spot": recycled walkers prefer unseen spots */
  visible(x: number, z: number): boolean;
  /** moving road vehicles near the focus (the crowd hops out of their way) */
  vehicles(): readonly RoadVehicle[];
  /** sights within r of (x, z) where people stand about: a spot and how far around it (u) */
  standSpots?(x: number, z: number, r: number): StandSpot[];
  /** night 0 … 1 */
  night?(): number;
  /** a walker hopped out of a vehicle's way */
  onHop?(w: Walker, q: RoadVehicle): void;
  /** (W5-T1) the registered crowd spots (world/sf/crowdSpots.ts crowdPins): one sightseer stands on each near the focus */
  pins?(): readonly CrowdPin[];
  /** (W5-T1) wave requests since the last step (crowdSpots takeCrowdWaves): walkers within r of (x, z) wave back */
  waves?(): readonly { x: number; z: number; r: number }[];
  /**
   * (W5-T5) the lanes to keep clear (crowdSpots walkerLanes: every group's aisle, the GGB deck's centre): a walker going
   * along one or a sightseer standing in one steps out of it; one crossing it keeps going
   */
  lanes?(): readonly WalkerLane[];
}

const newWalker = (id: number): Walker => ({
  id, on: false, mode: 'walk', e: -1, s: 0, side: 1, lane: CROWD.laneIn, laneT: CROWD.laneIn, v: 1, ph: 0, color: 0, scale: 1,
  x0: 0, z0: 0, x1: 0, z1: 0, ne: -1, ns: 0, nside: 1, standT: 0, face: 0, px: 0, pz: 0, pushHold: 0,
  hopT: -1, hx0: 0, hz0: 0, hx1: 0, hz1: 0, hopCool: 0, pause: 0, pace: 1, check: 0, x: 0, y: 0, z: 0, heading: 0, walking: 0, grow: 1, onRoad: false, leave: false,
  pin: null, waveT: 0, waveDelay: 0, wx: 0, wz: 0, lx: 0, lz: 0,
});

const _p = { x: 0, z: 0 };
const _q = { x: 0, z: 0 };
const _avoid: { x: number; z: number }[] = [];
/** (verify m6) no walker spawns within this of the player, BAYBAY or a resident (u) */
export const CLEAR_OF_PEOPLE = 2.5;
/** (verify m6) a sightseer shuffles back to this far from the player / BAYBAY (u) */
const STANDER_ROOM = 1.5;
/** (W5-T1) a wave back lasts this long (s), after a delay of up to WAVE_STAGGER (people react one by one) */
export const WAVE_TIME = 1.9;
const WAVE_STAGGER = 0.45;
/** (W5-T1) pinned standers are looked at this often (frames) and at most this many placed a look */
const PIN_EVERY = 10;
const PIN_BUDGET = 4;
/** is (x, z) within CLEAR_OF_PEOPLE of the player, BAYBAY or a resident (this step's avoid list)? */
function nearAvoid(x: number, z: number): boolean {
  for (const a of _avoid) if (Math.abs(a.x - x) < CLEAR_OF_PEOPLE && Math.abs(a.z - z) < CLEAR_OF_PEOPLE && Math.hypot(a.x - x, a.z - z) < CLEAR_OF_PEOPLE) return true;
  return false;
}

export class CrowdSim {
  readonly net: StreetNet;
  readonly env: CrowdEnv;
  readonly walkers: Walker[] = [];
  /** walkers wanted (before the night share) */
  target: number;
  radius: number = CROWD.radius;
  private rng: () => number;
  private fx = NaN;
  private fz = NaN;
  private filling = true;
  /** the refill burst lasts until the crowd is full or this time (s): ground still streaming in fills later */
  private fillUntil = 0;
  /** too few walkers near the player (the ground there arrived late, a quiet corner): spawns may land near, fading in */
  private sparse = false;
  private frame = 0;
  private t = 0;
  /** stats for QA / tests */
  readonly stats = { spawned: 0, recycled: 0, hops: 0, crossings: 0, blockedMoves: 0, refills: 0, pinned: 0, waves: 0 };
  /** (W5-T1) pinned standers by pin id → walker */
  private pinned = new Map<string, Walker>();
  private pinsSeen: readonly CrowdPin[] | null = null;

  constructor(net: StreetNet, env: CrowdEnv, o: { max?: number; target?: number; seed?: number } = {}) {
    this.net = net;
    this.env = env;
    const max = o.max ?? CROWD.count.high;
    for (let i = 0; i < max; i++) this.walkers.push(newWalker(i));
    this.target = Math.min(max, o.target ?? max);
    this.rng = lifeRng(o.seed ?? 0x5eed);
  }

  /** Forget everyone; the next step fills the crowd around the focus again (spots in view allowed). */
  reset() {
    for (const w of this.walkers) { w.on = false; w.pin = null; w.waveT = 0; }
    this.pinned.clear();
    this.filling = true;
    this.fillUntil = this.t + 8;
    this.stats.refills++;
  }

  get active(): number { let n = 0; for (const w of this.walkers) if (w.on) n++; return n; }
  /** simulated seconds (the walk cycle's clock) */
  get time(): number { return this.t; }

  step(dt: number) {
    this.t += dt;
    this.frame++;
    const f = this.env.focus();
    if (!Number.isFinite(this.fx) || Math.hypot(f.x - this.fx, f.z - this.fz) > JUMP) this.reset();
    this.fx = f.x; this.fz = f.z;
    const night = this.env.night?.() ?? 0;
    const want = Math.round(this.target * (1 - (1 - CROWD.night) * night));
    // recycle the ones left behind (or on ground that is no longer known); (W5-T1) a pinned stander stays while its spot is
    // registered and near, and counts first (the other walkers make room for it)
    let on = 0;
    for (const w of this.walkers) if (w.on && w.pin) on++;
    // keep the crowd round the player as they walk on: now and then the farthest unseen walker comes back nearer
    let thin: Walker | null = null;
    if (this.frame % 15 === 0) {
      let bd: number = CROWD.thinBeyond;
      for (const w of this.walkers) {
        if (!w.on || w.mode === 'stand' || w.pin) continue;
        const d = Math.hypot(w.x - f.x, w.z - f.z);
        if (d > bd && !this.env.visible(w.x, w.z)) { bd = d; thin = w; }
      }
    }
    // (review) more than wanted and all of them in view (a plaza the camera rests on, then night or a lower quality): one
    // walker in view, not right by the player, fades out every third of a second (the crowd stayed at ~50 of 'low's 24)
    let dropSeen = this.frame % 20 === 0;
    for (const w of this.walkers) {
      if (!w.on || w.pin) continue;
      if (w === thin) { w.on = false; this.stats.recycled++; continue; }
      const d = Math.hypot(w.x - f.x, w.z - f.z);
      const far = d > this.radius + 12;
      const lost = w.mode !== 'stand' && w.mode !== 'cross' && !this.net.edge(w.e);
      const done = w.mode === 'stand' && w.standT <= 0 && !this.env.visible(w.x, w.z);
      // more than wanted (night came, the quality went down): the unseen ones go first
      let extra = false;
      if (on < want) w.leave = false;
      else if (this.filling || !this.env.visible(w.x, w.z)) extra = true;
      else if (dropSeen && !w.leave && d > CROWD.dropSeenBeyond) { w.leave = true; dropSeen = false; }
      if (far || lost || done || extra) { w.on = false; this.stats.recycled++; continue; }
      on++;
    }
    // a quiet patch round the player: let a few come in near (fading in)
    if (this.frame % 30 === 0) {
      let near = 0;
      for (const w of this.walkers) if (w.on && Math.hypot(w.x - f.x, w.z - f.z) < NEAR_R) near++;
      this.sparse = near < want * CROWD.nearShare;
    }
    // the player, BAYBAY and the residents: spawns keep clear of them (verify m6), movers step round them
    _avoid.length = 0;
    this.env.avoid(_avoid);
    // (W5-T1) the registered crowd spots near the player: one sightseer on each
    on = this.syncPins(f, want, on);
    // spawn: a burst while filling (spread over a few frames), else a few a frame
    let budget = this.filling ? 10 : 3;
    const mode: SpawnMode = this.filling ? 'fill' : this.sparse ? 'near' : 'recycle';
    for (const w of this.walkers) {
      if (on >= want || budget <= 0) break;
      if (w.on) continue;
      budget--;
      if (this.spawn(w, mode)) on++;
    }
    if (on >= want || this.t > this.fillUntil) this.filling = false;
    // while it is sparse, the farthest walkers make room (one a quarter second)
    if (this.sparse && on >= want && this.frame % 8 === 0) {
      let far: Walker | null = null, bd = NEAR_R * 1.5;
      for (const w of this.walkers) {
        if (!w.on || w.mode === 'stand' || w.pin) continue;
        const d = Math.hypot(w.x - f.x, w.z - f.z);
        if (d > bd && !this.env.visible(w.x, w.z)) { bd = d; far = w; }
      }
      if (far) { far.on = false; this.stats.recycled++; }
    }

    const vehicles = this.env.vehicles();
    const waves = this.env.waves?.();
    if (waves) for (const q of waves) this.wave(q.x, q.z, q.r);
    this.separate(dt);
    for (const w of this.walkers) {
      if (!w.on) continue;
      this.move(w, dt);
      this.stepAround(w, dt);
      if ((w.id + this.frame) % 4 === 0) this.watchTraffic(w, vehicles);
      this.pose(w, dt);
    }
  }

  // --- pinned standers and the wave back (W5-T1) ---------------------------------------------------------------------

  /**
   * One sightseer on each registered crowd spot within the crowd's radius (a few placed a look, every PIN_EVERY frames or
   * when the spots change): a free walker, else the farthest unseen walker makes room. Spots on the roadway, on ground
   * nobody can stand on or within 2.5 u of the player / BAYBAY wait. A spot that went away (or fell far behind) lets its
   * stander go: it finishes standing and is recycled out of view. Returns the walkers now on.
   */
  private syncPins(f: { x: number; z: number }, want: number, on: number): number {
    void want;
    const pins = this.env.pins?.();
    if (!pins) return on;
    const changed = pins !== this.pinsSeen;
    if (!changed && this.frame % PIN_EVERY !== 0) return on;
    this.pinsSeen = pins;
    const ids = changed ? new Set(pins.map(p => p.id)) : null;
    for (const [id, w] of this.pinned) {
      const far = Math.hypot(w.x0 - f.x, w.z0 - f.z) > this.radius + 12;
      if (!(ids && !ids.has(id)) && w.on && w.pin === id && !far) continue;
      this.pinned.delete(id);
      if (!w.on || w.pin !== id) continue;
      w.pin = null;
      w.standT = 0;
      if (far) { w.on = false; on--; this.stats.recycled++; }
    }
    let budget = PIN_BUDGET;
    for (const p of pins) {
      const hit = this.pinned.get(p.id);
      if (hit) { hit.standT = Math.max(hit.standT, 30); continue; }
      if (budget <= 0) break;
      if (Math.abs(p.x - f.x) > this.radius || Math.abs(p.z - f.z) > this.radius || Math.hypot(p.x - f.x, p.z - f.z) > this.radius) continue;
      if (this.net.probe.surface(p.x, p.z) === 'road' || !this.net.probe.stand(p.x, p.z, STAND_R) || nearAvoid(p.x, p.z)) continue;
      budget--;
      let w = this.walkers.find(o => !o.on) ?? null;
      if (!w) {
        let bd = -1;
        for (const o of this.walkers) {
          if (!o.on || o.pin || this.env.visible(o.x, o.z)) continue;
          const d = Math.hypot(o.x - f.x, o.z - f.z);
          if (d > bd) { bd = d; w = o; }
        }
        if (!w) continue;
        w.on = false; on--; this.stats.recycled++;
      }
      this.init(w, this.env.visible(p.x, p.z));
      w.mode = 'stand'; w.e = -1;
      w.x = p.x; w.z = p.z; w.x0 = p.x; w.z0 = p.z;
      w.face = p.face + (this.rng() - 0.5) * 0.5;
      w.heading = w.face;
      w.standT = 30;
      w.pin = p.id;
      this.pinned.set(p.id, w);
      on++;
      this.stats.pinned++;
    }
    return on;
  }

  /** The player waved at (x, z): the walkers within r (not mid-crossing, not hopping) stop, turn and wave back. */
  wave(x: number, z: number, r: number): number {
    let k = 0;
    for (const w of this.walkers) {
      if (!w.on || w.grow < 0.5 || w.mode === 'cross' || w.hopT >= 0 || w.waveT > 0) continue;
      const d = Math.hypot(w.x - x, w.z - z);
      if (d > r || d < 0.3) continue;
      w.waveT = WAVE_TIME;
      w.waveDelay = 0.08 + this.rng() * WAVE_STAGGER;
      w.wx = x; w.wz = z;
      w.pause = Math.max(w.pause, w.waveDelay + WAVE_TIME);
      k++;
    }
    this.stats.waves += k;
    return k;
  }

  /** How far a walker's hand is up (0 … 1): the wave eases in and out. */
  waveAmount(w: Walker): number {
    if (w.waveT <= 0 || w.waveDelay > 0) return 0;
    return Math.max(0, Math.min(1, (WAVE_TIME - w.waveT) / 0.25, w.waveT / 0.3));
  }

  // --- spawning ---------------------------------------------------------------------------------------------------

  private spawn(w: Walker, mode: SpawnMode): boolean {
    const r = this.rng, R = this.radius;
    const anywhere = mode !== 'recycle';
    const stand = this.env.standSpots && r() < CROWD.standShare;
    for (let tries = 0; tries < 8; tries++) {
      if (stand && this.spawnStander(w, anywhere)) return true;
      const a = r() * TAU;
      // most of the crowd close to the player (half within ~30 u): the far ones are hidden by the houses anyway
      const d = mode === 'fill' ? 5 + (R - 5) * Math.pow(r(), 1.8)
        : mode === 'near' ? 12 + (NEAR_R + 10 - 12) * r()
        : CROWD.spawnMin + (R - CROWD.spawnMin) * Math.pow(r(), 1.6);
      const x = this.fx + Math.cos(a) * d, z = this.fz + Math.sin(a) * d;
      const ix = this.net.ix;
      const node = ix.nearestNode(x, z, 24, n => !ix.isHero(n));
      if (node < 0) continue;
      const deg = this.net.degree(node);
      if (!deg) continue;
      const e = this.net.outStart(node) + Math.floor(r() * deg);
      if (!WALK_KINDS.has(this.net.kind(e)) || this.net.isHero(this.net.target(e))) continue;
      const s = this.net.edge(e);
      if (!s || s.raised) continue;
      const [a0, a1] = this.span(s);
      if (a1 - a0 < 0.5) continue;
      const along = a0 + r() * (a1 - a0);
      const side: 1 | -1 = r() < 0.5 ? 1 : -1;
      const lane = this.laneFor(side);
      this.net.at(s, along, side * this.offset(s, side, lane), _p);
      const dd = Math.hypot(_p.x - this.fx, _p.z - this.fz);
      if (dd > R) continue;
      const seen = this.env.visible(_p.x, _p.z);
      if (!anywhere && seen && dd < CROWD.spawnInView) continue;
      if (!this.fits(s, along, side, lane)) continue;
      if (this.walkers.some(o => o.on && Math.abs(o.x - _p.x) < 1.5 && Math.abs(o.z - _p.z) < 1.5)) continue;
      if (nearAvoid(_p.x, _p.z)) continue;
      this.init(w, seen);
      w.mode = 'walk'; w.e = e; w.s = along; w.side = side; w.lane = lane; w.laneT = lane;
      w.x = _p.x; w.z = _p.z; w.heading = Math.atan2(s.dx, s.dz);
      return true;
    }
    return false;
  }

  private spawnStander(w: Walker, anywhere: boolean): boolean {
    const r = this.rng;
    const spots = this.env.standSpots!(this.fx, this.fz, this.radius * 0.8);
    if (!spots.length) return false;
    const spot = spots[Math.floor(r() * spots.length)];
    // (a landmark plaza spot is taken by one stander at a time)
    if (spot.exact && this.walkers.some(o => o.on && o.mode === 'stand' && Math.abs(o.x - spot.x) < 1 && Math.abs(o.z - spot.z) < 1)) return false;
    for (let k = 0; k < 4; k++) {
      const a = r() * TAU, d = spot.exact ? r() * spot.r : 1.5 + r() * spot.r;
      const x = spot.x + Math.cos(a) * d, z = spot.z + Math.sin(a) * d;
      const dd = Math.hypot(x - this.fx, z - this.fz);
      if (dd > this.radius) continue;
      // (a landmark plaza spot is curated: any walkable ground; round a place, not on the roadway)
      const surf = this.net.probe.surface(x, z);
      if (!spot.exact && surf !== 'plaza' && surf !== 'pavement' && surf !== 'grass' && surf !== 'wood') continue;
      if (!this.net.probe.stand(x, z, 0.3)) continue;
      // (verify m6) never in the player's arrival ring / on BAYBAY / a resident: a fast-travel landing refilled the plaza
      // spots round the player, and a sightseer stood in the player's face
      if (nearAvoid(x, z)) continue;
      // (W5-T5) never in a clear lane (an event's aisle, the GGB deck's centre)
      if (this.inLane(x, z, 0.3)) continue;
      const seen = this.env.visible(x, z);
      if (!anywhere && seen && dd < CROWD.spawnInView) continue;
      this.init(w, seen);
      w.mode = 'stand'; w.e = -1;
      w.x = x; w.z = z; w.x0 = x; w.z0 = z;
      const f = spot.face ?? spot;
      w.face = Math.atan2(f.x - x, f.z - z) + (r() - 0.5) * 1.2;
      w.heading = w.face;
      w.standT = 20 + r() * 40;
      return true;
    }
    return false;
  }

  /** (W5-T5) (x, z) lies within a clear lane (+ margin), along its length */
  inLane(x: number, z: number, margin = 0): boolean {
    const lanes = this.env.lanes?.();
    if (!lanes) return false;
    for (const L of lanes) {
      const q = laneDistance(L.lane, x, z);
      if (q.d < L.half + margin && q.t > 0 && q.t < 1) return true;
    }
    return false;
  }

  private init(w: Walker, fade: boolean) {
    const r = this.rng;
    w.on = true;
    w.v = CROWD.speed[0] + r() * (CROWD.speed[1] - CROWD.speed[0]);
    w.ph = r() * TAU;
    w.color = Math.floor(r() * 1e6);
    w.scale = 0.93 + r() * 0.14;
    w.px = w.pz = 0; w.pushHold = 0; w.hopT = -1; w.hopCool = 0; w.pause = 0; w.check = 0;
    w.grow = fade ? 0 : 1;
    w.onRoad = false;
    w.leave = false;
    w.pin = null;
    w.waveT = 0;
    w.lx = w.lz = 0;
    w.lane += (r() - 0.5) * 0.16;
    this.stats.spawned++;
  }

  // --- paths -----------------------------------------------------------------------------------------------------

  /** Keep right: the walker on its left-hand sidewalk walks near the kerb, on its right-hand one near the houses. */
  private laneFor(side: 1 | -1): number { return (side > 0 ? CROWD.laneIn : CROWD.laneOut) + this.rng() * 0.16; }

  /** Offset of a walker from the edge's centre line on `side` (positive). */
  private offset(s: StreetEdge, side: 1 | -1, lane: number): number {
    if (!s.road) return 0.12 + lane * 0.45;
    return (side > 0 ? s.curbL : s.curbR) + lane;
  }

  /** The walkable stretch of an edge: the corners at junctions are cut back to the crossing street's kerb. */
  private span(s: StreetEdge): [number, number] {
    const a = this.net.degree(s.u) >= 3 ? this.net.setback(s.u, s.dx, s.dz) + 0.35 : 0;
    const b = this.net.degree(s.v) >= 3 ? this.net.setback(s.v, s.dx, s.dz) + 0.35 : 0;
    if (a + b >= s.len) { const m = s.len / 2; return [m, m]; }
    return [a, s.len - b];
  }

  private move(w: Walker, dt: number) {
    if (w.waveT > 0) { if (w.waveDelay > 0) w.waveDelay -= dt; else w.waveT -= dt; }
    if (w.pause > 0) { w.pause -= dt; w.walking = Math.max(0, w.walking - dt * 4); return; }
    if (w.mode === 'stand') { w.standT -= dt; w.walking = 0; return; }
    w.walking += (Math.min(1, w.pace * 1.6) - w.walking) * Math.min(1, dt * 5);
    if (w.mode === 'cross') {
      const dx = w.x1 - w.x0, dz = w.z1 - w.z0, L = Math.hypot(dx, dz) || 1;
      w.s += w.v * 1.12 * dt;
      if (w.s >= L) { this.enter(w, w.ne, w.ns, w.nside); return; }
      // on the roadway (the traffic waits) only where the ground says so: a corner cut stays on the sidewalk
      w.check += dt;
      if (w.check > 0.25) { w.check = 0; w.onRoad = this.net.probe.surface(w.x, w.z) === 'road'; }
      return;
    }
    const s = this.net.edge(w.e);
    if (!s) return;
    w.onRoad = false;
    w.s += w.v * w.pace * dt;
    w.laneT += (w.lane - w.laneT) * (1 - Math.exp(-dt * 5));
    // a free sidewalk: look ahead every 0.4 u, take the first offset that fits; none on this side → cross the street,
    // or turn round
    w.check += w.v * dt;
    if (w.check > 0.4) {
      w.check = 0;
      const ahead = Math.min(s.len, w.s + 0.9);
      if (!this.fits(s, ahead, w.side, w.lane)) {
        this.stats.blockedMoves++;
        const lane = this.freeLane(s, ahead, w.side);
        if (lane !== null) w.lane = lane;
        else this.detour(w, s);
        if (w.mode !== 'walk' || !w.on) return;
      }
    }
    const [, end] = this.span(s);
    if (w.s >= end) this.junction(w, s);
  }

  /** A walker fits at that offset: standable, and past the kerb along a street (a sidewalk is not the roadway). */
  private fits(s: StreetEdge, along: number, side: 1 | -1, lane: number): boolean {
    this.net.at(s, along, side * this.offset(s, side, lane), _q);
    if (s.road && this.net.probe.surface(_q.x, _q.z) === 'road') return false;
    return this.net.probe.stand(_q.x, _q.z, STAND_R);
  }

  /** The first offset on `side` that fits at `along` (null: none). */
  private freeLane(s: StreetEdge, along: number, side: 1 | -1): number | null {
    for (const lane of s.road ? LANES_ROAD : LANES_PATH) if (this.fits(s, along, side, lane)) return lane;
    return null;
  }

  /** This sidewalk is blocked ahead: cross to the other one if it is free there, else turn round (same sidewalk). */
  private detour(w: Walker, s: StreetEdge) {
    const along = Math.min(s.len, w.s + 1.6), other = -w.side as 1 | -1;
    const lane = this.freeLane(s, along, other);
    if (lane !== null) {
      this.net.at(s, along, other * this.offset(s, other, lane), _p);
      if (this.clearLine(w.x - w.px, w.z - w.pz, _p.x, _p.z) && !this.alongLane(w.x - w.px, w.z - w.pz, _p.x, _p.z)) {
        w.mode = 'cross';
        w.x0 = w.x - w.px; w.z0 = w.z - w.pz; w.x1 = _p.x; w.z1 = _p.z; w.s = 0; w.check = 0;
        w.ne = w.e; w.ns = along; w.nside = other; w.lane = lane;
        this.stats.crossings++;
        return;
      }
    }
    if (s.twin >= 0 && this.net.edge(s.twin)) {
      // the same physical sidewalk, walked the other way
      w.e = s.twin; w.s = Math.max(0, s.len - w.s); w.side = -w.side as 1 | -1;
      return;
    }
    w.on = false;
    this.stats.recycled++;
  }

  /** Walkable ground all the way from a to b (1 u samples): a crossing never cuts through a building or a wall. */
  private clearLine(ax: number, az: number, bx: number, bz: number): boolean {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L));
    for (let i = 1; i < n; i++) if (!this.net.probe.surface(ax + (bx - ax) * (i / n), az + (bz - az) * (i / n))) return false;
    return true;
  }

  /**
   * (W5-T5) A crossing from a to b runs down a clear lane: it passes through one (1 u samples) heading within ~45° of the
   * lane's line. Crossing a lane square on (an aisle between two halves of a crowd) is fine, except a `noCross` lane (the
   * GGB deck's roadway: walkers keep to their sidewalk).
   */
  private alongLane(ax: number, az: number, bx: number, bz: number): boolean {
    const lanes = this.env.lanes?.();
    if (!lanes?.length) return false;
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-3) return false;
    const ux = (bx - ax) / L, uz = (bz - az) / L, n = Math.max(1, Math.ceil(L));
    for (const lane of lanes) {
      const l = lane.lane, ll = Math.hypot(l.bx - l.ax, l.bz - l.az) || 1;
      if (!lane.noCross && Math.abs(ux * (l.bx - l.ax) / ll + uz * (l.bz - l.az) / ll) < 0.7) continue;
      for (let i = 0; i <= n; i++) {
        const q = laneDistance(l, ax + (bx - ax) * (i / n), az + (bz - az) * (i / n));
        if (q.d < lane.half && q.t > 0 && q.t < 1) return true;
      }
    }
    return false;
  }

  /** At the end of a sidewalk: choose the next edge, keep the walker's side of the street, cross if it is not here. */
  private junction(w: Walker, s: StreetEdge) {
    const net = this.net, r = this.rng;
    const bx = w.x - w.px, bz = w.z - w.pz;
    const cands: { f: number; w: number; nside: 1 | -1; a0: number; lane: number; x: number; z: number; d: number }[] = [];
    const consider = (f: number, base: number) => {
      const g = net.edge(f);
      if (!g || g.raised) return;
      // the side of the next street the walker is on now (a turn away from its side means crossing the street)
      const dot = (bx - g.ax) * g.nx + (bz - g.az) * g.nz;
      const nside: 1 | -1 = Math.abs(dot) < 0.2 ? w.side : dot > 0 ? 1 : -1;
      const [a0] = this.span(g);
      let lane: number | null = nside === w.side ? w.lane : this.laneFor(nside);
      if (!this.fits(g, a0, nside, lane)) lane = this.freeLane(g, a0, nside);
      if (lane === null) return;
      net.at(g, a0, nside * this.offset(g, nside, lane), _p);
      const d = Math.hypot(_p.x - bx, _p.z - bz);
      if (d > 26) return;
      // people mostly keep to their side of the street: a long crossing is less likely than a turn along the sidewalk
      cands.push({ f, w: base / (1 + d / CROSS_COST), nside, a0, lane, x: _p.x, z: _p.z, d });
    };
    for (let f = net.outStart(s.v); f < net.outEnd(s.v); f++) {
      if (f === s.twin || !WALK_KINDS.has(net.kind(f)) || net.isHero(net.target(f))) continue;
      const g = net.edge(f);
      if (!g) continue;
      const straight = g.dx * s.dx + g.dz * s.dz;
      // straight on is likelier; steps now and then
      consider(f, (1.2 + straight) * (g.kind === EK.steps ? 0.4 : 1) * (0.5 + r()));
    }
    cands.sort((a, b) => b.w - a.w);
    if (s.twin >= 0) consider(s.twin, 0);
    for (const c of cands) {
      if (c.d < 0.9) { w.lane = c.lane; this.enter(w, c.f, c.a0, c.nside); return; }
      if (!this.clearLine(bx, bz, c.x, c.z) || this.alongLane(bx, bz, c.x, c.z)) continue;
      w.mode = 'cross';
      w.x0 = bx; w.z0 = bz; w.x1 = c.x; w.z1 = c.z; w.s = 0; w.check = 0;
      w.ne = c.f; w.ns = c.a0; w.nside = c.nside; w.lane = c.lane;
      this.stats.crossings++;
      return;
    }
    w.on = false;
    this.stats.recycled++;
  }

  private enter(w: Walker, e: number, s: number, side: 1 | -1) {
    w.mode = 'walk'; w.e = e; w.s = s; w.side = side; w.onRoad = false;
    w.laneT = w.lane;
  }

  // --- people and vehicles -------------------------------------------------------------------------------------------

  /**
   * People among people: someone just ahead going the same way → follow at their pace (or edge past them if much
   * faster); someone coming the other way → both keep right; two too close → ease apart. Pairs within 1.2 u only.
   */
  private separate(dt: number) {
    const ws = this.walkers;
    for (const w of ws) w.pace = 1;
    for (let i = 0; i < ws.length; i++) {
      const a = ws[i];
      if (!a.on) continue;
      for (let j = i + 1; j < ws.length; j++) {
        const b = ws[j];
        if (!b.on) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        if (Math.abs(dx) > 1.2 || Math.abs(dz) > 1.2) continue;
        const d = Math.hypot(dx, dz);
        if (d > 1.2) continue;
        this.meet(a, b, dx, dz, dt);
        this.meet(b, a, -dx, -dz, dt);
        if (d < 0.55 && d > 1e-4) {
          // ease apart (a stander does not budge)
          const k = (0.55 - d) * dt * 2.5 / d;
          if (a.mode !== 'stand') { a.px -= dx * k; a.pz -= dz * k; }
          if (b.mode !== 'stand') { b.px += dx * k; b.pz += dz * k; }
        }
      }
    }
  }

  /** How walker w reacts to o at (dx, dz) from it. */
  private meet(w: Walker, o: Walker, dx: number, dz: number, dt: number) {
    if (w.mode === 'stand' || w.hopT >= 0) return;
    const hx = Math.sin(w.heading), hz = Math.cos(w.heading);
    const along = dx * hx + dz * hz, lat = dx * -hz + dz * hx;
    if (along <= 0 || Math.abs(lat) > 0.5) return;
    const same = o.mode !== 'stand' && Math.cos(o.heading - w.heading) > 0.3;
    // the right of travel is (−hz, hx): keep right of oncoming people, pass slower ones on their left
    const k = (0.5 - Math.abs(lat)) * dt * 2.5;
    if (!same) { w.px += -hz * k; w.pz += hx * k; return; }
    // someone slower just ahead the same way: a quicker walker moves to the sidewalk's other lane to pass (the kerb
    // side ↔ the house side; the sidewalk check falls back if it is blocked), everyone else keeps a body's length back
    if (w.mode === 'walk' && w.v > o.v + 0.12 && along < 1.1) { w.lane = w.lane < 0.55 ? CROWD.laneOut + 0.25 : CROWD.laneIn; return; }
    w.pace = Math.min(w.pace, Math.max(0, Math.min(1, (along - 0.95) / 0.55)));
  }

  /** Step around the player and BAYBAY; relax the push afterwards (like the promenade walkers). */
  private stepAround(w: Walker, dt: number) {
    if (w.mode !== 'stand') {
      const hx = Math.sin(w.heading), hz = Math.cos(w.heading);
      for (const a of _avoid) {
        const dx = w.x - a.x, dz = w.z - a.z, d = Math.hypot(dx, dz);
        if (d > 1.6 || d < 1e-3) continue;
        // sideways, away from them
        const side = dx * hz - dz * hx >= 0 ? 1 : -1;
        const k = (1.6 - d) * dt * 3;
        w.px += hz * side * k; w.pz -= hx * side * k;
      }
    } else {
      // (verify m6) a sightseer the player (or BAYBAY) walks up to shuffles back out of their way, then drifts home
      for (const a of _avoid) {
        const dx = w.x - a.x, dz = w.z - a.z, d = Math.hypot(dx, dz);
        if (d > STANDER_ROOM || d < 1e-3) continue;
        const k = (STANDER_ROOM - d) * dt * 2.2 / d;
        w.px += dx * k; w.pz += dz * k;
        w.pushHold = Math.max(w.pushHold, 0.6);
      }
    }
    if (w.hopT >= 0) {
      w.hopT += dt;
      const k = Math.min(1, w.hopT / CROWD.hopTime), e = 1 - (1 - k) * (1 - k);
      w.px = w.hx0 + (w.hx1 - w.hx0) * e; w.pz = w.hz0 + (w.hz1 - w.hz0) * e;
      if (k >= 1) w.hopT = -1;
    } else if (w.pushHold > 0) w.pushHold -= dt;
    else { const k = Math.exp(-dt * 0.8); w.px *= k; w.pz *= k; }
    const L = Math.hypot(w.px, w.pz);
    if (L > 2.6) { w.px *= 2.6 / L; w.pz *= 2.6 / L; }
    if (w.hopCool > 0) w.hopCool -= dt;
  }

  /** A road vehicle about to reach the walker: hop sideways off its path. */
  private watchTraffic(w: Walker, vehicles: readonly RoadVehicle[]) {
    if (w.hopT >= 0 || w.hopCool > 0) return;
    const moving = w.mode !== 'stand' && w.pause <= 0;
    const vx = moving ? Math.sin(w.heading) * w.v : 0, vz = moving ? Math.cos(w.heading) * w.v : 0;
    for (const q of vehicles) {
      if (Math.abs(q.v) < 1.2) continue;
      const dx = w.x - q.x, dz = w.z - q.z;
      if (dx * dx + dz * dz > (q.halfL + Math.abs(q.v) * CROWD.hopHorizon + 3) ** 2) continue;
      const within = Math.max(CROWD.hopWithin, q.halfW + 0.55);
      // distances to the vehicle's centre line; only a closing approach counts (a car passing along the sidewalk does not)
      const now = centreLineDistance(w.x, w.z, q);
      // the toy traffic brakes for walkers by itself: only a last-moment approach makes them hop
      const ahead = predictApproach(w.x, w.z, vx, vz, q, q.kind === 'traffic' ? 0.45 : CROWD.hopHorizon).d;
      if (ahead >= within || now - ahead < 0.35) continue;
      this.hop(w, q);
      return;
    }
  }

  private hop(w: Walker, q: RoadVehicle) {
    const fx = Math.sin(q.heading), fz = Math.cos(q.heading);
    const nx = fz, nz = -fx;
    const rx = w.x - q.x, rz = w.z - q.z;
    const lat = rx * nx + rz * nz;
    const sides: (1 | -1)[] = Math.abs(lat) < 0.15 ? (this.rng() < 0.5 ? [1, -1] : [-1, 1]) : lat > 0 ? [1, -1] : [-1, 1];
    for (const sd of sides) {
      // clear the body with a margin: from where the walker is to half width + 0.6 on that side
      const need = Math.max(0.8, Math.min(2.4, q.halfW + 0.65 - sd * lat));
      const tx = w.x + nx * sd * need, tz = w.z + nz * sd * need;
      if (!this.net.probe.stand(tx, tz, STAND_R)) continue;
      w.hopT = 0;
      w.hx0 = w.px; w.hz0 = w.pz;
      w.hx1 = w.px + nx * sd * need; w.hz1 = w.pz + nz * sd * need;
      w.pushHold = 1.8;
      w.hopCool = 1.4;
      w.pause = 0.5;
      this.stats.hops++;
      this.env.onHop?.(w, q);
      return;
    }
    // nowhere to go: freeze (people are never knocked over; the vehicle's own give-way does the rest)
    w.pause = 0.8;
    w.hopCool = 0.6;
  }

  private pose(w: Walker, dt: number) {
    let bx: number, bz: number, hd: number;
    // a sightseer's spot is (x0, z0): the push (the player walking up, a hop out of a bus's way) moves them off it and
    // they drift back (verify m6: the base used to be taken from the pushed position, so a stander never budged)
    if (w.mode === 'stand') { bx = w.x0; bz = w.z0; hd = w.face + Math.sin(this.t * 0.3 + w.ph) * 0.4; }
    else if (w.mode === 'cross') {
      const dx = w.x1 - w.x0, dz = w.z1 - w.z0, L = Math.hypot(dx, dz) || 1, k = Math.min(1, w.s / L);
      bx = w.x0 + dx * k; bz = w.z0 + dz * k; hd = Math.atan2(dx, dz);
    } else {
      const s = this.net.edge(w.e);
      if (!s) return;
      this.net.at(s, Math.min(w.s, s.len), w.side * this.offsetT(s, w), _p);
      bx = _p.x; bz = _p.z; hd = Math.atan2(s.dx, s.dz);
    }
    // (W5-T1) waving back: turned to the one who waved
    if (w.waveT > 0 && w.waveDelay <= 0) hd = Math.atan2(w.wx - bx - w.px, w.wz - bz - w.pz);
    w.x = bx + w.px; w.z = bz + w.pz;
    // a push (people passing, the player) never shoves a sidewalk walker onto the roadway: it gives way there
    if (w.mode === 'walk' && w.hopT < 0 && w.pushHold <= 0 && (w.px !== 0 || w.pz !== 0) && this.net.probe.surface(w.x, w.z) === 'road') {
      w.px *= 0.6; w.pz *= 0.6;
      w.x = bx + w.px; w.z = bz + w.pz;
    }
    // (W5-T5) out of the clear lanes: the GGB deck's centre, an event's aisle
    this.laneStep(w, hd, dt);
    w.x += w.lx; w.z += w.lz;
    let d = hd - w.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    w.heading += d * (1 - Math.exp(-dt * 9));
    w.y = this.net.probe.height(w.x, w.z);
    if (w.leave) {
      w.grow -= dt * 1.6;
      if (w.grow <= 0) { w.on = false; w.leave = false; this.stats.recycled++; }
    } else if (w.grow < 1) w.grow = Math.min(1, w.grow + dt * 1.6);
  }

  /** The smoothed offset (laneT is the offset past the kerb, eased toward `lane`). */
  private offsetT(s: StreetEdge, w: Walker): number { return this.offset(s, w.side, w.laneT); }

  /**
   * (W5-T5) The clear-lane rule for the moving crowd: a walker going along a lane (within ~45° of its line) or a sightseer
   * standing in one steps sideways until its body is out of it — to the side it is on, else the other side — onto ground
   * a walker fits on (never from a sidewalk onto the roadway). A walker crossing a lane, or crossing a street, keeps going.
   * The step eases in and out (w.lx / w.lz, added to the pose), so nobody jumps.
   */
  private laneStep(w: Walker, heading: number, dt: number) {
    let tx = 0, tz = 0;
    const lanes = this.env.lanes?.();
    if (lanes?.length && w.mode !== 'cross' && w.hopT < 0) {
      const x = w.x, z = w.z;
      for (const L of lanes) {
        const l = L.lane, need = L.half + CROWD.r + 0.05;
        const ax = Math.min(l.ax, l.bx) - need, bx = Math.max(l.ax, l.bx) + need, az = Math.min(l.az, l.bz) - need, bz = Math.max(l.az, l.bz) + need;
        if (x < ax || x > bx || z < az || z > bz) continue;
        const q = laneDistance(l, x, z);
        // (only along its length: past an end the lane is open ground again)
        if (q.d >= need || q.t <= 0 || q.t >= 1) continue;
        const dx = l.bx - l.ax, dz = l.bz - l.az, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
        if (w.mode === 'walk' && Math.abs(Math.sin(heading) * ux + Math.cos(heading) * uz) < 0.7) continue;
        const onRoad = this.net.probe.surface(x, z) === 'road';
        const fits = (px: number, pz: number) => this.net.probe.stand(px, pz, STAND_R) && (onRoad || this.net.probe.surface(px, pz) !== 'road');
        // the side it is on first (exactly on the line: by its id), then the other one
        const first = q.d < 1e-3 ? (w.id % 2 ? 1 : -1) : q.side;
        for (const side of [first, -first]) {
          const push = side === q.side || q.d < 1e-3 ? need - q.d : need + q.d;
          const nx = -uz * side * push, nz = ux * side * push;
          if (!fits(x + nx, z + nz)) continue;
          tx += nx; tz += nz;
          break;
        }
      }
    }
    const k = 1 - Math.exp(-dt * 5);
    w.lx += (tx - w.lx) * k; w.lz += (tz - w.lz) * k;
    if (Math.abs(w.lx) < 1e-4 && Math.abs(w.lz) < 1e-4) w.lx = w.lz = 0;
  }

  /**
   * Walkers within r of (x, z) as soft obstacles (actors/view.ts registerObstacleSource). The records are reused, one pool
   * per consumer's array (F4: no garbage each frame; a consumer clears its array before every query).
   */
  obstacles(out: Obstacle[], x: number, z: number, r: number) {
    const R = r + CROWD.r;
    const pool = this.obstaclePool.begin(out);
    for (const w of this.walkers) {
      if (!w.on || w.grow < 0.5) continue;
      const dx = w.x - x, dz = w.z - z;
      if (dx * dx + dz * dz > R * R) continue;
      const o = pool.next();
      o.x = w.x; o.z = w.z; o.r = CROWD.r; o.kind = 'crowd';
      out.push(o);
    }
  }
  private readonly obstaclePool = obstaclePool();
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** Shirts: the promenade's, plus a few city colours. */
const SHIRTS = ['#d8744a', '#2f8f88', '#d9b779', '#6f8fc0', '#c95f5a', '#8fae5b', '#f2efe6', '#9c6fb0', '#5a6b7a', '#e2a33e', '#3f5f8f', '#b8c7c9', '#7d4f6f', '#e8c9b0'];

/**
 * ≈ 80-triangle figure beyond CROWD.nearLod: two leg stubs (they swing like the near figure's: aInfo.y ±1), a tapered
 * body (the shirt tint, aInfo.x 9), a head with a hair cap baked into its colours.
 */
export function personFarGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  for (const s of [-1, 1]) b.add(CYL(4), M(s * 0.09, 0.02, 0, Math.PI / 4, 0.08, 0.46, 0.08), '#4b5563', [0, s, 0, 0]);
  b.add(CYL(6, 0.8), M(0, 0.44, 0, 0, 0.22, 0.6, 0.2), '#ffffff', [9, 0, 0, 0]);
  b.addFlat(SPHERE(6, 4), M(0, 1.24, 0.01, 0, 0.2, 0.21, 0.2), (_x, _y, _z, _lx, ly, lz) => (ly > 0.35 || (ly > -0.1 && lz < -0.4) ? HAIR : SKIN));
  return b.build();
}
const HAIR = new THREE.Color('#5a3d2b'), SKIN = new THREE.Color('#e9c3a0');

const _m = new THREE.Matrix4();
const _qt = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

interface Figure { mesh: THREE.InstancedMesh; phase: THREE.InstancedBufferAttribute; walk: THREE.InstancedBufferAttribute }

function figure(geo: THREE.BufferGeometry, max: number, name: string): Figure {
  const phase = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  const walk = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  phase.setUsage(THREE.DynamicDrawUsage); walk.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPhase', phase);
  geo.setAttribute('aWalk', walk);
  const mesh = new THREE.InstancedMesh(geo, crowdPeopleMaterial(), max);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, _c.set('#ffffff'));
  mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.visible = false;
  return { mesh, phase, walk };
}

/** This frame's instance count of a figure mesh (and its upload flags). */
function commitFigure(fig: Figure, count: number) {
  fig.mesh.count = count;
  fig.mesh.visible = count > 0;
  if (!count) return;
  fig.mesh.instanceMatrix.needsUpdate = true;
  fig.mesh.instanceColor!.needsUpdate = true;
  fig.phase.needsUpdate = true;
  fig.walk.needsUpdate = true;
}

export class CrowdLayer {
  readonly group = new THREE.Group();
  readonly sim: CrowdSim;
  private near: Figure;
  private far: Figure;
  private colors: THREE.Color[] = SHIRTS.map(c => new THREE.Color(c).lerp(new THREE.Color('#e8dcc4'), 0.1));
  private dist: Float32Array;
  private sorted: Float32Array;

  constructor(net: StreetNet, env: CrowdEnv, max: number = CROWD.count.high) {
    this.group.name = 'city-crowd';
    this.group.matrixAutoUpdate = false;
    this.sim = new CrowdSim(net, env, { max, seed: 0xc0ffee });
    this.dist = new Float32Array(max);
    this.sorted = new Float32Array(max);
    this.near = figure(personGeometry(), max, 'crowd-near');
    this.far = figure(personFarGeometry(), max, 'crowd-far');
    this.group.add(this.near.mesh, this.far.mesh);
  }

  /** Step the crowd and draw it (camera position for the LOD split and the lens shrink). */
  update(dt: number, cam: { x: number; y: number; z: number }) {
    this.sim.step(dt);
    this.draw(cam);
  }

  draw(cam: { x: number; y: number; z: number }) {
    let n = 0, nf = 0;
    const t = this.sim.time;
    // the near figure for the CROWD.nearMax walkers closest to the camera within CROWD.nearLod (a triangle cap)
    const ws = this.sim.walkers, dist = this.dist;
    let within = 0;
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      dist[i] = w.on ? Math.hypot(w.x - cam.x, w.y + 0.8 - cam.y, w.z - cam.z) : Infinity;
      if (dist[i] <= CROWD.nearLod) within++;
    }
    let nearCut: number = CROWD.nearLod;
    // (a typed array sorts numerically in place: no garbage each frame)
    if (within > CROWD.nearMax) { const sorted = this.sorted; sorted.set(dist); sorted.sort(); nearCut = sorted[CROWD.nearMax - 1]; }
    for (let j = 0; j < ws.length; j++) {
      const w = ws[j];
      if (!w.on) continue;
      const d = dist[j];
      // people right at the lens shrink away (like the promenade's)
      const lens = d < 1.6 ? 0 : d < 3.6 ? smooth((d - 1.6) / 2) : 1;
      const k = w.scale * w.grow * lens;
      if (k < 0.02) continue;
      const bob = w.walking * Math.abs(Math.sin(t * 7.5 + w.ph)) * 0.05;
      const hop = w.hopT >= 0 ? Math.sin(Math.PI * Math.min(1, w.hopT / CROWD.hopTime)) * CROWD.hopHeight : 0;
      _e.set(0, w.heading, w.walking * Math.sin(t * 7.5 + w.ph) * 0.03, 'YXZ');
      _m.compose(_v.set(w.x, w.y + 0.04 + bob + hop, w.z), _qt.setFromEuler(_e), _s.set(k, k, k));
      const fig = d > nearCut ? this.far : this.near;
      const i = fig === this.far ? nf++ : n++;
      fig.mesh.setMatrixAt(i, _m);
      fig.mesh.setColorAt(i, this.colors[w.color % this.colors.length]);
      fig.phase.setX(i, w.ph);
      // (W5-T1) a wave back: aWalk < 0 lifts the right hand (life.ts peopleMaterial); the legs stand still meanwhile
      const wave = this.sim.waveAmount(w);
      fig.walk.setX(i, wave > 0 ? -wave : w.walking);
    }
    commitFigure(this.near, n);
    commitFigure(this.far, nf);
  }

  /** Hide without stepping (travel mode, high views). */
  hide() { this.near.mesh.visible = false; this.far.mesh.visible = false; }

  stats() {
    let walking = 0, standing = 0, crossing = 0, pinnedNow = 0, waving = 0;
    for (const w of this.sim.walkers) if (w.on) {
      if (w.mode === 'stand') standing++; else if (w.mode === 'cross') crossing++; else walking++;
      if (w.pin) pinnedNow++;
      if (w.waveT > 0) waving++;
    }
    return { walking, standing, crossing, pinnedNow, waving, near: this.near.mesh.count, far: this.far.mesh.count, ...this.sim.stats };
  }

  dispose() {
    this.near.mesh.geometry.dispose();
    this.far.mesh.geometry.dispose();
    this.near.mesh.dispose();
    this.far.mesh.dispose();
  }
}

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
