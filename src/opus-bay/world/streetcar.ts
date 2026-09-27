import * as THREE from 'three';
import type { Vec2 } from '../core/types';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { DISTRICT } from '../data/district';
import { MAX_WAIT, currentRide, virtualT } from '../game/ride';
import { BOX, Batch, CYL, M, shade } from './builder';
import { definePlatform, setPlatformPose } from '../actors/platform';
import { crowdPeopleMaterial } from './life';
import { TOY_DYN, TOY_INST, TOY_INST_TINT } from './materials';
import { registerWarmup } from './warmup';
import type { TransitLayer } from './transitLayer';

/**
 * F-line vintage streetcars. Two double-ended cars shuttle along DISTRICT.streetcar.path, dwell 6 s at
 * each stop and ring the bell when they depart. `runtime.streetcar` mirrors one car: the one carrying
 * the player, the one dispatched to a waiting rider, or else the car nearest to the player.
 * That car is also published as the moving platform 'streetcar' (actors/platform.ts): the rider stands in its aisle
 * or sits on a bench, inside the car.
 */

export const DWELL_SECONDS = 6;
const VMAX = 11;
const VMAX_RIDE = 13;
const ACC = 2.6;
const DEC = 2.6;
const CAR_LEN = 8.4;
/** car body origin above the ground; the floor top is FLOOR above that */
const CAR_Y = 0.12;
const FLOOR = 0.5;

interface Car {
  /** position along the loop (world units) */
  u: number;
  v: number;
  dwell: number;
  atStop: string | null;
  mesh: THREE.Mesh;
  pole: THREE.Mesh;
  /** last visual roll (the platform pose carries it) */
  sway: number;
}

interface LoopStop { id: string; u: number; outbound: boolean }

/** Offset between the F-line's two tracks (district SECTION: trackA −12.9, trackB −15.7). */
const TRACK_GAP = 2.8;
/** vertices in each end turnaround */
const TURN_STEPS = 7;

/**
 * A vintage car you can stand in: hollow body (floor, low livery walls, belt, sill), open side windows between cream
 * posts (summer windows down), longitudinal wooden benches and brass poles inside, the rounded cabs and roof as before.
 * The rider stands in the aisle / sits on a bench (actors/platform.ts); from outside you see them through the windows
 * (and the TOY occlusion dither thins the posts right in front of them).
 */
