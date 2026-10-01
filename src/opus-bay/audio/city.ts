import type { SurfaceKind, Vec2 } from '../core/types';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { cityTerrain, isLand, surfaceAt } from '../core/terrain';
import { activeFerrySystem, rideSystemFor, transitData } from '../data/transit';
import { cityHooks } from './cityHooks';
import type { AudioEngine } from './engine';
import {
  CITY_SHORE, type ShoreField, buskerLevel, cableHumLevel, clamp, distToFlatPolyline, pacificSide, panFor, parkShare, proximity,
  rand, shoreGridJob, shoreRebuildDue, shoreWindow, smoothstep,
} from './logic';
import * as sfx from './sfx';
import { runSliced, type Sliced } from './slices';
import { BUSKER_SPOTS, StreetMusic } from './street';

/**
 * The city's soundscape (lane F10), run by the ambience (audio/ambience.ts) in city mode only:
 *
 * - **CityShore**: the shore distance field for the whole city, windowed ±256 u round the listener in 4 u cells from
 *   the streamed terrain's land test (core/terrain isLand: resident chunks, else the far map; piers and open water are
 *   water), built in idle slices and built again after 96 u of movement. The Bay's waves, the splashes and the buoy
 *   follow it exactly as the district's.
 * - **Ocean Beach surf**: on the Pacific side of the Golden Gate (Baker Beach, Lands End, Ocean Beach) a deep swelling
 *   surf bed and breakers (sfx.surfCrash) toward the water.
 * - **Park birds** by day (sparrows, finches, doves) and crickets at night, where the ground round the listener is park
 *   (grass, woodland).
 * - **A Mission street-music hint**: buskers (audio/street.ts) at a few Mission spots.
 * - **Cable hum**: the cable running under the slot of the three cable-car lines — a low whirr and the sheaves' clack,
 *   within 16 u of the track.
 * - **The ferry's engine**: a diesel chug and the wash, aboard or near the rideable ferry.
 * - **The foghorn** from the real Golden Gate (quieter far away), the crowd murmur from the walkers round the listener
 *   and the toy cars that pass close by (audio/cityHooks.ts), all through the ambience.
 */

/** the Golden Gate strait: Fort Point (world) and the direction along the bridge toward Marin */
export const GOLDEN_GATE = { x: -750.43, z: 595.06, dx: -0.8001, dz: -0.5999, mid: { x: -865.81, z: 508.55 } } as const;

/** Signed distance of (x, z) from the Golden Gate Bridge line: negative on the Pacific side. */
export function gateSide(x: number, z: number): number {
  const g = GOLDEN_GATE;
  return g.dx * (z - g.z) - g.dz * (x - g.x);
}

/** 1 on the Pacific side of the Golden Gate, 0 in the Bay (smooth across the strait). */
export const pacific = (x: number, z: number) => pacificSide(gateSide(x, z));

/** Builds and swaps the windowed city shore field (idle slices). */
export class CityShore {
  field: ShoreField | null = null;
  private centre: Vec2 | null = null;
  private job: Sliced<ShoreField> | null = null;
  private onField: (f: ShoreField) => void;

  constructor(onField: (f: ShoreField) => void) { this.onField = onField; }

  update(x: number, z: number) {
    if (this.job || !cityTerrain() || !shoreRebuildDue(this.centre, x, z)) return;
    const at = { x, z };
    this.job = runSliced(shoreGridJob({ bounds: shoreWindow(x, z), cell: CITY_SHORE.cell, isLand }));
    this.job.done.then(f => { this.field = f; this.centre = at; this.job = null; this.onField(f); }, () => { this.job = null; });
  }

  dispose() { this.job?.cancel(); this.job = null; }
}

