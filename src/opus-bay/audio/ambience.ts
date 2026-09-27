/**
 * Living soundscape: persistent looping layers (waves, wind, city, crowd, streetcar) whose levels
 * follow the player through the district, plus a light scheduler for ambient one-shots
 * (gulls, sea lions, pier splashes, bell buoy, passing cars, foghorn in the morning / golden hour).
 * Runs at ~10 Hz off the audio clock; never touches React state.
 */
import type { District, Vec2 } from '../core/types';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { AudioEngine } from './engine';
import {
  buildShoreField, clamp, distToPolyline, isMarketDay, panFor, proximity, rand, smoothstep, type ShoreField,
} from './logic';
import * as sfx from './sfx';

const R = Math.random;

export interface WorldInfo {
  shore: ShoreField | null;
  seaLions: Vec2 | null;
  crowds: { at: Vec2; weight: number; market?: boolean }[];
  roads: Vec2[][];
}

/** Derive audio landmarks from the district data (tolerant of missing anchors). */
export function describeWorld(d: District, withShore: boolean): WorldInfo {
  const anchor = (name: string) => d.anchors?.[name] ?? null;
  const landmark = (kind: string) => d.landmarks?.find(l => l.kind === kind)?.position ?? null;
  let seaLions = landmark('sea-lion-docks');
  if (!seaLions) {
    const view = anchor('sea-lion-viewpoint');
    if (view) seaLions = { x: view.x, z: view.z - 8 };
  }
  const crowds: WorldInfo['crowds'] = [];
  const add = (at: Vec2 | null, weight: number, market = false) => { if (at) crowds.push({ at, weight, market }); };
  add(anchor('pier39-entrance') ?? landmark('pier39'), 1);
  add(anchor('pier39-carousel') ?? landmark('pier39-carousel'), 0.9);
  add(anchor('farmers-market') ?? landmark('farmers-market'), 0.85, true);
  add(anchor('ferry-clock'), 0.45);
  add(anchor('exploratorium-front'), 0.35);
  let shore: ShoreField | null = null;
  if (withShore && d.slab?.length >= 3) {
    try {
      shore = buildShoreField({
        slab: d.slab, walk: d.walk ?? [], piers: d.piers ?? [], hills: d.hills ?? [], roads: d.roads ?? [],
        ramps: d.ramps ?? [], blocks: d.blocks ?? [], landmarks: d.landmarks ?? [],
      }, 4);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[opus-audio] shore field failed', error);
    }
  }
  return { shore, seaLions, crowds, roads: (d.roads ?? []).filter(r => r.kind === 'roadway').map(r => r.points) };
}

interface WaveSide { gain: GainNode; filter: BiquadFilterNode; tilt: GainNode; next: number }

export class Ambience {
  private readonly e: AudioEngine;
  private world: WorldInfo;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly out: GainNode;
  private readonly wavesLevel: GainNode;
  private readonly sides: WaveSide[] = [];
  private readonly wind: { gain: GainNode; filter: BiquadFilterNode; gust: number; nextGust: number };
  private readonly city: GainNode;
  private readonly crowd: { gain: GainNode; pan: StereoPannerNode; f1: BiquadFilterNode; f2: BiquadFilterNode };
  private readonly tram: { gain: GainNode; whine: OscillatorNode; whineGain: GainNode };
  private readonly timers: Record<string, number> = {};
  private last: Record<string, number> = {};
  private tramPrev: { x: number; z: number; t: number } | null = null;
  private tramSpeed = 0;
  private clackAcc = 0;
  private marketDay = isMarketDay(new Date());

