import * as THREE from 'three';
import { walkGraph } from '../../actors/nav';
import { registerObstacleSource } from '../../actors/view';
import { cityHooks, clearCityHooks, emitAt, pushPass } from '../../audio/cityHooks';
import { onEvent } from '../../core/events';
import { CHUNK } from '../../core/geo';
import { runtime } from '../../core/runtime';
import { game } from '../../core/store';
import { canStand, cityChunkEpoch, heightAt, surfaceAt } from '../../core/terrain';
import { placesNear } from '../../data/sf/places';
import { RESIDENTS } from '../../data/sf/residents';
import { travelActive } from '../../game/fastTravel';
import { U } from '../materials';
import { CROWD, CrowdLayer, type CrowdEnv, type StandSpot } from './crowd';
import { WAVE_REACH, crowdPins, crowdWave, takeCrowdWaves } from './crowdSpots';
import { sfLandmark } from './landmarks/index';
import { landmarkPlazaSpots } from './landmarks/context';
import { type RoadVehicle, type StreetProbe, StreetNet, collectRoadVehicles, onTransitStreet, registerRoadVehicles } from './streetNet';
import { setVehicle, vehiclePool } from './recordPool';
import { TRAFFIC, TrafficLayer, type TrafficEnv } from './traffic';

/**
 * City life host (lane F, wave 3 part b): the crowd (F11) and the toy traffic (F12) around the player, created by the
 * transit layer (world/transitLayer.ts, the lazy city chunk) once the walking graph is in. It
 *
 * - gives both simulations the ground (core/terrain: surface, stand, height, the chunk epochs), the camera's rough view
 *   test, the people to step round / stop for, and every road vehicle (streetNet `registerRoadVehicles`: the transit
 *   layer's cable cars and F-line cars, the traffic's own cars, the player's bike / car registered here);
 * - registers both as obstacle sources for the walker and for the player's vehicle (actors/view.ts, E2's consumer:
 *   'crowd' walkers get a "whoa", 'traffic' a soft bump);
 * - pauses both (hidden, not stepped) in fast-travel mode, and refills around the landing spot afterwards; the crowd also
 *   hides while the camera is high over the streets (a glide), where people are specks;
 * - follows the quality level (walkers 64 / 44 / 24, cars 24 / 16 / 8) and the night (fewer of both);
 * - feeds the audio (audio/cityHooks.ts): the crowd around the listener, cars passing close by, the hop-aside squeak;
 * - (W5-T1) hands the crowd the other lanes' crowd spots (world/sf/crowdSpots.ts: pinned sightseers) and the player's
 *   waves (crowdSpots `crowdWave`, and the game event { type: 'emote', who: 'player', emote: 'wave' }): walkers within
 *   6 u wave back.
 */

const PLAYER_BIKE = { halfL: 0.85, halfW: 0.35 };
const PLAYER_CAR = { halfL: 1.05, halfW: 0.6 };
/** sights people stand about at (places.json kinds) and how far around them (u) */
const STAND_KINDS: Record<string, number> = { plaza: 16, landmark: 10, viewpoint: 6, attraction: 7, museum: 6, historic: 5 };
/** a hop-aside is heard within this of the player (u) */
const HOP_HEARD = 22;
/** the crowd hides while the camera is this far above the ground under the player (u): a glide over the streets */
const CROWD_HIGH = 55;

export interface CityLifeOptions {
  /** rough "could the player see this" (the transit layer's view cone) */
  visible(x: number, z: number): boolean;
}

export const cityProbe: StreetProbe = {
  surface: (x, z) => surfaceAt(x, z),
  stand: (x, z, r) => canStand(x, z, r),
  height: (x, z) => heightAt(x, z),
  epoch: (x, z) => cityChunkEpoch(Math.floor(x / CHUNK), Math.floor(z / CHUNK)),
};

export class CityLife {
  readonly group = new THREE.Group();
  crowd: CrowdLayer | null = null;
  traffic: TrafficLayer | null = null;
  net: StreetNet | null = null;
  private opts: CityLifeOptions;
  private offs: (() => void)[] = [];
  private all: RoadVehicle[] = [];
  private others: RoadVehicle[] = [];
  private traveling = false;
  /** the camera is high over the streets (a glide): the crowd hides */
  private high = false;
  private hopAt = -9;
  private clock = 0;
  private qualityAt = -9;
  private disposed = false;

