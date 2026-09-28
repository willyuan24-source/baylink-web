import type { Rig } from './models';

/**
 * Procedural animation for the toy rigs: walk / run cycles locked to the controller's stride phase (so
 * footstep sounds land on foot contacts), squash & stretch, springs for secondary motion (hat, backpack,
 * tail, scarf), blinks, look-at, talk, and one-shot emotes with smooth blend in/out.
 * Everything is plain math on bone transforms inside useFrame — no React state, no allocations per frame.
 */

export type Emote =
  | 'wave' | 'point' | 'hop' | 'clap' | 'shrug' | 'think'
  | 'cheer' | 'reach' | 'taste' | 'pickup' | 'look' | 'pose' | 'bell' | 'work' | 'reel' | 'tap' | 'call'
  | 'map' | 'groom' | 'stretch' | 'pant'
  // wave 5 (W5-F2, actors/charApi): whole-body moods lane A plays through charApi().emote
  | 'dance' | 'lie' | 'sit' | 'float' | 'pet';

export const EMOTE_SECONDS: Record<Emote, number> = {
  wave: 1.5, point: 1.6, hop: 0.95, clap: 1.3, shrug: 1.3, think: 2.0,
  cheer: 1.25, reach: 0.9, taste: 1.4, pickup: 1.1, look: 1.8, pose: 1e9, bell: 1.2, work: 2.4, reel: 1.8, tap: 1.6, call: 1.1,
  map: 5.5, groom: 2.4, stretch: 1.6, pant: 2,
  // one play of each (a loop holds them: charApi emote { loop: true })
  dance: 4, lie: 4, sit: 4, float: 6, pet: 1.8,
};

/** Emotes that pose the whole body (feet, root): moving cancels them (actors/charImpl.ts). */
export const BODY_EMOTES: ReadonlySet<Emote> = new Set<Emote>(['dance', 'lie', 'sit', 'float']);

/** the dance tempo (beats per second: 120 bpm) — lane A's result card / music can follow it */
export const DANCE_BPS = 2;

/** Riding poses (actors/moveSystem.ts): on the bike saddle, the toy car's driver seat, astride the pelican. */
export type RidePose = 'bike' | 'car' | 'glide';

export interface Motion {
  t: number;
  dt: number;
  speed: number;
  /** stride phase in steps (integer = foot contact) */
  stride: number;
  walkSpeed: number;
  runSpeed: number;
  grounded: boolean;
  /** vertical velocity (u/s) */
  vy: number;
  /** 0..1 jump anticipation crouch */
  crouch: number;
  turnRate: number;
  accel: number;
  /** where to look, relative to facing (rad, + = to the character's left) */
  lookYaw: number;
  /** 0..1 how strongly to look (0 = idle glances) */
  lookWeight: number;
  talking: boolean;
  riding: boolean;
  sitting?: boolean;
  /** 0..1 pushing against a wall: lean into it (A8) */
  wallLean?: number;
  /** 0..1 skidding after a sharp reversal: lean back (A10) */
  skid?: number;
  /** climbing stairs: higher knees (A10) */
  stairs?: boolean;
  /** riding pose (no walk cycle; arms to the bars / wheel / the pelican's neck) */
  ride?: RidePose | null;
  /** bike pedals: crank angle (rad), crank centre relative to the rig root and pedal radius (model units) */
  pedal?: { angle: number; y: number; z: number; r: number } | null;
  /** standing on the pedals up a steep street */
  standing?: boolean;
}

export type RigKind = 'newcomer' | 'baybay' | 'npc';

/** Per-rig tuning (the GLB BAYBAY has a bigger head and shorter arms than the procedural one). */
export interface AnimTuning {
  /** wave: arm raise (rad, z) and forward swing (x) */
  waveRz: number;
  waveRx: number;
  /** idle: paws held together at the chest (otter hands) */
  restPaws: boolean;
}
const DEFAULT_TUNING: AnimTuning = { waveRz: -2.35, waveRx: -0.25, restPaws: false };
export const GLB_BAYBAY_TUNING: AnimTuning = { waveRz: -2.0, waveRx: -0.4, restPaws: true };

class Spring {
  x = 0;
  v = 0;
  k: number;
  c: number;
  constructor(k = 140, c = 13) { this.k = k; this.c = c; }
  step(target: number, dt: number) {
    const n = dt > 0.034 ? 2 : 1, h = dt / n;
    for (let i = 0; i < n; i++) { const a = this.k * (target - this.x) - this.c * this.v; this.v += a * h; this.x += this.v * h; }
    return this.x;
  }
}