  constructor(e: AudioEngine, world: WorldInfo) {
    this.e = e;
    this.world = world;
    const ctx = e.ctx;
    this.out = ctx.createGain();
    // keep the bed out of the sub-bass: small speakers can't play it and headphones find it oppressive
    const hp1 = ctx.createBiquadFilter(), hp2 = ctx.createBiquadFilter();
    for (const hp of [hp1, hp2]) { hp.type = 'highpass'; hp.frequency.value = 95; hp.Q.value = 0.7; }
    this.out.connect(hp1).connect(hp2).connect(e.buses.ambience.input);

    // --- waves: two independent swelling noise beds panned L/R, tilted towards the water
    this.wavesLevel = ctx.createGain();
    this.wavesLevel.gain.value = 0.3;
    this.wavesLevel.connect(this.out);
    for (const side of [-1, 1]) {
      const src = e.loopNoise('pink', side < 0 ? 0.97 : 1.03);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 500; filter.Q.value = 0.4;
      const gain = ctx.createGain(); gain.gain.value = 0.3;
      const tilt = ctx.createGain(); tilt.gain.value = 1;
      const pan = ctx.createStereoPanner(); pan.pan.value = side * 0.6;
      src.connect(filter).connect(gain).connect(tilt).connect(pan).connect(this.wavesLevel);
      this.sources.push(src);
      this.sides.push({ gain, filter, tilt, next: ctx.currentTime + R() * 2 });
    }
    // deep surf bed under the swells
    const bed = e.loopNoise('brown');
    const bedFilter = ctx.createBiquadFilter(); bedFilter.type = 'lowpass'; bedFilter.frequency.value = 420;
    const bedGain = ctx.createGain(); bedGain.gain.value = 0.1;
    bed.connect(bedFilter).connect(bedGain).connect(this.wavesLevel);
    this.sources.push(bed);

    // --- wind
    {
      const src = e.loopNoise('white', 0.5);
      const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 420; filter.Q.value = 0.9;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.out);
      this.sources.push(src);
      this.wind = { gain, filter, gust: 1, nextGust: ctx.currentTime + 3 };
    }

    // --- distant city hum (rumble + traffic wash)
    {
      this.city = ctx.createGain(); this.city.gain.value = 0;
      this.city.connect(this.out);
      const rumble = e.loopNoise('brown', 0.8);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
      const rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0.3;
      rumble.connect(lp).connect(rumbleGain).connect(this.city);
      const wash = e.loopNoise('pink', 0.9);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.55;
      const washGain = ctx.createGain(); washGain.gain.value = 0.9;
      wash.connect(bp).connect(washGain).connect(this.city);
      this.sources.push(rumble, wash);
    }

    // --- crowd murmur (formant-filtered pink noise, drifting)
    {
      const src = e.loopNoise('pink', 1.1);
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 520; f1.Q.value = 1.4;
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1450; f2.Q.value = 1.8;
      const g2 = ctx.createGain(); g2.gain.value = 0.55;
      const gain = ctx.createGain(); gain.gain.value = 0;
      const pan = ctx.createStereoPanner();
      src.connect(f1).connect(gain);
      src.connect(f2).connect(g2).connect(gain);
      gain.connect(pan).connect(this.out);
      this.sources.push(src);
      this.crowd = { gain, pan, f1, f2 };
    }

    // --- streetcar rolling rumble + traction-motor whine
    {
      const gain = ctx.createGain(); gain.gain.value = 0;
      gain.connect(this.out);
      const src = e.loopNoise('brown', 0.7);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150;
      src.connect(lp).connect(gain);
      const whine = ctx.createOscillator();
      whine.type = 'sawtooth'; whine.frequency.value = 90;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 4;
      const whineGain = ctx.createGain(); whineGain.gain.value = 0;
      whine.connect(bp).connect(whineGain).connect(gain);
      whine.start();
      this.sources.push(src, whine);
      this.tram = { gain, whine, whineGain };
    }

