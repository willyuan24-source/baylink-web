import * as THREE from 'three';
import { definePlatform, setPlatformPose } from '../../actors/platform';
import { emitAt } from '../../audio/cityHooks';
import { emit } from '../../core/events';
import { runtime } from '../../core/runtime';
import { ALCA_FERRY_ID, ALCA_TERMINALS, FERRY } from '../../data/ferry';
import { setFerrySystemFor } from '../../data/transit';
import { bayParts } from '../../game/bayNow';
import { baybayHeld, bubbleWaits } from '../../game/baybayHold';
import { bubble, goalsStepOpen } from '../../game/flow';
import { flow } from '../../game/flowStore';
import { game } from '../../core/store';
import { currentRide } from '../../game/ride';
import { BOX, Batch, CYL, M } from '../builder';
import { FERRY_PLATFORM } from '../ferry';
import { spawnFx } from '../fx';
import { cityGullGeometry, ferryGeometry } from '../life';
import { TOY, TOY_DYN, TOY_INST } from '../materials';
import { type AlcaClock, type AlcaTraffic, AlcaFerrySystem } from './alcatrazFerrySystem';
import { ALCA_LINES } from './alcatrazLines';
import { ALCA_ARRIVAL, ALCA_WALK_GRAPH, onAlcatraz } from './alcatrazWalk';

/**
 * Wave 8 · lane A · the toy Alcatraz ferry in the city (installed by world/transitLayer.ts, the lazy city transit chunk;
 * district mode never builds it). Owns:
 *
 * - the shuttle (world/sf/alcatrazFerrySystem.ts `AlcaFerrySystem`, pure) on the Bay clock, published as the ride system
 *   of the line 'ferry-alcatraz' (data/transit setFerrySystemFor: game/transit.ts boardFerry / rideFerry find it there);
 * - its boat: the city ferry's hull with the open sun deck (world/life.ts ferryGeometry, a navy stripe: one TOY_DYN
 *   mesh, 1 call + its shadow near the player), and the platform 'ferry-alcatraz' (the same deck plan as the Ferry
 *   Building boat's: you stand at the rail or sit on the benches);
 * - two quay signs (Pier 33's plaza and the island's dock: a navy board with a white toy boat over blue waves, no
 *   lettering) as one static mesh each, only drawn within 160 u of the player;
 * - the boat's events as `transit` game events (the horn on leaving: the rider's own, or from out on the water when near;
 *   depart / arrive / board for the rider), the wake's foam and a little bow spray near the player (the shared fx pool);
 * - three gulls gliding along over the stern while the boat makes way near the player (life.ts's city gull figure, one
 *   TOY_INST InstancedMesh: 1 call, ≈ 700 triangles, only then).
 *
 * The crossing of the waterfront's ferry tracks gives way to the other boats: `traffic` (transitLayer passes the
 * water's wake list — every ferry and sailboat life.ts moves, with its heading; the moving ones are given way to).
 *
 * The island watcher (2 Hz, on foot on Alcatraz): BAYBAY's fixed lines (world/sf/alcatrazLines.ts) at the stair's foot
 * (once a page), the occupation after a while at the cellhouse front (once a page), and — on the island without the
 * ferry (a glide in) — how to get back (once a visit). Never while BAYBAY is held (game/baybayHold), a dialogue or a
 * panel is open, or an arrival / cinematic plays: the line waits for the next tick.
 */

/** the gulls over the stern (boat-local: right, up, along — negative = aft — and their circling phase / radius) */
const GULLS = [{ x: 1.6, y: 4.6, z: -6.5, ph: 0, r: 0.9 }, { x: -2.2, y: 5.4, z: -8.5, ph: 2.1, r: 1.2 }, { x: 0.4, y: 6.3, z: -11, ph: 4.2, r: 1.4 }] as const;
const GULL_NEAR = 140;

/** the toy ferry's line colour: navy (the Ferry Building boat is teal) */
const STRIPE = '#27466f';
const HEAR = 90;
const WAKE_LIFT = 0.06, WAKE_NEAR = 160;
/** the quay signs are drawn within this of the player (u) */
const SIGN_NEAR = 160;

