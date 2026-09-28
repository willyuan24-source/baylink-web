import { GLIDE, GlideSim, NO_GLIDE_INPUT, terrainGlideWorld, type GlideInput, type GlideWorld } from '../actors/glide';
import { LiveTall } from '../actors/glideTall';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import type { Bilingual, Vec2 } from '../core/types';
import type { ScenicDriver, ScenicShot } from './fastTravel';
import { bubble } from './flow';
import { flow } from './flowStore';
import { BAYBAY_ID } from './interactables';
import { SCENIC_TRIP } from './scenicTrip';

/**
 * Wave 5 · lane N · W5-N9 (plan sf-w5-plan.md §3.2 "A-glide+", §4.5 item 9): 看风景飞过去, the flight. For mid
 * distances the pelican flies the way itself, low over the city with the glide's own camera, instead of the 7 s
 * top-view hop; touch the stick (WASD / the pad) and you fly it, let go and BAYBAY takes it on again; she lands at the
 * destination. Desktop: G lands where you are (the trip runner walks the rest). 跳过 / Esc: the fast hop from here.
 *
 * game/fastTravel.ts runs the trip (pickup, rise, the lock, the cinematic, the streaming, the landing, the events) and
 * hands the sky part to this `ScenicDriver`: a GlideSim (actors/glide.ts — the free glide's flight model: the soft floor
 * over the roofs, the tall structures, the model's edge, the soft boxes) flown by `scenicPilot` or by the player's
 * controls. The trip runner (game/tripRun.ts, this module's only importer) starts one for a scenic fly leg.
 */

export const SCENIC = {
  /** the autopilot's height over the glide's soft floor (roofs / ground + 6), and at least this over the ground (u) */
  above: 14,
  minAboveGround: 30,
  /** within this of the destination the autopilot comes lower and slower (u) */
  approachR: 130,
  /** and starts the landing this close, once the destination is streamed (u) */
  landR: 45,
  /** circling the destination while it streams, at most (s): then it lands anyway (the fast hop's HOLD_MAX_S) */
  holdMaxS: 8,
  /** let go of the controls this long and BAYBAY flies again (s) */
  resumeS: 2.5,
  /** the autopilot gives up (the fast hop from where it is) after this many times the planned flight + 20 s */
  maxFactor: 2.5,
  /** the camera: the glide rig's (actors/cameraModes 'glide': 14 behind, pitch 0.3, 10 ahead, 0.9 up, rate 6) */
  cam: { dist: 14, pitch: 0.3, ahead: 10, lookUp: 0.9, lift: 1.5, rate: 6 },
} as const;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The autopilot's controls for one frame (pure): bank toward the target (the heading error, as the glide's approach in
 * actors/moveSystem), climb or sink toward `wantY`, boost on the long straight parts, slow on the approach.
 */
export function scenicPilot(g: { x: number; y: number; z: number; heading: number }, target: Vec2, wantY: number): GlideInput {
  const d = Math.hypot(target.x - g.x, target.z - g.z);
  const err = d > 0.5 ? wrap(Math.atan2(target.x - g.x, target.z - g.z) - g.heading) : 0;
  return {
    steer: clamp(-err * 1.6, -1, 1),
    pitch: clamp((wantY - g.y) * 0.08, -0.7, 1),
    boost: d > SCENIC.approachR && Math.abs(err) < 0.5,
    slow: d < SCENIC.landR * 1.6,
  };
}

/** Where the autopilot holds the seat (world y, pure): over the roofs, never low over open ground; lower on the approach. */
export function scenicHeight(softFloor: number, ground: number, distLeft: number): number {
  const k = clamp((distLeft - SCENIC.landR) / (SCENIC.approachR - SCENIC.landR), 0, 1);
  const above = 6 + (SCENIC.above - 6) * k, min = 16 + (SCENIC.minAboveGround - 16) * k;
  return Math.max(softFloor + above, ground + min);
}

/** The glide rig's framing of a seat pose (pure): 14 u behind, pitch 0.3, looking 10 u ahead. */
export function chaseShot(x: number, y: number, z: number, heading: number): ScenicShot {
  const c = SCENIC.cam, fx = Math.sin(heading), fz = Math.cos(heading), h = Math.cos(c.pitch) * c.dist;
  return {
    position: [x - fx * h, y + c.lookUp + Math.sin(c.pitch) * c.dist + c.lift, z - fz * h],
    target: [x + fx * c.ahead, y + c.lookUp, z + fz * c.ahead],
  };
}

/** Words under the caption (pure): who flies and how to change it, in the device's words. */
export function scenicHint(manual: boolean, device: string): Bilingual {
  if (manual) return { zh: '松开就由 BAYBAY 接着飞', en: 'Let go and BAYBAY flies on' };
  if (device === 'touch') return { zh: '碰摇杆自己飞', en: 'Touch the stick to steer' };
  if (device === 'gamepad') return { zh: '推摇杆自己飞', en: 'Push the stick to steer' };
  return { zh: '方向键自己飞 · G 就地降落', en: 'Arrow keys to steer · G to land here' };
}

/** What the flight reads each frame (live: the game's input; tests pass their own). */
export interface ScenicControls {
  /** a stick / WASD / pad move is held */
  manual: boolean;
  glide: GlideInput;
  /** G (desktop): land where you are */
  landHere: boolean;
}