export class CityLayers {
  private readonly e: AudioEngine;
  private readonly loops: AudioScheduledSourceNode[] = [];
  private readonly surf: { gain: GainNode; filter: BiquadFilterNode; tilt: StereoPannerNode; next: number };
  private readonly hum: { gain: GainNode; tone: GainNode };
  private readonly engine: { gain: GainNode; chug: OscillatorNode; wash: GainNode; pan: StereoPannerNode };
  private readonly music: StreetMusic;
  private readonly timers = { crash: 0, bird: 0, cricket: 0, sheave: 0, park: 0 };
  private park = 0;
  private ferryPrev: { x: number; z: number; t: number } | null = null;
  /** (wave 8, lane A) the ferry system the engine last followed (a switch to another boat restarts its speed estimate) */
  private ferrySysPrev: unknown = null;
  private ferrySpeed = 0;
  private cableBoxes: { pts: Float32Array; x0: number; z0: number; x1: number; z1: number }[] | null = null;
  private readonly ring: (SurfaceKind | null)[] = [];

  constructor(e: AudioEngine, out: AudioNode) {
    this.e = e;
    const ctx = e.ctx;

    // --- Pacific surf: a deep, slow swell (brown + pink), panned toward the water
    {
      const gain = ctx.createGain(); gain.gain.value = 0;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 380; filter.Q.value = 0.5;
      const tilt = ctx.createStereoPanner();
      const deep = e.loopNoise('brown', 0.8), body = e.loopNoise('pink', 0.92);
      const bodyGain = ctx.createGain(); bodyGain.gain.value = 0.35;
      deep.connect(filter); body.connect(bodyGain).connect(filter);
      filter.connect(gain).connect(tilt).connect(out);
      this.loops.push(deep, body);
      this.surf = { gain, filter, tilt, next: 0 };
    }

    // --- the cable under the street: a low whirr and a faint 58 Hz from the winding machinery
    {
      const gain = ctx.createGain(); gain.gain.value = 0;
      const src = e.loopNoise('brown', 0.6);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150; lp.Q.value = 0.8;
      src.connect(lp).connect(gain);
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 58;
      const tone = ctx.createGain(); tone.gain.value = 0.12;
      osc.connect(tone).connect(gain);
      osc.start();
      gain.connect(out);
      this.loops.push(src, osc);
      this.hum = { gain, tone };
    }

    // --- the ferry's diesel: a sawtooth chug (amplitude-modulated at ~9 Hz) and the wash along the hull
    {
      const gain = ctx.createGain(); gain.gain.value = 0;
      const pan = ctx.createStereoPanner();
      const chug = ctx.createOscillator(); chug.type = 'sawtooth'; chug.frequency.value = 44;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 190; lp.Q.value = 1.2;
      const am = ctx.createGain(); am.gain.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 8.8;
      const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.35;
      lfo.connect(lfoDepth).connect(am.gain);
      chug.connect(lp).connect(am).connect(gain);
      const washSrc = e.loopNoise('pink', 1.05);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.7;
      const wash = ctx.createGain(); wash.gain.value = 0;
      washSrc.connect(bp).connect(wash).connect(gain);
      chug.start(); lfo.start();
      gain.connect(pan).connect(out);
      this.loops.push(chug, lfo, washSrc);
      this.engine = { gain, chug, wash, pan };
    }

    this.music = new StreetMusic(e);
    const now = ctx.currentTime;
    this.timers.crash = now + 2; this.timers.bird = now + rand(Math.random, 1, 3); this.timers.cricket = now + 1; this.timers.sheave = now + 1;
  }

  private set(param: AudioParam, value: number, tau = 0.5) { param.setTargetAtTime(value, this.e.now, tau); }

  /** Distance to the nearest cable-car track (transit.json lines), with a bounding-box reject per line. */
  private cableDistance(x: number, z: number): number {
    if (!this.cableBoxes) {
      const data = transitData();
      if (!data) return Infinity;
      this.cableBoxes = data.lines.map(l => {
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (let i = 0; i < l.xyz.length; i += 3) { x0 = Math.min(x0, l.xyz[i]); x1 = Math.max(x1, l.xyz[i]); z0 = Math.min(z0, l.xyz[i + 2]); z1 = Math.max(z1, l.xyz[i + 2]); }
        return { pts: l.xyz, x0, z0, x1, z1 };
      });
    }
    let best = Infinity;
    for (const b of this.cableBoxes) {
      if (x < b.x0 - 20 || x > b.x1 + 20 || z < b.z0 - 20 || z > b.z1 + 20) continue;
      best = Math.min(best, distToFlatPolyline(x, z, b.pts, 3));
    }
    return best;
  }