export function carGeometry(livery: string, pole = false): THREE.BufferGeometry {
  const b = new Batch();
  const cream = '#f3ead6', dark = '#2d3431', glass = '#3d4d52', wood = '#b98a5a', brass = '#d9b25a', inside = '#e9dcc0';
  const L = CAR_LEN - 2, W = 2.1, T = 0.08;
  // heights (car frame): livery to the belt, gold belt, cream sill, open windows up to the header, roof — the window
  // band starts at chest height so a rider standing in the aisle shows from the shoulders up
  const BELT = 1.02, SILL = 1.14, WIN = 1.26, HEAD = 2.28, ROOF = 2.57;
  // floor + underframe
  b.add(BOX(), M(0, 0.4, 0, 0, W - 0.06, 0.1, L), '#8f7a62');
  b.add(BOX(), M(0, 0.1, 0, 0, W - 0.3, 0.3, L - 1), '#454b48');
  for (const side of [-1, 1]) {
    const x = side * (W / 2 - T / 2);
    // lower livery wall, gold belt, cream sill (outer skin), then posts between open windows and the header
    b.add(BOX(), M(x, 0.5, 0, 0, T, BELT - 0.5, L), livery);
    b.add(BOX(), M(side * (W / 2 - T / 2 + 0.01), BELT, 0, 0, T + 0.02, SILL - BELT, L), '#e0a94a');
    b.add(BOX(), M(x, SILL, 0, 0, T, WIN - SILL, L), cream);
    for (let i = 0; i < 8; i++) {
      const z = -L / 2 + 0.12 + i * ((L - 0.24) / 7);
      b.add(BOX(), M(x, WIN, z, 0, T, HEAD - WIN, 0.16), cream);
    }
    b.add(BOX(), M(x, HEAD, 0, 0, T, ROOF - HEAD, L), cream);
    // inner faces a touch darker (reads as the inside of the car through the windows)
    b.add(BOX(), M(side * (W / 2 - T - 0.005), 0.5, 0, 0, 0.01, WIN - 0.5, L - 0.6), inside);
    // longitudinal bench: seat, front skirt, backrest
    b.add(BOX(), M(side * 0.66, 0.86, 0, 0, 0.44, 0.09, L - 1.5), wood);
    b.add(BOX(), M(side * 0.46, 0.5, 0, 0, 0.04, 0.36, L - 1.5), shade(wood, 0.8));
    b.add(BOX(), M(side * 0.9, 0.95, 0, 0, 0.07, 0.3, L - 1.5), shade(wood, 0.9));
    // brass poles by the aisle
    for (const pz of [-1.35, 1.35]) b.add(CYL(8), M(side * 0.4, 0.5, pz, 0, 0.035, 2.0, 0.035), brass);
  }
  // rounded cabs: lower livery, belt, cream upper, windscreens, destination sign, headlight
  for (const s of [-1, 1]) {
    b.add(CYL(14), M(0, 0.5, s * L / 2, 0, W / 2, BELT - 0.5, 1.0), livery);
    b.add(CYL(14), M(0, BELT, s * L / 2, 0, W / 2 + 0.01, SILL - BELT, 1.01), '#e0a94a');
    b.add(CYL(14), M(0, SILL, s * L / 2, 0, W / 2, ROOF - SILL, 1.0), cream);
    b.add(BOX(), M(0, 1.45, s * (L / 2 + 0.72), s > 0 ? 0 : Math.PI, 1.3, 0.75, 0.35), glass);
    b.add(BOX(), M(0, 2.3, s * (L / 2 + 0.55), 0, 1.0, 0.26, 0.3), '#ffcf7a', [0, 0, 0, 1]);
    b.add(CYL(8), M(0, 0.8, s * (L / 2 + 0.98), 0, 0.12, 0.12, 0.05), '#fff4d0', [0, 0, 0, 1]);
    // cab bulkhead facing the saloon
    b.add(BOX(), M(0, 0.5, s * (L / 2 - 0.02), 0, W - 0.1, ROOF - 0.5, 0.04), inside);
  }
  // roof (cream underside inside), vents
  b.add(BOX(), M(0, ROOF, 0, 0, W - 0.2, 0.22, L + 0.8), '#d9d4c7');
  b.add(BOX(), M(0, ROOF - 0.02, 0, 0, W - 0.1, 0.02, L), inside);
  b.add(BOX(), M(0, ROOF + 0.22, 0, 0, 0.9, 0.18, L * 0.6), '#bdb7aa');
  // bogies
  for (const s of [-1, 1]) b.add(BOX(), M(0, 0.05, s * (L / 2 - 1), 0, 1.6, 0.35, 1.8), dark);
  // city mode (instanced cars): the trolley pole baked in, trailing up to the wire as the district's separate pole does
  if (pole) {
    const base = new THREE.Matrix4().makeTranslation(0, 2.9 - CAR_Y, -1.8).multiply(new THREE.Matrix4().makeRotationX(-0.71));
    b.add(CYL(5), base.clone().multiply(M(0, 0, 0, 0, 0.04, 2.9, 0.04)), '#2a2a2a');
    b.add(CYL(6), base.clone().multiply(M(0, 2.9, 0, 0, 0.08, 0.12, 0.08)), '#2a2a2a');
  }
  return b.build();
}

/** The car seen from afar (city mode, beyond ~110 u): the same silhouette, livery, lamps and warm sign in a few boxes. */
export function carFarGeometry(livery: string): THREE.BufferGeometry {
  const b = new Batch();
  const L = CAR_LEN - 2, W = 2.1;
  b.add(BOX(), M(0, 0.1, 0, 0, W - 0.3, 0.35, L - 1), '#454b48');
  b.add(BOX(), M(0, 0.45, 0, 0, W, 0.7, L + 1.6), livery);
  b.add(BOX(), M(0, 1.15, 0, 0, W, 1.4, L + 1.4), '#f3ead6');
  b.add(BOX(), M(0, 1.5, 0, 0, W + 0.02, 0.5, L + 1.2), '#3d4d52');
  b.add(BOX(), M(0, 2.55, 0, 0, W - 0.2, 0.3, L + 0.8), '#d9d4c7');
  for (const s of [-1, 1]) {
    b.add(BOX(), M(0, 2.3, s * (L / 2 + 0.55), 0, 1.0, 0.26, 0.3), '#ffcf7a', [0, 0, 0, 1]);
    b.add(BOX(), M(0, 0.8, s * (L / 2 + 0.82), 0, 0.3, 0.2, 0.08), '#fff4d0', [0, 0, 0, 1]);
  }
  return b.build();
}

function poleGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  b.add(CYL(5), M(0, 0, 0, 0, 0.04, 2.9, 0.04), '#2a2a2a');
  b.add(CYL(6), M(0, 2.9, 0, 0, 0.08, 0.12, 0.08), '#2a2a2a');
  return b.build();
}

export class Streetcars {
  readonly group = new THREE.Group();
  /** track A (outbound, toward Pier 39) as given by the district */
  private path: Vec2[];
  private pathLen = 0;
  /** closed loop: track A out, turnaround, track B back, turnaround */
  private loop: Vec2[] = [];
  private cum: number[] = [0];
  /** along-track fraction (0 at the ferry end … 1 at Pier 39) for each loop vertex */
  private along: number[] = [];
  private total = 0;
  private stops: LoopStop[] = [];
  private cars: Car[] = [];
  private tracked = 0;
  private dispatched = false;
  /** the car carrying a virtual ride (flow gave up waiting, F17 ≤ 5 s): it moves with the rider, then dwells */
  private carried = -1;
  private carriedTo: string | null = null;
  private carriedHeading = 0;
  private poleGeo = poleGeometry();
  /** city mode: the cable cars, turntables and extra rails (world/transitLayer.ts, a lazy chunk) */
  private layer: TransitLayer | null = null;
  /** the city F-line (the layer's) runs instead of the hero loop */
  private cityLine = false;
  /** the hero loop is finishing a ride that started before the layer came in (the F-line waits, hidden) */
  private legacyRide = false;
  private disposed = false;