export interface AlcaFerryOptions {
  /** the other boats on the water (x, z, heading, strength — 0 = stopped: life.ts's wake list); default none */
  wakes?: () => readonly { x: number; y: number; z: number; w: number }[] | null;
}

/** The Bay clock for the timetable, read at most once a second (bayParts allocates). */
function clockReader(): () => AlcaClock {
  let at = -Infinity, last: AlcaClock | null = null;
  return () => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!last || now - at > 1000) { last = bayParts(); at = now; }
    return last;
  };
}

/** A quay sign: a post, a navy board facing `heading`, a white toy boat over two blue wave bars (local, at the origin). */
function signGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const post = '#e8e2d6', navy = STRIPE, white = '#f7f4ec', sea = '#5f9fc8', hull = '#c9573c';
  b.add(CYL(6), M(0, 0, 0, 0, 0.07, 1.3, 0.07), post);
  b.add(BOX(), M(0, 1.25, 0, 0, 1.25, 0.8, 0.08), navy);
  for (const s of [-1, 1]) {
    const z = s * 0.045;
    // waves, the hull, the white cabin and the funnel on each face
    b.add(BOX(), M(0, 1.36, z, 0, 0.95, 0.05, 0.01), sea);
    b.add(BOX(), M(0, 1.45, z, 0, 0.8, 0.05, 0.01), sea);
    b.add(BOX(), M(0, 1.52, z, 0, 0.62, 0.1, 0.012), hull);
    b.add(BOX(), M(-0.04, 1.62, z, 0, 0.4, 0.13, 0.014), white);
    b.add(BOX(), M(0.1, 1.75, z, 0, 0.08, 0.1, 0.016), '#f2c230');
  }
  b.add(BOX(), M(0, 2.05, 0, 0, 1.33, 0.06, 0.12), '#d9d4c7');
  return b.build();
}

/** Where each quay sign stands: beside the quay, facing the way a rider arrives (world x, z, heading). */
export const ALCA_SIGNS = [
  // Pier 33's plaza: just east of the quay, the board facing the Embarcadero (south-west)
  { x: ALCA_TERMINALS.pier33.quay.x + 2.6, z: ALCA_TERMINALS.pier33.quay.z + 0.9, heading: 0.35 },
  // the island's dock apron, by the float, facing up the dock road
  { x: ALCA_TERMINALS.island.quay.x - 1.6, z: ALCA_TERMINALS.island.quay.z + 0.9, heading: -1.0 },
] as const;

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _m = new THREE.Matrix4(), _g = new THREE.Vector3(1.4, 1.4, 1.4);

export class AlcaFerryLayer {
  readonly sys: AlcaFerrySystem;
  readonly group = new THREE.Group();
  readonly boat: THREE.Mesh;
  private readonly signs: THREE.Mesh[] = [];
  /** the gulls following the boat (visible while it makes way near the player) */
  readonly gulls: THREE.InstancedMesh;
  private wakeIn = 0;
  private readonly traffic: AlcaTraffic[] = [];
  private readonly wakes: AlcaFerryOptions['wakes'];

  constructor(opts: AlcaFerryOptions = {}) {
    this.wakes = opts.wakes;
    this.sys = new AlcaFerrySystem({ clock: clockReader(), traffic: () => this.readTraffic() });
    this.group.name = 'alcatraz-ferry';
    this.boat = new THREE.Mesh(ferryGeometry(STRIPE, true), TOY_DYN);
    this.boat.name = 'alcatraz-ferry-boat';
    this.boat.matrixAutoUpdate = false;
    this.boat.castShadow = true;
    this.group.add(this.boat);
    const geo = signGeometry();
    for (const s of ALCA_SIGNS) {
      const m = new THREE.Mesh(geo, TOY);
      m.name = 'alcatraz-ferry-sign';
      m.matrixAutoUpdate = false;
      // the sign's ground: the plaza at Pier 33 (≈ 0) and the island's dock deck (0.3)
      const y = s.z < -60 ? 0.3 : 0;
      m.matrix.compose(_p.set(s.x, y, s.z), _q.setFromEuler(_e.set(0, s.heading, 0)), _s);
      m.matrixWorldNeedsUpdate = true;
      this.signs.push(m);
      this.group.add(m);
    }
    this.gulls = new THREE.InstancedMesh(cityGullGeometry(), TOY_INST, GULLS.length);
    this.gulls.name = 'alcatraz-ferry-gulls';
    this.gulls.frustumCulled = false;
    this.gulls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.gulls.visible = false;
    this.group.add(this.gulls);
    definePlatform(ALCA_FERRY_ID, FERRY_PLATFORM);
    setFerrySystemFor(ALCA_FERRY_ID, this.sys);
    this.place();
  }