  /**
   * One ambience tick (10 Hz). `L` = the listener (the player, the camera's yaw), `shoreD` / `waterDir` from the shore
   * field, `night` 0 / 1, `high` = how far up (0 at street level, 1 at a glide's height).
   */
  update(dt: number, L: { x: number; z: number; y: number; yaw: number }, shoreD: number, waterDir: Vec2, timeOfDay: string) {
    const e = this.e, now = e.now, R = Math.random;
    const night = timeOfDay === 'night';
    // gliding high over the city: the street-level layers fade out
    const high = runtime.glide.active ? smoothstep(10, 40, runtime.glide.height) : 0;

    // --- Pacific surf
    const ocean = pacific(L.x, L.z) * proximity(shoreD, 3, 110);
    const toWater = waterDir.x !== 0 || waterDir.z !== 0 ? panFor(L, L.yaw, { x: L.x + waterDir.x * 20, z: L.z + waterDir.z * 20 }, 0.7) : 0;
    this.set(this.surf.tilt.pan, toWater, 0.6);
    if (now > this.surf.next) {
      // a swell every 7–11 s: the bed rises toward the crest, a breaker crashes on it
      const rise = rand(R, 2.5, 4), fall = rand(R, 3.5, 6);
      this.surf.gain.gain.setTargetAtTime(0.5 * ocean, now, rise / 3);
      this.surf.gain.gain.setTargetAtTime(0.18 * ocean, now + rise, fall / 3);
      this.surf.filter.frequency.setTargetAtTime(rand(R, 700, 1100), now, rise / 3);
      this.surf.filter.frequency.setTargetAtTime(rand(R, 260, 380), now + rise, fall / 3);
      if (ocean > 0.05) sfx.surfCrash(e, clamp(toWater + rand(R, -0.2, 0.2), -0.8, 0.8), 0.28 * ocean);
      this.surf.next = now + rise + fall * rand(R, 0.7, 0.95);
    }

    // --- parks: birds by day, crickets at night (a ring of ground samples once a second)
    if (now > this.timers.park) {
      this.timers.park = now + 1;
      this.ring.length = 0;
      for (const r of [5, 12]) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; this.ring.push(surfaceAt(L.x + Math.cos(a) * r, L.z + Math.sin(a) * r)); }
      this.park = parkShare(this.ring) * (1 - high);
    }
    if (!night && now > this.timers.bird) {
      if (this.park > 0.2) sfx.birdCall(e, rand(R, -0.8, 0.8), (0.05 + 0.1 * this.park) * rand(R, 0.6, 1));
      this.timers.bird = now + rand(R, 1.2, 4.5) / Math.max(0.3, this.park) * (timeOfDay === 'morning' ? 0.7 : 1);
    }
    if (night && now > this.timers.cricket) {
      if (this.park > 0.25) sfx.cricket(e, rand(R, -0.7, 0.7), 0.04 + 0.05 * this.park);
      this.timers.cricket = now + rand(R, 0.4, 1.4) / Math.max(0.3, this.park);
    }

    // --- the cable under the slot
    const cable = cableHumLevel(this.cableDistance(L.x, L.z)) * (1 - high);
    this.last.cable = +cable.toFixed(2);
    this.last.ocean = +ocean.toFixed(2);
    this.set(this.hum.gain.gain, 0.3 * cable, 0.4);
    if (now > this.timers.sheave) {
      if (cable > 0.25) sheaveClack(e, 0.08 * cable);
      this.timers.sheave = now + rand(R, 1.1, 1.7);
    }