export class ScenicFlight implements ScenicDriver {
  readonly sim = new GlideSim();
  /** the player is flying (since their last move, until resumeS after letting go) */
  manual = false;
  /** the player took the controls at least once (BAYBAY says so once) */
  tookOver = false;
  private idle = 0;
  private near = 0;
  private flown = 0;
  private d0 = 0;
  private readonly world: GlideWorld;
  private readonly controls: () => ScenicControls;
  private readonly device: () => string;
  private cam: { x: number; y: number; z: number; lx: number; ly: number; lz: number } | null = null;
  private hint = '';
  private seenGlide = input.glideCount;

  readonly dest: Vec2;

  constructor(dest: Vec2, opts: { world?: GlideWorld; controls?: () => ScenicControls; device?: () => string } = {}) {
    this.dest = { x: dest.x, z: dest.z };
    this.world = opts.world ?? (() => { const tall = new LiveTall(); return terrainGlideWorld(() => tall.get()); })();
    this.controls = opts.controls ?? (() => this.liveControls());
    this.device = opts.device ?? (() => runtime.input.device);
  }

  get x() { return this.sim.x; }
  get z() { return this.sim.z; }
  /** TravelPose y: the seat − the perch (the fast hop's path convention) */
  get y() { return this.sim.y - GLIDE.perch; }
  get heading() { return this.sim.heading; }
  /** 0..1: how much of the way is flown */
  get progress() { return this.d0 > 1 ? clamp(1 - this.distLeft() / this.d0, 0, 1) : 1; }
  distLeft() { return Math.hypot(this.dest.x - this.sim.x, this.dest.z - this.sim.z); }

  private liveControls(): ScenicControls {
    const landHere = input.glideCount !== this.seenGlide;
    this.seenGlide = input.glideCount;
    return {
      manual: input.manualMove,
      landHere,
      glide: { pitch: runtime.input.moveY, steer: runtime.input.moveX, boost: runtime.input.run || input.throttle > 0.5, slow: input.jumpHeld || input.brake > 0.5 },
    };
  }

  begin(x: number, y: number, z: number, heading: number) {
    const g = this.sim;
    g.x = x; g.y = y + GLIDE.perch; g.z = z; g.heading = heading;
    g.pitch = 0; g.roll = 0; g.speed = GLIDE.cruise; g.vy = 0; g.stage = 'flight';
    this.d0 = this.distLeft();
    this.seenGlide = input.glideCount;
    this.updateHint();
  }

  step(dt: number, ready: boolean): 'fly' | 'land' | 'here' | 'skip' {
    const c = this.controls();
    const g = this.sim;
    if (c.landHere) return 'here';
    if (c.manual) {
      if (!this.tookOver) bubble({ zh: '你来飞！松开我就接着带路～', en: 'You fly! Let go and I take over again' }, 3000, BAYBAY_ID, 'call');
      this.manual = true; this.tookOver = true; this.idle = 0;
    } else if (this.manual && (this.idle += dt) >= SCENIC.resumeS) this.manual = false;
    const left = this.distLeft();
    let inp: GlideInput;
    if (c.manual) inp = c.glide;
    else if (this.manual) inp = NO_GLIDE_INPUT;
    else {
      const f = g.floorAt(this.world, g.x, g.z);
      inp = scenicPilot(g, this.dest, scenicHeight(f.soft, this.world.heightAt(g.x, g.z), left));
    }
    g.step(dt, inp, this.world);
    this.updateHint();
    if (this.manual) return 'fly';
    this.flown += dt;
    if (left < SCENIC.landR) {
      if (ready) return 'land';
      if ((this.near += dt) >= SCENIC.holdMaxS) return 'land';
    }
    // a destination the autopilot cannot reach (a soft box round it): the fast hop from here
    if (this.flown > (this.d0 / SCENIC_TRIP.speed) * SCENIC.maxFactor + 20) return 'skip';
    return 'fly';
  }

  /** Where the city streams: a little ahead of the pelican (the fast hop pins the destination instead). */
  focus(): Vec2 {
    const f = Math.min(60, this.sim.speed * 3);
    return { x: this.sim.x + Math.sin(this.sim.heading) * f, z: this.sim.z + Math.cos(this.sim.heading) * f };
  }

  chaseAt(x: number, y: number, z: number, heading: number): ScenicShot { return chaseShot(x, y + GLIDE.perch, z, heading); }

  /** The camera this frame: carried by the pelican's move, eased toward the rig's spot (no lag with speed). */
  shot(dt: number): ScenicShot {
    const g = this.sim, want = chaseShot(g.x, g.y, g.z, g.heading);
    let c = this.cam;
    if (!c) c = this.cam = { x: want.position[0], y: want.position[1], z: want.position[2], lx: g.x, ly: g.y, lz: g.z };
    else {
      c.x += g.x - c.lx; c.y += g.y - c.ly; c.z += g.z - c.lz;
      const k = 1 - Math.exp(-SCENIC.cam.rate * Math.max(0, dt));
      c.x += (want.position[0] - c.x) * k; c.y += (want.position[1] - c.y) * k; c.z += (want.position[2] - c.z) * k;
      c.lx = g.x; c.ly = g.y; c.lz = g.z;
    }
    return { position: [c.x, c.y, c.z], target: want.target };
  }

  /** The words under the caption follow who flies (set only when they change). */
  private updateHint() {
    const h = scenicHint(this.manual, this.device());
    if (h.zh === this.hint) return;
    this.hint = h.zh;
    flow.set({ captionSub: h });
  }

  end() {
    if (this.hint) flow.set({ captionSub: null });
    this.hint = '';
  }
}