/** the bits of a three.js Object3D the foot placement touches (keeps this module free of a three import) */
type BoneLike = { position: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown }; rotation: { x: number } };

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const env = (age: number, dur: number, fadeIn = 0.14, fadeOut = 0.2) => Math.min(smooth(0, fadeIn, age), 1 - smooth(dur - fadeOut, dur, age));

export class Animator {
  readonly rig: Rig;
  readonly kind: RigKind;
  private squash = new Spring(170, 11);
  private hatY = new Spring(150, 9);
  private hatTilt = new Spring(90, 8);
  private packTilt = new Spring(80, 7);
  private tailYaw = new Spring(60, 6);
  private scarfTilt = new Spring(70, 5);
  private moveW = 0;
  private runW = 0;
  private airW = 0;
  private lookYaw = 0;
  private glance = 0;
  private glanceAt = 0;
  private blinkAt = 1.5;
  private emote: Emote | null = null;
  private emoteAge = 0;
  private emoteDur = 0;
  private emoteW = 0;
  private lastEmote: Emote | null = null;
  private talkPhase = Math.random() * 10;
  private sitW = 0;
  private rideW = 0;
  private standW = 0;
  private seed = Math.random() * 100;

  readonly tuning: AnimTuning;

  constructor(rig: Rig, kind: RigKind, tuning: Partial<AnimTuning> = {}) {
    this.rig = rig;
    this.kind = kind;
    this.tuning = { ...DEFAULT_TUNING, ...tuning };
    this.blinkAt = 1 + Math.random() * 3;
  }

  get currentEmote() { return this.emoteW > 0.02 ? this.lastEmote : null; }
  /** seconds into the emote playing now (−1 when none) */
  get emoteTime() { return this.emote ? this.emoteAge : -1; }

  play(emote: Emote, duration = EMOTE_SECONDS[emote]) {
    this.emote = emote;
    this.lastEmote = emote;
    this.emoteAge = 0;
    this.emoteDur = duration;
  }
  stop() { if (this.emote) { this.emoteDur = Math.min(this.emoteDur, this.emoteAge + (BODY_EMOTES.has(this.emote) ? 0.45 : 0.2)); } }
  playing(emote?: Emote) { return this.emote !== null && (emote === undefined || this.emote === emote); }

  /** Landing / jump impulses for the squash spring. */
  land(impact: number) { this.squash.v -= 2.4 + impact * 4.2; }
  jump() { this.squash.v += 2.6; }