  constructor(opts: CityLifeOptions) {
    this.opts = opts;
    this.group.name = 'city-life';
    this.group.matrixAutoUpdate = false;
    void walkGraph().then(ix => { if (!this.disposed) this.start(new StreetNet(ix, cityProbe)); }).catch(error => {
      if (import.meta.env?.DEV) console.warn('[opus-bay city life] walking graph', error);
    });
    // QA (DEV): window.__opusCityLife.stats() / .life
    if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __opusCityLife?: unknown }).__opusCityLife = { stats: () => this.stats(), life: this };
  }

  /** Build both layers on a street network (tests pass their own). */
  start(net: StreetNet) {
    this.net = net;
    const vis = this.opts.visible;
    // (verify F4) the per-frame lists reuse their records: `spot(i, x, z)` is the i-th of this frame's points
    const avoidPts: { x: number; z: number }[] = [], peoplePts: { x: number; z: number; r: number }[] = [];
    const crowdEnv: CrowdEnv = {
      focus: () => focus(),
      avoid: out => {
        const p = runtime.player, g = runtime.guide;
        let n = 0;
        const put = (x: number, z: number) => { const o = avoidPts[n] ?? (avoidPts[n] = { x: 0, z: 0 }); n++; o.x = x; o.z = z; out.push(o); };
        if (!runtime.vehicle.occupied) put(p.x, p.z);
        put(g.x, g.z);
        // the six city residents stand at their static spots (G2 w3 review 9): walkers step round them too
        for (const r of RESIDENTS) if (Math.abs(r.at.x - p.x) < 100 && Math.abs(r.at.z - p.z) < 100) put(r.at.x, r.at.z);
      },
      visible: vis,
      vehicles: () => this.all,
      standSpots: (x, z, r) => {
        const out: StandSpot[] = [];
        for (const pl of placesNear(x, z, r)) { const k = STAND_KINDS[pl.kind]; if (k && !pl.hero) out.push({ x: pl.x, z: pl.z, r: k }); }
        // lane D2's landmark plaza spots (the setting's paved plazas), facing the landmark
        for (const s of landmarkPlazaSpots()) {
          if (Math.abs(s.x - x) > r || Math.abs(s.z - z) > r) continue;
          const lm = sfLandmark(s.id);
          out.push({ x: s.x, z: s.z, r: 0.6, exact: true, face: lm ? { x: lm.x, z: lm.z } : undefined });
        }
        return out;
      },
      night: () => U.uNight.value,
      onHop: (w, q) => this.hopped(w.x, w.z, q),
      pins: () => crowdPins(),
      waves: () => takeCrowdWaves(),
    };
    const trafficEnv: TrafficEnv = {
      focus: () => focus(),
      visible: vis,
      vehicles: () => this.others,
      people: out => {
        const p = runtime.player, g = runtime.guide;
        let n = 0;
        const put = (x: number, z: number, r: number) => { const o = peoplePts[n] ?? (peoplePts[n] = { x: 0, z: 0, r: 0 }); n++; o.x = x; o.z = z; o.r = r; out.push(o); };
        if (!runtime.vehicle.occupied && surfaceAt(p.x, p.z) === 'road') put(p.x, p.z, 0.45);
        if (surfaceAt(g.x, g.z) === 'road') put(g.x, g.z, 0.4);
        if (this.crowd) for (const w of this.crowd.sim.walkers) if (w.on && (w.onRoad || w.hopT >= 0)) put(w.x, w.z, CROWD.r);
      },
      transitStreet: (x, z, dx, dz) => onTransitStreet(x, z, dx, dz),
      night: () => U.uNight.value,
    };
    this.crowd = new CrowdLayer(net, crowdEnv, CROWD.count.high);
    this.traffic = new TrafficLayer(net, trafficEnv, TRAFFIC.count.high);
    this.group.add(this.crowd.group, this.traffic.group);
    const traffic = this.traffic, crowd = this.crowd;
    const mine = vehiclePool();
    this.offs.push(
      registerRoadVehicles(out => traffic.sim.vehicles(out)),
      registerRoadVehicles(out => {
        const v = runtime.vehicle;
        if (!v.occupied || !v.kind) return;
        const d = v.kind === 'car' ? PLAYER_CAR : PLAYER_BIKE;
        out.push(setVehicle(mine.begin(out).next(), v.x, v.z, v.speed < 0 ? v.heading + Math.PI : v.heading, Math.abs(v.speed), d.halfL, d.halfW, 'player', 'player'));
      }),
      registerObstacleSource((out, x, z, r) => { crowd.sim.obstacles(out, x, z, r); traffic.sim.obstacles(out, x, z, r); }),
      // (W5-T1) the player's wave (lane A's emote wheel plays it through the anim channel's 'emote' event)
      onEvent(e => { if (e.type === 'emote' && e.who === 'player' && e.emote === 'wave') crowdWave(runtime.player.x, runtime.player.z, WAVE_REACH); }),
    );
    this.applyQuality();
  }

  private applyQuality() {
    const q = game.get().settings.quality;
    if (this.crowd) this.crowd.sim.target = CROWD.count[q];
    if (this.traffic) this.traffic.sim.target = TRAFFIC.count[q];
  }

  update(dt: number) {
    const crowd = this.crowd, traffic = this.traffic;
    if (!crowd || !traffic) return;
    this.clock += dt;
    if (this.clock - this.qualityAt > 1) { this.qualityAt = this.clock; this.applyQuality(); }
    // fast travel: nothing moves under the cloud; the crowd and the cars refill round the landing spot
    if (travelActive()) {
      if (!this.traveling) { this.traveling = true; crowd.hide(); traffic.hide(); crowd.sim.reset(); traffic.sim.reset(); clearCityHooks(); }
      takeCrowdWaves();
      return;
    }
    this.traveling = false;
    collectRoadVehicles(this.all);
    this.others.length = 0;
    for (const q of this.all) if (q.kind !== 'traffic') this.others.push(q);
    const cam = U.uCam.value;
    traffic.update(dt, cam);
    // (review) measured from the ground under the player: while gliding the player is up with the pelican, so the camera
    // stayed ~7 u above them and the crowd never hid
    // (10 u of hysteresis: a glide hovering at the line would pop the crowd in and out)
    const p = runtime.player, above = cam.y - heightAt(p.x, p.z);
    const high = this.high = above > CROWD_HIGH || (this.high && above > CROWD_HIGH - 10);
    // (a wave nobody is there to see is dropped, not played later)
    if (high) { crowd.hide(); takeCrowdWaves(); } else crowd.update(dt, cam);
    this.listen(high);
  }

  /** The sound side: the crowd around the listener, the cars that just passed (audio/cityHooks.ts). */
  private listen(high: boolean) {
    const p = runtime.player;
    let n = 0, sx = 0, sz = 0;
    if (!high) for (const w of this.crowd!.sim.walkers) {
      if (!w.on) continue;
      const d = Math.hypot(w.x - p.x, w.z - p.z);
      if (d < 18) { n++; sx += w.x; sz += w.z; }
    }
    cityHooks.crowd.n = n;
    if (n) { cityHooks.crowd.x = sx / n; cityHooks.crowd.z = sz / n; }
    let cars = 0;
    for (const c of this.traffic!.sim.cars) if (c.on && Math.hypot(c.x - p.x, c.z - p.z) < 40) cars++;
    cityHooks.cars = cars;
    const passes = this.traffic!.sim.passes;
    for (const q of passes) pushPass(q);
    passes.length = 0;
  }

  /** A walker hopped out of a vehicle's way: the hop-aside event near the player (a squeak), at most every 5 s. */
  private hopped(x: number, z: number, q: RoadVehicle) {
    const p = runtime.player, d = Math.hypot(x - p.x, z - p.z);
    if (d > HOP_HEARD || this.clock - this.hopAt < 5) return;
    this.hopAt = this.clock;
    // road vehicles that are not transit report as the rubber-tyred kind ('bus'); `line` says which ('traffic' / 'player')
    const kind = q.kind === 'traffic' || q.kind === 'player' ? 'bus' : q.kind;
    emitAt({ type: 'transit', what: 'hop-aside', line: q.line, kind, strength: Math.max(0.2, 1 - d / HOP_HEARD) }, x, z);
  }

  stats() {
    return { crowd: this.crowd?.stats() ?? null, traffic: this.traffic?.stats() ?? null, vehicles: this.all.length };
  }

  dispose() {
    this.disposed = true;
    if (import.meta.env?.DEV && typeof window !== 'undefined') delete (window as unknown as { __opusCityLife?: unknown }).__opusCityLife;
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.crowd?.dispose();
    this.traffic?.dispose();
    clearCityHooks();
  }
}

/** The crowd and the traffic live around the player (the vehicle while driving). One record, rewritten each call (F4). */
const FOCUS = { x: 0, z: 0 };
function focus(): { x: number; z: number } {
  const v = runtime.vehicle;
  FOCUS.x = v.occupied ? v.x : runtime.player.x;
  FOCUS.z = v.occupied ? v.z : runtime.player.z;
  return FOCUS;
}