  constructor() {
    this.group.name = 'streetcars';
    if (game.get().worldMode === 'city') this.startCity();
    // the saloon between the cabs: aisle, the rail spot by the rear pole, the two benches (facing the aisle)
    definePlatform('streetcar', {
      floor: FLOOR,
      deck: { minX: -0.42, maxX: 0.42, minZ: -2.1, maxZ: 2.1 },
      rail: { x: 0.05, z: -0.95, heading: 0 },
      seatLeft: { x: 0.58, z: 0.2, heading: -Math.PI / 2 },
      seatRight: { x: -0.58, z: 0.2, heading: Math.PI / 2 },
      seatY: 0.45,
    });
    this.path = DISTRICT.streetcar.path;
    const pc: number[] = [0];
    for (let i = 1; i < this.path.length; i++) pc.push(pc[i - 1] + Math.hypot(this.path[i].x - this.path[i - 1].x, this.path[i].z - this.path[i - 1].z));
    this.pathLen = pc[pc.length - 1];
    // track B = track A shifted landward (away from the Bay)
    const n = this.path.length;
    const trackB: Vec2[] = this.path.map((p, i) => {
      const a = this.path[Math.max(0, i - 1)], b = this.path[Math.min(n - 1, i + 1)];
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
      return { x: p.x + (dz / L) * TRACK_GAP, z: p.z - (dx / L) * TRACK_GAP };
    });
    const turn = (from: Vec2, to: Vec2, fwd: Vec2): Vec2[] => {
      // half loop bulging past the end of the line
      const cx = (from.x + to.x) / 2, cz = (from.z + to.z) / 2, r = TRACK_GAP / 2;
      const ax = (from.x - cx) / r, az = (from.z - cz) / r;
      const out: Vec2[] = [];
      for (let k = 1; k < TURN_STEPS + 1; k++) {
        const t = (k / (TURN_STEPS + 1)) * Math.PI;
        out.push({ x: cx + (ax * Math.cos(t) * r) + fwd.x * Math.sin(t) * r * 1.6, z: cz + (az * Math.cos(t) * r) + fwd.z * Math.sin(t) * r * 1.6 });
      }
      return out;
    };
    const dir = (a: Vec2, b: Vec2) => { const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1; return { x: dx / L, z: dz / L }; };
    const fwdEnd = dir(this.path[n - 2], this.path[n - 1]);
    const fwdStart = dir(this.path[1], this.path[0]);
    this.loop = [...this.path, ...turn(this.path[n - 1], trackB[n - 1], fwdEnd), ...trackB.slice().reverse(), ...turn(trackB[0], this.path[0], fwdStart)];
    this.along = [
      ...pc.map(c => c / this.pathLen),
      ...new Array<number>(TURN_STEPS).fill(1),
      ...pc.slice().reverse().map(c => c / this.pathLen),
      ...new Array<number>(TURN_STEPS).fill(0),
    ];
    for (let i = 1; i <= this.loop.length; i++) {
      const a = this.loop[i - 1], b = this.loop[i % this.loop.length];
      this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    this.total = this.cum[this.cum.length - 1];
    // stops on both legs
    const bStart = this.cum[n + TURN_STEPS];
    const bLen = this.cum[2 * n + TURN_STEPS - 1] - bStart;
    for (const st of DISTRICT.streetcar.stops) {
      this.stops.push({ id: st.id, u: st.at * this.pathLen, outbound: true });
      this.stops.push({ id: st.id, u: bStart + (1 - st.at) * bLen, outbound: false });
    }
    this.stops.sort((a, b) => a.u - b.u);
    const liveries = ['#2f7d5a', '#e0874a'];
    liveries.forEach((livery, i) => {
      const mesh = new THREE.Mesh(carGeometry(livery), TOY_DYN);
      mesh.name = `streetcar-${i}`;
      mesh.castShadow = true;
      mesh.matrixAutoUpdate = false;
      const pole = new THREE.Mesh(this.poleGeo, TOY_DYN);
      pole.matrixAutoUpdate = false;
      pole.name = `trolley-pole-${i}`;
      this.group.add(mesh, pole);
      // one car starts at the first outbound stop, the other at the first inbound stop (opposite sides of the loop)
      const start = i === 0 ? this.stops.find(x => x.outbound)! : this.stops.find(x => !x.outbound)!;
      this.cars.push({ u: start.u, v: 0, dwell: DWELL_SECONDS * (0.4 + i * 0.3), atStop: start.id, mesh, pole, sway: 0 });
    });
  }

  /**
   * City mode (lane F): warm the cable cars' program (instanced TOY_INST with shadows) and load the transit layer lazily,
   * so district mode neither downloads nor compiles any of it.
   */
  private startCity() {
    registerWarmup('f-cable-cars', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 4), 4));
      const mesh = new THREE.InstancedMesh(geo, TOY_INST, 1);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return { objects: [mesh], dispose: () => geo.dispose() };
    });
    // the city crowd (F11): its own people-material instance, instanced with instanceColor (world/sf/crowd.ts); the toy
    // traffic (F12) is TOY_INST_TINT, instanced with instanceColor, casting shadows (world/sf/traffic.ts)
    registerWarmup('f-crowd', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const n = geo.getAttribute('position').count;
      geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(new Float32Array(n * 4), 4));
      geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(1), 1));
      geo.setAttribute('aWalk', new THREE.InstancedBufferAttribute(new Float32Array(1), 1));
      const mesh = new THREE.InstancedMesh(geo, crowdPeopleMaterial(), 1);
      mesh.setColorAt(0, new THREE.Color('#ffffff'));
      return { objects: [mesh], dispose: () => geo.dispose() };
    });
    registerWarmup('f-traffic', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 4), 4));
      const mesh = new THREE.InstancedMesh(geo, TOY_INST_TINT, 1);
      mesh.setColorAt(0, new THREE.Color('#ffffff'));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return { objects: [mesh], dispose: () => geo.dispose() };
    });
    void import('./transitLayer').then(m => m.createTransitLayer()).then(layer => {
      if (!layer) return;
      if (this.disposed) { layer.dispose(); return; }
      this.layer = layer;
      // the city F-line takes over where the hero cars are (no car pops in or out of view)
      layer.fline?.sys.seedFrom(this.cars.map(c => { const p = this.sample(c.u); return { x: p.x, z: p.z, heading: p.heading }; }));
      this.group.add(layer.group);
      layer.group.updateMatrixWorld(true);
    }).catch(error => { if (import.meta.env.DEV) console.warn('[opus-bay transit layer]', error); });
  }

  private wrap(u: number) { return ((u % this.total) + this.total) % this.total; }

  private sample(u: number) {
    const uu = this.wrap(u);
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.cum[mid] <= uu) lo = mid; else hi = mid; }
    const a = this.loop[lo % this.loop.length], b = this.loop[hi % this.loop.length];
    const t = (uu - this.cum[lo]) / (this.cum[hi] - this.cum[lo] || 1);
    const al0 = this.along[lo % this.along.length], al1 = this.along[hi % this.along.length];
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(b.x - a.x, b.z - a.z), along: al0 + (al1 - al0) * t };
  }

  private ahead(from: number, to: number) { return this.wrap(to - from); }

  private nextStop(car: Car) {
    let best: LoopStop | null = null, bestD = Infinity;
    for (const st of this.stops) {
      const d = this.ahead(car.u, st.u);
      if (d > 0.05 && d < bestD) { bestD = d; best = st; }
    }
    return best ? { stop: best, dist: bestD } : null;
  }

  /** Rough seconds until `car` reaches loop position u (driving, dwelling at stops on the way). */
  private eta(car: Car, u: number) {
    const d = this.ahead(car.u, u);
    const stopsOnWay = this.stops.filter(st => { const k = this.ahead(car.u, st.u); return k > 0.1 && k < d - 0.1; }).length;
    return d / (VMAX * 0.8) + car.dwell + stopsOnWay * DWELL_SECONDS;
  }

  private handleRide() {
    const ride = currentRide();
    const move = game.get().move;
    const riding = move.mode === 'transit' && move.line === 'streetcar' && ride;
    if (!riding) {
      this.dispatched = false;
      // a carried car stops at the rider's destination (on the outbound track) and dwells while they step off
      if (this.carried >= 0) {
        const car = this.cars[this.carried];
        car.atStop = this.carriedTo; car.dwell = DWELL_SECONDS; car.v = 0;
        this.carried = -1; this.carriedTo = null;
      }
      return null;
    }
    const from = DISTRICT.streetcar.stops.find(s => s.id === ride.from), to = DISTRICT.streetcar.stops.find(s => s.id === ride.to);
    if (!from || !to) return ride;
    const outbound = to.at > from.at;
    const board = this.stops.find(s => s.id === from.id && s.outbound === outbound);
    if (!board) return ride;
    if (!this.dispatched) {
      this.dispatched = true;
      const waiting = this.cars.findIndex(c => c.atStop === from.id && Math.abs(this.ahead(board.u, c.u)) < 0.5);
      if (waiting >= 0) this.tracked = waiting;
      else this.dispatch(board.u);
    }
    // no car made it in time: the tracked car picks the rider up and carries them (never a ride on bare rails)
    if (ride.mode === 'virtual' && this.carried < 0) {
      this.carried = this.tracked;
      this.carriedTo = ride.to;
    }
    return ride;
  }

  /**
   * The car that gets to the boarding point soonest. If it would miss flow's wait (MAX_WAIT), bring an out-of-sight
   * car in close enough to pull up in time (≈4.4 s from 24u), so the rider boards the real car.
   */
  private dispatch(boardU: number) {
    let best = 0, bestEta = Infinity;
    this.cars.forEach((car, i) => { const e = this.eta(car, boardU); if (e < bestEta) { bestEta = e; best = i; } });
    if (bestEta > MAX_WAIT - 0.5) {
      const away = this.cars
        .map((car, i) => { const p = this.sample(car.u); return { i, d: Math.hypot(p.x - runtime.player.x, p.z - runtime.player.z) }; })
        .filter(c => c.d > 55).sort((a, b) => b.d - a.d)[0];
      if (away) {
        best = away.i;
        const car = this.cars[best];
        car.u = this.wrap(boardU - 24);
        car.v = VMAX * 0.8; car.dwell = 0; car.atStop = null;
        const other = this.cars[1 - best];
        if (other && Math.abs(this.ahead(car.u, other.u)) < CAR_LEN * 3) other.u = this.wrap(car.u + CAR_LEN * 4);
      }
    }
    this.tracked = best;
  }

  update(dt: number, t: number) {
    // city mode: once the transit layer runs the F-line to the Castro (world/flineLayer.ts), it owns the cars, the
    // platform 'streetcar' and runtime.streetcar; the hero loop only finishes a ride that started on it
    const r = currentRide();
    const fline = this.layer?.fline ?? null;
    const city = !!fline && !(r && !r.line);
    // (review) a hero ride that started before the layer came in: the F-line keeps simulating but stays hidden and off
    // the platform 'streetcar' / runtime.streetcar until that ride ends, then takes over where the hero cars are by then
    if (fline && !city) this.legacyRide = true;
    if (city !== this.cityLine) {
      this.cityLine = city;
      for (const c of this.cars) { c.mesh.visible = !city; c.pole.visible = !city; }
      if (city && this.legacyRide) fline!.sys.seedFrom(this.cars.map(c => { const p = this.sample(c.u); return { x: p.x, z: p.z, heading: p.heading }; }));
      if (city) this.legacyRide = false;
    }
    fline?.setActive(city);
    if (city) { this.layer!.update(dt, t); return; }
    const ride = this.handleRide();
    const carrying = !!ride && ride.mode === 'follow';
    this.cars.forEach((car, i) => {
      const mine = carrying && i === this.tracked;
      if (ride && ride.mode === 'virtual' && i === this.carried) {
        // carried along track A (the path the virtual ride follows), facing the way the rider travels
        const u = virtualT(ride) * this.pathLen;
        car.v = Math.min(VMAX_RIDE, Math.abs(u - car.u) / Math.max(dt, 1e-3));
        car.u = u; car.dwell = 0; car.atStop = null;
        const other = this.cars[1 - i];
        if (other && other.dwell <= 0 && Math.min(this.ahead(car.u, other.u), this.ahead(other.u, car.u)) < CAR_LEN + 1) other.u = this.wrap(car.u + this.total / 2);
      } else if (car.dwell > 0) {
        car.dwell -= dt;
        car.v = 0;
        if (car.dwell <= 0) {
          car.atStop = null;
          const p = this.sample(car.u);
          if (Math.hypot(p.x - runtime.player.x, p.z - runtime.player.z) < 48 || mine) emit({ type: 'streetcar-bell' });
          car.u = this.wrap(car.u + 0.1); // pull away from the stop
        }
      } else {
        const next = this.nextStop(car);
        const dist = next ? next.dist : Infinity;
        const other = this.cars[1 - i];
        const gap = other ? this.ahead(car.u, other.u) - CAR_LEN - 3 : Infinity;
        const vmax = mine ? VMAX_RIDE : VMAX;
        const target = Math.min(vmax, Math.sqrt(2 * DEC * Math.max(0, dist)), Math.sqrt(2 * DEC * Math.max(0, gap)));
        car.v = car.v < target ? Math.min(target, car.v + ACC * dt) : Math.max(target, car.v - DEC * 1.6 * dt);
        car.u = this.wrap(car.u + car.v * dt);
        if (next && this.ahead(car.u, next.stop.u) < 0.08 && car.v < 0.6) {
          car.u = next.stop.u;
          car.atStop = next.stop.id;
          car.dwell = mine && ride && next.stop.id !== ride.to ? 2 : DWELL_SECONDS;
        }
      }
      const p = this.sample(car.u);
      if (ride && ride.mode === 'virtual' && i === this.carried) { if (ride.toT < ride.fromT) p.heading += Math.PI; this.carriedHeading = p.heading; }
      const sway = Math.sin(t * 7 + i) * 0.006 * Math.min(1, car.v / 5);
      car.mesh.matrix.compose(new THREE.Vector3(p.x, CAR_Y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.heading, sway, 'YXZ')), new THREE.Vector3(1, 1, 1));
      car.sway = sway;
      car.mesh.matrixWorldNeedsUpdate = true;
      // trolley pole trails behind, up to the overhead wire
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      car.pole.matrix.compose(new THREE.Vector3(p.x - fx * 1.8, 2.9, p.z - fz * 1.8), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.71, p.heading, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
      car.pole.matrixWorldNeedsUpdate = true;
    });
    // mirror one car into runtime.streetcar
    if (!ride) {
      let best = 0, bestD = Infinity;
      this.cars.forEach((car, i) => { const p = this.sample(car.u); const d = Math.hypot(p.x - runtime.player.x, p.z - runtime.player.z); if (d < bestD) { bestD = d; best = i; } });
      this.tracked = best;
    }
    if (this.carried >= 0) this.tracked = this.carried;
    const car = this.cars[this.tracked];
    const p = this.sample(car.u);
    runtime.streetcar.x = p.x;
    runtime.streetcar.z = p.z;
    runtime.streetcar.heading = this.carried >= 0 ? this.carriedHeading : p.heading;
    runtime.streetcar.t = Math.max(0, Math.min(1, p.along));
    runtime.streetcar.atStop = car.atStop;
    // the car carrying (or about to carry) the rider is the 'streetcar' platform
    setPlatformPose('streetcar', { x: p.x, y: CAR_Y, z: p.z, heading: runtime.streetcar.heading, roll: car.sway }, dt);
    this.layer?.update(dt, t);
  }

  /** World positions of the cars (for wakes / QA). */
  positions() { return this.cars.map(c => this.sample(c.u)); }

  dispose() {
    for (const c of this.cars) c.mesh.geometry.dispose();
    this.poleGeo.dispose();
    this.disposed = true;
    this.layer?.dispose();
  }
}