  update(m: Motion) {
    const { dt, t } = m;
    const b = this.rig.bones, r = this.rig.rest;
    const walkRef = m.walkSpeed;
    const moving = m.speed > 0.25 && m.grounded && !m.riding && !m.ride;
    this.moveW = damp(this.moveW, moving ? smooth(0.15, walkRef * 0.8, m.speed) : 0, 12, dt);
    this.runW = damp(this.runW, moving ? smooth(walkRef + 0.3, m.runSpeed - 0.4, m.speed) : 0, 8, dt);
    this.airW = damp(this.airW, m.grounded ? 0 : 1, 16, dt);
    const mw = this.moveW, rw = this.runW, aw = this.airW;
    const th = Math.PI * m.stride;
    const s = Math.sin(th), c = Math.cos(th);

    // --- emote envelope
    if (this.emote) {
      this.emoteAge += dt;
      if (this.emoteAge >= this.emoteDur) this.emote = null;
    }
    // (whole-body moods lie down / get up slower than a gesture)
    const slow = this.lastEmote !== null && BODY_EMOTES.has(this.lastEmote);
    const target = this.emote ? env(this.emoteAge, this.emoteDur, slow ? 0.5 : 0.14, slow ? 0.45 : 0.2) : 0;
    this.emoteW = damp(this.emoteW, target, slow ? 7 : 18, dt);
    const ew = this.emoteW;
    const ea = this.emoteAge;
    const em = this.lastEmote;

    // --- blink
    let blink = 1;
    if (t > this.blinkAt) {
      const k = (t - this.blinkAt) / 0.13;
      blink = k < 1 ? Math.abs(1 - 2 * k) * 0.9 + 0.1 : 1;
      if (k >= 1) this.blinkAt = t + 2.2 + Math.random() * 3.4 + (Math.random() < 0.18 ? -1.9 : 0);
    }

    // --- idle glances (look around) + requested look-at
    if (t > this.glanceAt) { this.glanceAt = t + 2.5 + Math.random() * 4; this.glance = (Math.random() - 0.5) * 1.1; }
    const idle = 1 - mw;
    const wantLook = m.lookWeight > 0 ? clamp(m.lookYaw, -1.1, 1.1) * m.lookWeight : this.glance * idle * 0.7;
    this.lookYaw = damp(this.lookYaw, wantLook, 5, dt);

    // --- squash & stretch
    let sqTarget = 0;
    if (!m.grounded) sqTarget = m.vy > 0 ? 0.14 : 0.05;
    sqTarget -= m.crouch * 0.22;
    sqTarget -= mw * 0.03 * Math.pow(1 - Math.abs(s), 4) * (1 + rw);
    if (idle > 0.5 && !m.riding) sqTarget += 0.016 * Math.sin(t * 2.1 + this.seed) * idle;
    const sq = this.squash.step(sqTarget, dt);
    const sy = 1 + sq, sxz = 1 - sq * 0.55;

    const body = b.body;
    body.scale.set(sxz, sy, sxz);
    // bob + roll + lean
    const bobAmp = this.kind === 'baybay' ? 0.05 + rw * 0.05 : this.kind === 'npc' ? 0.05 + rw * 0.05 : 0.05 + rw * 0.06;
    let bob = Math.abs(s) * bobAmp * mw;
    const rollAmp = this.kind === 'baybay' ? 0.15 - rw * 0.07 : this.kind === 'npc' ? 0.03 : 0.07 - rw * 0.02;
    let roll = s * rollAmp * mw + clamp(-m.turnRate * 0.05, -0.2, 0.2) * mw;
    let lean = (this.kind === 'npc' ? 0.04 : 0.07) * mw + (this.kind === 'npc' ? 0.14 : this.kind === 'newcomer' ? 0.21 : 0.2) * rw + clamp(m.accel * 0.01, -0.12, 0.12) * mw;
    let twist = s * 0.07 * mw;
    if (m.riding) { roll = Math.sin(t * 2.3) * 0.035; lean = 0.02; twist = 0; bob = 0; }
    if (m.wallLean) lean += 0.25 * m.wallLean;
    if (m.skid) { lean -= 0.3 * m.skid; roll *= 1 - m.skid * 0.5; }
    // body turns a little toward the look target when standing
    twist += this.lookYaw * (this.kind === 'newcomer' ? 0.35 : 0.2) * idle;

    // --- base pose
    const pose = {
      rootY: bob + aw * 0.02,
      lean, roll, twist,
      headYaw: this.lookYaw * (this.kind === 'newcomer' ? 0 : 0.75), headRoll: -roll * 0.55, headPitch: 0,
      armLx: c * (0.45 + rw * 0.5) * mw, armRx: -c * (0.45 + rw * 0.5) * mw,
      armLz: 0.08 + rw * 0.22 + aw * 1.0, armRz: -(0.08 + rw * 0.22 + aw * 1.0),
      mouth: 0.72,
      eyesY: 0,
      // wave 5 (W5-F2): lying back (root pitch about the feet, rad), eyes half shut, tail wag, dance steps
      rootPitch: 0, eyeOpen: 1, tailWag: 0, danceStep: 0,
    };
    if (this.kind === 'baybay') { pose.armLz += 0.15 * mw; pose.armRz -= 0.15 * mw; pose.armLx *= 0.7; pose.armRx *= 0.7; }
    if (this.tuning.restPaws && !m.riding) {
      // otter hands: paws together at the chest while standing, relaxed swing while walking
      const k = idle * (m.talking ? 0.35 : 1);
      pose.armLx += -0.55 * k; pose.armRx += -0.55 * k;
      pose.armLz += -0.42 * k; pose.armRz += 0.42 * k;
    }
    if (m.crouch > 0) { pose.armLx += 0.6 * m.crouch; pose.armRx += 0.6 * m.crouch; }
    // sitting on the ground (idle ladder): settle down, lean back a touch, feet out front, hands on the knees
    this.sitW = damp(this.sitW, (m.sitting || this.emote === 'sit') && this.kind !== 'npc' ? 1 : 0, 5, dt);
    const sw = this.sitW;
    if (sw > 0.001) {
      pose.rootY -= 0.3 * sw;
      pose.lean -= 0.14 * sw;
      pose.armLx += -0.5 * sw; pose.armRx += -0.5 * sw;
      pose.armLz += 0.2 * sw; pose.armRz -= 0.2 * sw;
    }
    if (idle > 0.5 && this.kind !== 'npc') { pose.headRoll += Math.sin(t * 0.7 + this.seed) * 0.05 * idle; }
    // riding: lean into the bars / wheel / the pelican's neck, arms forward (bike: standing on the pedals uphill)
    this.rideW = damp(this.rideW, m.ride ? 1 : 0, 10, dt);
    this.standW = damp(this.standW, m.ride === 'bike' && m.standing ? 1 : 0, 6, dt);
    const rdw = this.rideW;
    if (rdw > 0.001 && m.ride) {
      const mix = (cur: number, v: number) => cur + (v - cur) * rdw;
      const crank = m.pedal ? m.pedal.angle : 0;
      if (m.ride === 'bike') {
        pose.lean = mix(pose.lean, 0.22 + 0.16 * this.standW);
        pose.roll = mix(pose.roll, Math.sin(crank) * 0.08 * this.standW);
        pose.rootY = mix(pose.rootY, 0.1 * this.standW + Math.abs(Math.sin(crank)) * 0.025 * Math.min(1, m.speed / 6));
        pose.armLx = mix(pose.armLx, -1.3); pose.armRx = mix(pose.armRx, -1.3);
        pose.armLz = mix(pose.armLz, -0.28); pose.armRz = mix(pose.armRz, 0.28);
      } else if (m.ride === 'car') {
        pose.lean = mix(pose.lean, 0.06);
        pose.rootY = mix(pose.rootY, Math.sin(t * 17) * 0.008 * Math.min(1, m.speed / 8));
        pose.armLx = mix(pose.armLx, -1.05); pose.armRx = mix(pose.armRx, -1.05);
        pose.armLz = mix(pose.armLz, -0.38); pose.armRz = mix(pose.armRz, 0.38);
      } else {
        pose.lean = mix(pose.lean, 0.3);
        pose.armLx = mix(pose.armLx, -0.95); pose.armRx = mix(pose.armRx, -0.95);
        pose.armLz = mix(pose.armLz, 0.55); pose.armRz = mix(pose.armRz, -0.55);
        pose.mouth = mix(pose.mouth, 1.1);
      }
      pose.twist *= 1 - rdw;
    }

    // talking: bob the head, move the mouth, small hand gestures
    if (m.talking) {
      this.talkPhase += dt * (9 + Math.sin(t * 3.1) * 3);
      const syl = Math.max(0, Math.sin(this.talkPhase)) * (0.6 + 0.4 * Math.sin(t * 5.3 + 1));
      pose.mouth = 0.45 + syl * 0.95;
      pose.headPitch += -0.05 * syl;
      pose.headRoll += Math.sin(t * 2.2) * 0.05;
      pose.armLx += -0.25 - 0.18 * Math.sin(t * 2.6);
      pose.armRx += -0.12 - 0.12 * Math.sin(t * 2.1 + 1.3);
      pose.armLz += 0.12; pose.armRz -= 0.1;
      pose.rootY += syl * 0.012;
    }
    if (m.riding) { pose.armRz = -2.55; pose.armRx = -0.2; pose.armLx = 0.1; }

    // --- emotes (blend over the base pose)
    if (em && ew > 0.001) this.applyEmote(em, ea, ew, t, pose);

    // --- write bones
    b.root.position.set(0, pose.rootY, 0);
    b.root.rotation.set(pose.rootPitch, 0, 0);
    body.rotation.set(pose.lean, pose.twist, pose.roll);
    if (b.head) b.head.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll);
    if (b.eyes) { b.eyes.scale.set(1, Math.max(0.08, blink * pose.eyeOpen), 1); b.eyes.position.set(r.eyes.x + this.lookYaw * -0.018 * (this.kind === 'newcomer' ? 1 : 0), r.eyes.y + pose.eyesY, r.eyes.z); }
    if (b.mouth) b.mouth.scale.set(1, clamp(pose.mouth, 0.2, 1.6), 1);
    if (b.armL) b.armL.rotation.set(pose.armLx, 0, pose.armLz);
    if (b.armR) b.armR.rotation.set(pose.armRx, 0, pose.armRz);