    const now = ctx.currentTime;
    this.timers.gull = now + rand(R, 1.2, 3);
    this.timers.seaLion = now + rand(R, 2, 5);
    this.timers.splash = now + 1;
    this.timers.buoy = now + rand(R, 12, 25);
    this.timers.car = now + rand(R, 3, 8);
    this.timers.chatter = now + 1;
    this.timers.foghorn = now + rand(R, 7, 12);
    this.timers.market = now + 60;
  }

  setWorld(world: WorldInfo) { this.world = world; }

  private set(param: AudioParam, value: number, tau = 0.35, key?: string) {
    if (key) {
      const prev = this.last[key];
      if (prev !== undefined && Math.abs(prev - value) < 0.004) return;
      this.last[key] = value;
    }
    param.setTargetAtTime(value, this.e.now, tau);
  }

  private listener() {
    const p = runtime.player;
    return { x: p.x, z: p.z, y: p.y, yaw: runtime.camera.yaw };
  }

  /** Shore distance (0 on water / piers) including height above the water. */
  private shoreDistance(x: number, z: number, y: number) {
    const flat = this.world.shore ? this.world.shore.distanceAt(x, z) : 12;
    return Math.hypot(flat, Math.max(0, y - 2) * 1.4);
  }

  update(dt: number) {
    const e = this.e;
    const now = e.now;
    const L = this.listener();
    const { timeOfDay, riding } = game.get();
    const night = timeOfDay === 'night';
    const shoreD = this.shoreDistance(L.x, L.z, L.y);
    const waterNear = proximity(shoreD, 1.5, 55);

    // --- waves
    this.set(this.wavesLevel.gain, 0.12 + 0.78 * waterNear, 0.6, 'waves');
    let tiltPan = 0;
    if (this.world.shore) {
      const dir = this.world.shore.waterDirAt(L.x, L.z);
      if (dir.x !== 0 || dir.z !== 0) tiltPan = panFor(L, L.yaw, { x: L.x + dir.x * 20, z: L.z + dir.z * 20 }, 1);
    }
    this.set(this.sides[0].tilt.gain, 1 - 0.55 * Math.max(0, tiltPan), 0.5, 'tiltL');
    this.set(this.sides[1].tilt.gain, 1 - 0.55 * Math.max(0, -tiltPan), 0.5, 'tiltR');
    for (const side of this.sides) {
      if (now < side.next) continue;
      const rise = rand(R, 1.6, 3.4), fall = rand(R, 3, 5.5);
      const crest = rand(R, 0.6, 1), trough = rand(R, 0.08, 0.2);
      side.gain.gain.setTargetAtTime(crest, now, rise / 3);
      side.gain.gain.setTargetAtTime(trough, now + rise, fall / 3);
      side.filter.frequency.setTargetAtTime(rand(R, 2200, 4200), now, rise / 3);
      side.filter.frequency.setTargetAtTime(rand(R, 300, 460), now + rise, fall / 3);
      side.next = now + rise + fall * rand(R, 0.6, 0.95);
    }

    // --- wind: stronger up Telegraph Hill and out on the piers
    if (now > this.wind.nextGust) {
      this.wind.gust = rand(R, 0.8, 1.8);
      this.wind.nextGust = now + rand(R, 3.5, 9);
      this.wind.filter.frequency.setTargetAtTime(rand(R, 320, 380) * this.wind.gust * (1 + smoothstep(4, 22, L.y) * 0.7), now, 1.2);
    }
    const windLevel = (0.03 + 0.34 * smoothstep(3, 20, L.y) + 0.05 * proximity(shoreD, 0, 3)) * this.wind.gust;
    this.set(this.wind.gain.gain, windLevel * 0.55, 0.9, 'wind');

    // --- city hum: inland + near the roadway
    let roadD = Infinity;
    for (const road of this.world.roads) roadD = Math.min(roadD, distToPolyline(L.x, L.z, road));
    const roadNear = proximity(roadD, 4, 34);
    const cityLevel = (0.05 + 0.14 * smoothstep(6, 60, shoreD) + 0.12 * roadNear) * (night ? 0.7 : 1) * (1 - 0.5 * smoothstep(8, 22, L.y));
    this.set(this.city.gain, cityLevel, 0.8, 'city');

    // --- crowd murmur
    const crowdTime = timeOfDay === 'night' ? 0.3 : timeOfDay === 'morning' ? 0.55 : 1;
    let crowd = 0;
    let crowdAt: Vec2 | null = null;
    for (const c of this.world.crowds) {
      const w = c.weight * (c.market ? (this.marketDay ? 1 : 0.3) : 1);
      const level = proximity(Math.hypot(L.x - c.at.x, L.z - c.at.z), 6, 48) * w;
      if (level > crowd) { crowd = level; crowdAt = c.at; }
    }
    crowd *= crowdTime;
    this.set(this.crowd.gain.gain, crowd * 0.22, 0.7, 'crowd');
    if (crowdAt) this.set(this.crowd.pan.pan, panFor(L, L.yaw, crowdAt, 0.6), 0.4, 'crowdPan');
    if (R() < dt * 0.5) {
      this.crowd.f1.frequency.setTargetAtTime(rand(R, 420, 640), now, 0.6);
      this.crowd.f2.frequency.setTargetAtTime(rand(R, 1200, 1800), now, 0.6);
    }

    // --- streetcar
    const sc = runtime.streetcar;
    if (this.tramPrev && dt > 0) {
      const v = Math.hypot(sc.x - this.tramPrev.x, sc.z - this.tramPrev.z) / Math.max(1e-3, now - this.tramPrev.t);
      this.tramSpeed += (clamp(v, 0, 30) - this.tramSpeed) * 0.3;
    }
    this.tramPrev = { x: sc.x, z: sc.z, t: now };
    const onboard = riding === 'streetcar';
    const tramD = Math.hypot(L.x - sc.x, L.z - sc.z);
    const moving = smoothstep(0.3, 6, this.tramSpeed);
    const tramNear = onboard ? 1 : proximity(tramD, 3, 50);
    this.set(this.tram.gain.gain, tramNear * (0.42 * moving + (onboard ? 0.06 : 0)) * (onboard ? 1.1 : 0.8), 0.4, 'tram');
    this.set(this.tram.whineGain.gain, 0.05 * moving, 0.5, 'whine');
    this.set(this.tram.whine.frequency, 70 + this.tramSpeed * 16, 0.5, 'whineF');
    if (tramNear > 0.05 && this.tramSpeed > 1.5) {
      this.clackAcc += (this.tramSpeed * dt) / 6.5;
      if (this.clackAcc >= 1) { this.clackAcc = 0; sfx.railClack(e, 0.2 * tramNear); }
    }

    // --- one-shots
    const T = this.timers;
    if (now > T.gull) {
      const rate = timeOfDay === 'night' ? 0.25 : timeOfDay === 'golden' ? 0.8 : 1;
      if (R() < rate) sfx.gull(e, rand(R, -0.85, 0.85), (0.1 + 0.16 * waterNear) * rand(R, 0.6, 1));
      T.gull = now + rand(R, 5, 13) * (1 + (1 - waterNear) * 1.5);
    }
    if (this.world.seaLions && now > T.seaLion) {
      const d = Math.hypot(L.x - this.world.seaLions.x, L.z - this.world.seaLions.z);
      const near = proximity(d, 8, 95);
      if (near > 0.02) {
        sfx.seaLionBark(e, panFor(L, L.yaw, this.world.seaLions), 0.08 + 0.5 * near, 1 + Math.floor(R() * (1 + near * 3)));
        T.seaLion = now + rand(R, 2, 6) / (0.35 + near);
      } else T.seaLion = now + 4;
    }
    if (now > T.splash) {
      const near = proximity(shoreD, 0, 6);
      if (near > 0.05) sfx.splash(e, rand(R, -0.7, 0.7), 0.1 + 0.14 * near);
      T.splash = now + rand(R, 0.7, 2.2);
    }
    if (now > T.buoy) {
      if ((night || timeOfDay === 'morning') && waterNear > 0.15) {
        sfx.bellBuoy(e, clamp(tiltPan, -0.8, 0.8), 0.045 * waterNear + 0.02);
      }
      T.buoy = now + rand(R, 16, 38);
    }
    if (now > T.car) {
      if (roadNear > 0.05) sfx.carPass(e, 0.1 * roadNear * (night ? 0.6 : 1), R() < 0.5 ? 1 : -1);
      T.car = now + rand(R, 4, 11) * (night ? 2 : 1);
    }
    if (now > T.chatter) {
      if (crowd > 0.35) sfx.chatter(e, crowdAt ? panFor(L, L.yaw, crowdAt, 0.7) + rand(R, -0.25, 0.25) : 0, 0.05 * crowd);
      T.chatter = now + rand(R, 0.25, 0.8) / Math.max(0.35, crowd);
    }
    if (now > T.foghorn) {
      if (timeOfDay === 'morning' || timeOfDay === 'golden') this.foghorn();
      T.foghorn = now + rand(R, 55, 110);
    }
    if (now > T.market) { this.marketDay = isMarketDay(new Date()); T.market = now + 300; }
  }

  foghorn() {
    const L = this.listener();
    this.timers.foghorn = Math.max(this.timers.foghorn, this.e.now + 25);
    // Golden Gate side of the Bay: north-west of the district
    sfx.foghorn(this.e, 0.75, panFor(L, L.yaw, { x: L.x - 200, z: L.z - 200 }, 0.6));
  }

  gull() {
    sfx.gull(this.e, rand(R, -0.8, 0.8), rand(R, 0.14, 0.22));
    this.timers.gull = Math.max(this.timers.gull, this.e.now + 2.5);
  }

  seaLion(intensity: number) {
    const L = this.listener();
    const at = this.world.seaLions;
    const near = at ? proximity(Math.hypot(L.x - at.x, L.z - at.z), 8, 95) : 0.5;
    const pan = at ? panFor(L, L.yaw, at) : rand(R, -0.4, 0.4);
    const n = 1 + Math.round(clamp(Number.isFinite(intensity) ? intensity : 0.5) * 3);
    sfx.seaLionBark(this.e, pan, 0.15 + 0.5 * near, n);
    this.timers.seaLion = Math.max(this.timers.seaLion, this.e.now + 1.5);
  }

  dispose() {
    for (const s of this.sources) { try { s.stop(); } catch { /* ignore */ } }
    try { this.out.disconnect(); } catch { /* ignore */ }
  }
}