    // --- the ferry's engine: aboard, or near the boat
    // (wave 8, lane A, surgical) aboard another ferry line (the Alcatraz boat): its engine, not the Ferry Building boat's
    const mv = game.get().move, own = mv.mode === 'transit' && mv.line?.startsWith('ferry') && mv.line !== 'ferry' ? rideSystemFor(mv.line) : null;
    const ferrySys = own ?? activeFerrySystem();
    if (ferrySys !== this.ferrySysPrev) { this.ferrySysPrev = ferrySys; this.ferryPrev = null; }
    const ferry = ferrySys?.cars[0]?.pose ?? null;
    if (ferry) {
      if (this.ferryPrev && dt > 0) {
        const v = Math.hypot(ferry.x - this.ferryPrev.x, ferry.z - this.ferryPrev.z) / Math.max(1e-3, now - this.ferryPrev.t);
        this.ferrySpeed += (clamp(v, 0, 15) - this.ferrySpeed) * 0.3;
      }
      this.ferryPrev = { x: ferry.x, z: ferry.z, t: now };
      // aboard once the boat carries you (review: the ride's move mode is 'transit' from the moment you start waiting on
      // the quay, which played the engine centred at full level with the boat 385 u away at the other terminal)
      const move = game.get().move, phase = ferrySys?.rideStatus()?.phase;
      const aboard = move.mode === 'transit' && !!move.line?.startsWith('ferry') && (phase === 'riding' || phase === 'arrived');
      const d = Math.hypot(ferry.x - L.x, ferry.z - L.z);
      const engine = aboard ? 1 : proximity(d, 8, 60);
      this.last.engine = +engine.toFixed(2);
      const enginePan = aboard ? 0 : panFor(L, L.yaw, ferry, 0.7);
      const running = smoothstep(0.5, 6, this.ferrySpeed);
      this.set(this.engine.gain.gain, engine * (aboard ? 0.34 : 0.26) * (0.45 + 0.55 * running), 0.5);
      this.set(this.engine.wash.gain, 0.7 * running, 0.6);
      this.set(this.engine.chug.frequency, 40 + 8 * running, 0.8);
      this.set(this.engine.pan.pan, enginePan, 0.3);
    } else this.set(this.engine.gain.gain, 0, 0.5);

    // --- the Mission's buskers
    let busk = 0, buskPan = 0;
    for (const s of BUSKER_SPOTS) {
      const k = buskerLevel(Math.hypot(s.x - L.x, s.z - L.z));
      if (k > busk) { busk = k; buskPan = panFor(L, L.yaw, s, 0.7); }
    }
    this.last.busk = +busk.toFixed(2);
    this.music.update(busk * (night ? 0.6 : 1) * (1 - high), buskPan);
  }

  /** QA: the last levels the layers were driven with. */
  debug() { return { park: +this.park.toFixed(2), ...this.last }; }
  private last = { ocean: 0, cable: 0, engine: 0, busk: 0 };

  /** The crowd murmur level and where it is (the ambience's crowd layer). */
  crowd(L: Vec2): { level: number; at: Vec2 | null } {
    const c = cityHooks.crowd;
    if (!c.n) return { level: 0, at: null };
    return { level: clamp(c.n / 10) * proximity(Math.hypot(c.x - L.x, c.z - L.z), 3, 30), at: { x: c.x, z: c.z } };
  }

  dispose() {
    for (const s of this.loops) { try { s.stop(); } catch { /* ignore */ } }
    for (const g of [this.surf.gain, this.hum.gain, this.engine.gain]) { try { g.disconnect(); } catch { /* ignore */ } }
  }
}

/** The sheaves under the slot: a soft double clack as the cable runs over a pulley. */
function sheaveClack(e: AudioEngine, gain: number) {
  const v = e.voice({ bus: 'ambience', dur: 0.3, gain, priority: 0, name: 'sheave' });
  if (!v) return;
  for (const off of [0, 0.11]) {
    e.noiseBurst(v, { color: 'brown', attack: 0.002, decay: 0.05, peak: 0.6, offset: off, filter: { type: 'bandpass', freq: 380, Q: 1.4 } });
    e.tone(v, { type: 'sine', freq: 82, decay: 0.08, peak: 0.4, offset: off });
  }
}