  /** the boats on the water (the wake list: x, z, heading, strength > 0 = moving, 0 = stopped), as positions + velocities */
  private readTraffic(): readonly AlcaTraffic[] {
    const out = this.traffic;
    out.length = 0;
    const list = this.wakes?.();
    if (!list) return out;
    for (const w of list) {
      // (an unused slot of the list is all zeros)
      if (!(w.w > 0) && w.x === 0 && w.y === 0) continue;
      // a ferry (strength 1) makes ≈ 6–9 u/s, a sailboat (0.45) ≈ 3; a ferry stopped on the water (strength 0: its
      // rider's Settings / hop-off brake, W8-A review A-RC-4) still sits in the way — given way to where it lies
      const v = w.w >= 0.9 ? 8 : w.w > 0 ? 3.2 : 0;
      out.push({ x: w.x, z: w.y, vx: Math.sin(w.z) * v, vz: Math.cos(w.z) * v });
    }
    return out;
  }

  private place() {
    const pose = this.sys.boat.pose;
    _e.set(-(pose.pitch ?? 0), pose.heading, pose.roll, 'YXZ');
    this.boat.matrix.compose(_p.set(pose.x, pose.y, pose.z), _q.setFromEuler(_e), _s);
    this.boat.matrixWorldNeedsUpdate = true;
  }

  update(dt: number) {
    const sys = this.sys;
    // a ride the game ended some other way (a trip, a reset): the boat forgets its rider
    if (sys.rideStatus() && currentRide()?.line !== ALCA_FERRY_ID) sys.cancel();
    sys.step(dt);
    const b = sys.boat, p = runtime.player;
    setPlatformPose(ALCA_FERRY_ID, b.pose, dt);
    this.place();
    for (let i = 0; i < this.signs.length; i++) {
      const s = ALCA_SIGNS[i];
      this.signs[i].visible = Math.abs(s.x - p.x) < SIGN_NEAR && Math.abs(s.z - p.z) < SIGN_NEAR;
    }
    const d = Math.hypot(b.pose.x - p.x, b.pose.z - p.z), mine = b.rider;
    this.moveGulls(b.v > 1 && d < GULL_NEAR);
    // foam in the wake and a little spray at the bow while the boat makes way (the shared fx pool, near the player only)
    if (b.v > 1.2 && d < WAKE_NEAR && (this.wakeIn -= dt) <= 0) {
      this.wakeIn = 0.14;
      const back = b.leg === 'astern' ? -1 : 1;
      const fx = Math.sin(b.pose.heading) * back, fz = Math.cos(b.pose.heading) * back, half = FERRY.length / 2;
      const wy = b.pose.y + WAKE_LIFT;
      spawnFx('wake', b.pose.x - fx * half, wy, b.pose.z - fz * half, { scale: Math.min(1.2, 0.5 + b.v * 0.08) });
      if (Math.random() < 0.3) spawnFx('splash', b.pose.x + fx * (half - 0.6), wy, b.pose.z + fz * (half - 0.6), { scale: 0.45, count: 3 });
    }
    for (const e of sys.events) {
      const base = { type: 'transit' as const, line: ALCA_FERRY_ID, kind: 'ferry' as const };
      if (e.what === 'depart' && (mine || d < HEAR)) {
        const horn = { ...base, what: 'horn' as const, strength: mine ? 1 : Math.max(0.3, 1 - d / HEAR) };
        if (mine) emit(horn); else emitAt(horn, b.pose.x, b.pose.z);
      }
      if (e.what === 'depart' && mine) emit({ ...base, what: 'depart' });
      if (e.what === 'arrive' && mine) emit({ ...base, what: 'arrive' });
      if (e.what === 'arrive' && mine && e.station === ALCA_TERMINALS.island.id) this.ferriedIn = true;
      if (e.what === 'board') emit({ ...base, what: 'board' });
    }
    sys.events.length = 0;
    this.watchIsland(dt);
  }