    // feet / legs
    const A = (this.kind === 'baybay' ? 0.12 : 0.16) + rw * 0.1;
    const L = ((this.kind === 'baybay' ? 0.08 : 0.1) + rw * 0.1) * (m.stairs ? 1.8 : 1);
    if (b.footL && b.footR) {
      // (the dance steps in place on the beat, one foot then the other)
      const step = pose.danceStep > 0 ? Math.sin(ea * Math.PI * DANCE_BPS) : 0;
      const liftL = Math.max(0, -s) * mw + Math.max(0, step) * pose.danceStep, liftR = Math.max(0, s) * mw + Math.max(0, -step) * pose.danceStep;
      const tuck = aw * 0.12;
      const sitF = this.sitW;
      b.footL.position.set(r.footL.x, r.footL.y + (L * liftL + tuck) + 0.22 * sitF, r.footL.z + A * c * mw + 0.24 * sitF);
      b.footR.position.set(r.footR.x, r.footR.y + (L * liftR + tuck) + 0.22 * sitF, r.footR.z - A * c * mw + 0.24 * sitF);
      b.footL.rotation.set(-0.5 * liftL + aw * 0.3 - 0.9 * sitF, 0, 0);
      b.footR.rotation.set(-0.5 * liftR + aw * 0.3 - 0.9 * sitF, 0, 0);
      if (m.ride && this.rideW > 0.001) {
        // feet on the pedals (turning with the crank) / tucked in the car's footwell / astride the pelican
        const k = this.rideW, pd = m.pedal;
        const set = (f: BoneLike, x: number, y: number, z: number, rx: number) => {
          f.position.set(f.position.x + (x - f.position.x) * k, f.position.y + (y - f.position.y) * k, f.position.z + (z - f.position.z) * k);
          f.rotation.x += (rx - f.rotation.x) * k;
        };
        if (m.ride === 'bike' && pd) {
          const ca = Math.cos(pd.angle) * pd.r, sa = Math.sin(pd.angle) * pd.r;
          set(b.footL, r.footL.x * 0.85, pd.y + ca, pd.z + sa, -0.2);
          set(b.footR, r.footR.x * 0.85, pd.y - ca, pd.z - sa, -0.2);
        } else if (m.ride === 'car') {
          set(b.footL, r.footL.x, r.footL.y + 0.02, r.footL.z + 0.28, -0.6);
          set(b.footR, r.footR.x, r.footR.y + 0.02, r.footR.z + 0.28, -0.6);
        } else if (m.ride === 'glide') {
          set(b.footL, r.footL.x + 0.22, r.footL.y + 0.02, r.footL.z + 0.12, -0.4);
          set(b.footR, r.footR.x - 0.22, r.footR.y + 0.02, r.footR.z + 0.12, -0.4);
        }
      }
    }
    if (b.legL && b.legR) {
      const swing = (0.55 + rw * 0.45) * mw;
      b.legL.rotation.set(-c * swing + aw * 0.4, 0, 0);
      b.legR.rotation.set(c * swing - aw * 0.2, 0, 0);
      if (m.sitting) { b.legL.rotation.x = -1.35; b.legR.rotation.x = -1.35; }
    }