  /** The gulls: each on a small circle over its spot aft of the boat, along with it, banking into the circle. */
  private moveGulls(on: boolean) {
    const g = this.gulls;
    g.visible = on;
    if (!on) return;
    const pose = this.sys.boat.pose, t = this.sys.time, c = Math.cos(pose.heading), sn = Math.sin(pose.heading);
    GULLS.forEach((q, i) => {
      const a = t * 0.8 + q.ph, lx = q.x + Math.cos(a) * q.r, lz = q.z + Math.sin(a) * q.r * 0.6;
      // boat-local (right = (cos h, −sin h), forward = (sin h, cos h)) → world
      const x = pose.x + lx * c + lz * sn, z = pose.z - lx * sn + lz * c;
      _e.set(0, pose.heading + Math.sin(a) * 0.25, -Math.cos(a) * 0.35, 'YXZ');
      g.setMatrixAt(i, _m.compose(_p.set(x, pose.y + q.y + Math.sin(t * 1.3 + q.ph) * 0.25, z), _q.setFromEuler(_e), _g));
    });
    g.instanceMatrix.needsUpdate = true;
  }

  // --- the island watcher -------------------------------------------------------------------------------------

  private islandT = 0;
  /** on the island now; came by ferry this visit; seconds near the cellhouse front this visit */
  private visit = { on: false, ferried: false, front: 0, wayBack: false };
  /** lines said this page */
  private said = { stair: false, occupation: false };
  /** the rider stepped ashore at the island (set from the boat's arrival with its rider) */
  private ferriedIn = false;

  private quiet(): boolean {
    const s = game.get(), f = flow.get();
    // (and whatever would drop or park the bubble: the goals step, a postcard reward, lane K's waiting overlays)
    return baybayHeld() || bubbleWaits() || goalsStepOpen() || !!f.postcardReward || !!f.postcardFly
      || !!s.dialogue.nodeId || !!s.panel.kind || !!f.cinematic || !!f.arrival || !!f.bubble;
  }

  private watchIsland(dt: number) {
    if ((this.islandT -= dt) > 0) return;
    const step = 0.5;
    this.islandT = step;
    const p = runtime.player, v = this.visit;
    if (!onAlcatraz(p.x, p.z) || game.get().worldMode !== 'city') {
      if (v.on) { v.on = false; v.ferried = false; v.front = 0; v.wayBack = false; }
      return;
    }
    // (a visit starts on foot: riding in alongside the island is not landing on it)
    if (game.get().move.mode !== 'foot') return;
    if (!v.on) { v.on = true; v.ferried = this.ferriedIn; this.ferriedIn = false; v.front = 0; v.wayBack = false; }
    // gliding in (no ferry): how to get back, once a visit, a moment after landing
    if (!v.ferried && !v.wayBack && !this.quiet()) { v.wayBack = true; bubble(ALCA_LINES.wayBack, 4600); return; }
    const stair = ALCA_WALK_GRAPH.nodes[4];
    if (!this.said.stair && Math.hypot(p.x - stair.x, p.z - stair.z) < 3.5 && !this.quiet()) { this.said.stair = true; bubble(ALCA_LINES.stair, 4600); return; }
    if (Math.hypot(p.x - ALCA_ARRIVAL.x, p.z - ALCA_ARRIVAL.z) < 7) v.front += step;
    if (!this.said.occupation && v.front >= 12 && !this.quiet()) { this.said.occupation = true; bubble(ALCA_LINES.occupation, 5600); }
  }

  /** QA: where the boat is and what it does */
  stats() {
    const b = this.sys.boat;
    return { leg: b.leg, s: +b.s.toFixed(1), v: +b.v.toFixed(2), x: +b.pose.x.toFixed(1), z: +b.pose.z.toFixed(1), rider: b.rider, held: +b.held.toFixed(1), service: this.sys.serviceState() };
  }

  dispose() {
    setFerrySystemFor(ALCA_FERRY_ID, null);
    this.boat.geometry.dispose();
    this.gulls.geometry.dispose();
    this.signs[0]?.geometry.dispose();
  }
}