    // secondary motion
    if (b.hat) {
      const hy = this.hatY.step(-m.vy * 0.012 + (aw > 0.5 ? 0.02 : 0), dt);
      const ht = this.hatTilt.step(-clamp(m.accel * 0.01, -0.12, 0.12) - rw * 0.1 - (this.emote === 'cheer' ? 0.1 : 0), dt);
      b.hat.position.set(r.hat.x, r.hat.y + clamp(hy, -0.05, 0.08) + (1 - sy) * -0.1, r.hat.z);
      b.hat.rotation.set(ht, 0, -roll * 0.35);
    }
    if (b.pack) {
      const pt = this.packTilt.step(mw * 0.06 + rw * 0.12 - m.vy * 0.015, dt);
      b.pack.rotation.set(pt, 0, 0);
      b.pack.position.set(r.pack.x, r.pack.y + Math.abs(s) * 0.02 * mw, r.pack.z);
    }
    if (b.tail) {
      const ty = this.tailYaw.step(s * 0.45 * mw + Math.sin(t * 1.3 + this.seed) * 0.16 * idle + pose.tailWag, dt);
      b.tail.rotation.set(-0.08 + Math.abs(s) * 0.1 * mw + aw * 0.35, ty, 0);
    }
    if (b.scarf) {
      const st = this.scarfTilt.step(-mw * 0.15 - rw * 0.35 - m.vy * 0.03 + Math.sin(t * 2.7) * 0.05, dt);
      b.scarf.rotation.set(st, 0, s * 0.1 * mw);
    }
  }

  private applyEmote(em: Emote, age: number, w: number, t: number, p: {
    rootY: number; lean: number; roll: number; twist: number; headYaw: number; headRoll: number; headPitch: number;
    armLx: number; armRx: number; armLz: number; armRz: number; mouth: number; eyesY: number;
    rootPitch: number; eyeOpen: number; tailWag: number; danceStep: number;
  }) {
    const mix = (cur: number, v: number) => cur + (v - cur) * w;
    switch (em) {
      case 'wave':
      case 'call': {
        const osc = Math.sin(age * (em === 'call' ? 16 : 13));
        p.armRz = mix(p.armRz, this.tuning.waveRz + osc * 0.32);
        p.armRx = mix(p.armRx, this.tuning.waveRx);
        p.roll = mix(p.roll, 0.08 + osc * 0.02);
        p.headRoll = mix(p.headRoll, 0.14);
        p.mouth = mix(p.mouth, 1.15);
        if (em === 'call') { p.armLx = mix(p.armLx, -1.7); p.armLz = mix(p.armLz, 0.5); p.headPitch = mix(p.headPitch, -0.12); }
        break;
      }
      case 'point':
        p.armLx = mix(p.armLx, -1.5);
        p.armLz = mix(p.armLz, 0.18);
        p.twist = mix(p.twist, 0.25);
        p.headYaw = mix(p.headYaw, 0.2);
        p.lean = mix(p.lean, 0.06);
        p.mouth = mix(p.mouth, 1.1);
        break;
      case 'hop':
      case 'cheer': {
        const hops = em === 'hop' ? 2 : 1;
        const k = clamp(age / (EMOTE_SECONDS[em] * 0.85), 0, 1);
        const y = Math.abs(Math.sin(k * Math.PI * hops)) * (em === 'hop' ? 0.34 : 0.3);
        p.rootY += y * w;
        p.armLz = mix(p.armLz, 2.3 + Math.sin(age * 14) * 0.15);
        p.armRz = mix(p.armRz, -2.3 - Math.sin(age * 14) * 0.15);
        p.mouth = mix(p.mouth, 1.35);
        p.headPitch = mix(p.headPitch, -0.14);
        break;
      }
      case 'clap': {
        const osc = Math.sin(age * 20);
        p.armLx = mix(p.armLx, -1.15); p.armRx = mix(p.armRx, -1.15);
        p.armLz = mix(p.armLz, -0.45 + osc * 0.28); p.armRz = mix(p.armRz, 0.45 - osc * 0.28);
        p.rootY += Math.abs(Math.sin(age * 10)) * 0.04 * w;
        p.mouth = mix(p.mouth, 1.3);
        break;
      }
      case 'shrug':
        p.armLz = mix(p.armLz, 1.05); p.armRz = mix(p.armRz, -1.05);
        p.armLx = mix(p.armLx, -0.5); p.armRx = mix(p.armRx, -0.5);
        p.headRoll = mix(p.headRoll, 0.26);
        p.rootY += 0.03 * w;
        p.mouth = mix(p.mouth, 0.5);
        break;
      case 'think':
        p.armRx = mix(p.armRx, -2.2); p.armRz = mix(p.armRz, 0.75);
        p.headRoll = mix(p.headRoll, -0.2);
        p.headPitch = mix(p.headPitch, -0.12);
        p.eyesY = mix(p.eyesY, 0.018);
        p.mouth = mix(p.mouth, 0.35);
        p.roll = mix(p.roll, -0.05);
        break;
      case 'reach':
        p.armLx = mix(p.armLx, -1.35); p.armRx = mix(p.armRx, -1.35);
        p.armLz = mix(p.armLz, -0.1); p.armRz = mix(p.armRz, 0.1);
        p.lean = mix(p.lean, 0.18);
        break;
      case 'taste': {
        const nod = Math.sin(age * 9) * 0.08;
        p.armRx = mix(p.armRx, -2.25); p.armRz = mix(p.armRz, 0.55);
        p.headPitch = mix(p.headPitch, nod);
        p.lean = mix(p.lean, 0.05 + nod);
        p.rootY += Math.abs(Math.sin(age * 9)) * 0.02 * w;
        break;
      }
      case 'pickup': {
        const k = clamp(age / 0.5, 0, 1);
        const down = Math.sin(k * Math.PI);
        p.lean = mix(p.lean, 0.5 * down);
        p.armLx = mix(p.armLx, -1.2 * down + (k >= 1 ? 0 : 0)); p.armRx = mix(p.armRx, -1.2 * down);
        if (age > 0.5) { p.armLz = mix(p.armLz, 2.2); p.armRz = mix(p.armRz, -2.2); p.rootY += Math.sin(clamp((age - 0.5) / 0.5, 0, 1) * Math.PI) * 0.25 * w; }
        break;
      }
      case 'look':
        p.headPitch = mix(p.headPitch, -0.25);
        p.lean = mix(p.lean, -0.12);
        p.armLx = mix(p.armLx, -2.3); p.armLz = mix(p.armLz, -0.3);
        p.twist = mix(p.twist, Math.sin(age * 1.6) * 0.3);
        break;
      case 'pose':
        p.armRx = mix(p.armRx, -2.1 + Math.sin(t * 2) * 0.05); p.armRz = mix(p.armRz, -0.35);
        p.armLz = mix(p.armLz, 0.45);
        p.roll = mix(p.roll, 0.1);
        p.headRoll = mix(p.headRoll, 0.18);
        p.mouth = mix(p.mouth, 1.3);
        break;
      case 'bell': {
        const pull = Math.max(0, Math.sin(age * 9));
        p.armRz = mix(p.armRz, -2.6 + pull * 0.5);
        p.headPitch = mix(p.headPitch, -0.1);
        p.mouth = mix(p.mouth, 1.2);
        break;
      }
      case 'work': {
        const k = Math.sin(age * 4.5);
        p.armLx = mix(p.armLx, -0.9 + k * 0.3); p.armRx = mix(p.armRx, -0.9 - k * 0.3);
        p.lean = mix(p.lean, 0.14);
        p.headPitch = mix(p.headPitch, 0.18);
        break;
      }
      case 'reel':
        p.armLx = mix(p.armLx, -1.0 + Math.sin(age * 12) * 0.35); p.armLz = mix(p.armLz, -0.25 + Math.cos(age * 12) * 0.2);
        p.lean = mix(p.lean, -0.08);
        break;
      case 'map': {
        // unroll the carried map in front, study it, glance up now and then
        const glance = Math.max(0, Math.sin(age * 1.3 - 1.2)) ** 6;
        p.armLx = mix(p.armLx, -1.25); p.armLz = mix(p.armLz, -0.35);
        p.armRx = mix(p.armRx, -1.1); p.armRz = mix(p.armRz, 0.35);
        p.lean = mix(p.lean, 0.1 - glance * 0.12);
        p.headPitch = mix(p.headPitch, 0.15 - glance * 0.25);
        p.eyesY = mix(p.eyesY, -0.02 + glance * 0.03);
        p.mouth = mix(p.mouth, 0.5);
        break;
      }
      case 'groom': {
        // otter grooming: both paws rub the face / ears
        const rub = Math.sin(age * 11);
        p.armLx = mix(p.armLx, -2.3 + rub * 0.12); p.armRx = mix(p.armRx, -2.3 - rub * 0.12);
        p.armLz = mix(p.armLz, -0.55 + rub * 0.1); p.armRz = mix(p.armRz, 0.55 + rub * 0.1);
        p.headPitch = mix(p.headPitch, 0.12);
        p.headRoll = mix(p.headRoll, rub * 0.08);
        p.eyesY = mix(p.eyesY, -0.01);
        p.mouth = mix(p.mouth, 0.4);
        break;
      }
      case 'stretch': {
        // jogger at a loop end: arms up, lean side to side
        const k = Math.sin(age * 3.2);
        p.armLz = mix(p.armLz, 2.6); p.armRz = mix(p.armRz, -2.6);
        p.roll = mix(p.roll, k * 0.18);
        p.lean = mix(p.lean, -0.06);
        p.rootY += 0.02 * w;
        break;
      }
      case 'pant': {
        // no stamina, just a cosmetic breather at the crest: hands on knees, quick breaths
        const breath = Math.sin(age * 14);
        p.lean = mix(p.lean, 0.38);
        p.armLx = mix(p.armLx, -0.55); p.armRx = mix(p.armRx, -0.55);
        p.armLz = mix(p.armLz, -0.2); p.armRz = mix(p.armRz, 0.2);
        p.rootY += (-0.04 + breath * 0.012) * w;
        p.headPitch = mix(p.headPitch, -0.1 + breath * 0.04);
        p.mouth = mix(p.mouth, 1.35 + breath * 0.2);
        break;
      }
      case 'dance': {
        // 120 bpm: a bounce on every beat, a sway every two, the arms trading between "raise the roof" and a
        // chest-high swing over a 4 s bar; the feet step in place (the feet block in update)
        const beat = age * Math.PI * DANCE_BPS, bar = 0.5 - 0.5 * Math.cos(age * Math.PI * 0.5);
        const pump = Math.abs(Math.sin(beat));
        p.rootY += pump * 0.07 * w;
        p.roll = mix(p.roll, Math.sin(beat * 0.5) * 0.17);
        p.twist = mix(p.twist, Math.sin(beat * 0.5) * 0.22);
        p.lean = mix(p.lean, 0.04);
        p.headRoll = mix(p.headRoll, Math.sin(beat * 0.5) * -0.18);
        p.headPitch = mix(p.headPitch, -pump * 0.08);
        const up = 2.1 + pump * 0.35, swing = Math.sin(beat * 0.5);
        p.armLz = mix(p.armLz, up * bar + (0.35 + swing * 0.45) * (1 - bar));
        p.armRz = mix(p.armRz, -up * bar + (-0.35 + swing * 0.45) * (1 - bar));
        p.armLx = mix(p.armLx, -0.95 * (1 - bar)); p.armRx = mix(p.armRx, -0.95 * (1 - bar));
        p.mouth = mix(p.mouth, 1.3);
        p.tailWag += Math.sin(beat) * 0.5 * w;
        p.danceStep = w;
        break;
      }
      case 'lie':
      case 'float': {
        // on the back (pitch about the feet), lifted so the back rests on the ground / the water. float: BAYBAY's
        // otter float, paws together on the chest, a slow bob and roll (sea otters float belly up, the chest a table)
        const float = em === 'float';
        const pitch = this.kind === 'baybay' ? -1.45 : -1.35, lift = this.kind === 'baybay' ? 0.34 : this.kind === 'npc' ? 0.3 : 0.42;
        p.rootPitch = mix(p.rootPitch, pitch);
        p.rootY += (lift + (float ? Math.sin(t * 1.7) * 0.035 : 0)) * w;
        p.lean = mix(p.lean, 0);
        p.twist = mix(p.twist, 0);
        p.roll = mix(p.roll, float ? Math.sin(t * 0.9) * 0.1 : Math.sin(t * 0.5) * 0.03);
        p.headPitch = mix(p.headPitch, float ? -0.25 : -0.12);
        p.headRoll = mix(p.headRoll, float ? Math.sin(t * 0.9 + 1) * 0.08 : 0.12);
        if (float) { p.armLx = mix(p.armLx, -0.95); p.armRx = mix(p.armRx, -0.95); p.armLz = mix(p.armLz, -0.45); p.armRz = mix(p.armRz, 0.45); }
        else { p.armLx = mix(p.armLx, -0.25); p.armRx = mix(p.armRx, -0.25); p.armLz = mix(p.armLz, 1.15); p.armRz = mix(p.armRz, -1.15); }
        p.eyeOpen = mix(p.eyeOpen, float ? 0.6 : 0.45);
        p.mouth = mix(p.mouth, 1.05);
        p.tailWag += Math.sin(t * 1.1) * 0.25 * w;
        break;
      }
      case 'sit':
        // (the settle itself is the sit weight in update: root down, lean back, feet out)
        p.headRoll = mix(p.headRoll, 0.06 + Math.sin(t * 0.6) * 0.04);
        p.mouth = mix(p.mouth, 0.9);
        break;
      case 'pet': {
        if (this.kind === 'baybay') {
          // being petted: a happy squint, a wiggle, paws to the chest, the head leaning into the hand, the tail going
          const wig = Math.sin(age * 16);
          p.eyeOpen = mix(p.eyeOpen, 0.22);
          p.roll = mix(p.roll, wig * 0.07);
          p.rootY += Math.abs(Math.sin(age * 8)) * 0.045 * w;
          p.armLx = mix(p.armLx, -0.85); p.armRx = mix(p.armRx, -0.85);
          p.armLz = mix(p.armLz, -0.42); p.armRz = mix(p.armRz, 0.42);
          p.headRoll = mix(p.headRoll, 0.22 + Math.sin(age * 6) * 0.07);
          p.headPitch = mix(p.headPitch, -0.14);
          p.mouth = mix(p.mouth, 1.35);
          p.tailWag += Math.sin(age * 14) * 0.6 * w;
        } else {
          // the petting hand: reach forward and pat
          p.armRx = mix(p.armRx, -1.45 + Math.max(0, Math.sin(age * 12)) * 0.28);
          p.armRz = mix(p.armRz, -0.15);
          p.lean = mix(p.lean, 0.12);
          p.headPitch = mix(p.headPitch, 0.12);
          p.mouth = mix(p.mouth, 1.2);
        }
        break;
      }
      case 'tap':
        p.headRoll = mix(p.headRoll, 0.1 * Math.sin(age * 4));
        p.armLz = mix(p.armLz, 0.55); p.armRz = mix(p.armRz, -0.55);
        p.armLx = mix(p.armLx, 0.35); p.armRx = mix(p.armRx, 0.35);
        p.rootY += Math.abs(Math.sin(age * 8)) * 0.02 * w;
        break;
    }
  }
}
