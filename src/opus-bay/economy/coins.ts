/**
 * Wave 5 · lane E · W5-E3: the coins in the world — which ones exist and are still there, and picking them up.
 *
 *   initCoins()   registers the coin ids with the ledger (trail / cache / ring), the pickup frame system, the chime and
 *                 the scene layer (economy/CoinLayer.tsx); returns the off
 *   coinWorld     the state the layer and QA read: `visible` (the ≤ 32 instances to draw), `popping` (just picked up)
 *
 * Every coin comes from economy/coinSpots.ts (placed by scripts/opus-sf/coins-place.mts). A coin is "there" until the
 * ledger has paid its source: trails come back every Bay day (play.t), caches and air rings are once per save. Downtown
 * spots (`dt`) stay hidden until lane V publishes the measured headroom (DOWNTOWN_OPEN; plan MF9 / D15).
 *
 * Pickup (≤ 30 Hz, the 64 u buckets round the player): on foot 1.2 u (and ≤ 1.8 u of height), on the bike / in the car
 * 2 u, gliding low (< 6 u over the ground) a 2.5 u magnet for ground coins, and 3.6 u (in 3D) for the air coins — a
 * ring is 8 coins on a 3.2 u circle, so flying through its middle takes all eight. Never while travelling (飞过去),
 * riding a line, in photo mode, or outside the playing phase. Each pickup emits `reward` (the ledger pays it and emits
 * `coins`), a sparkle, and a chime that climbs a step with each coin of the same trail or ring (a cache rings a chord).
 */
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { registerFrameSystem, registerSceneSystem } from '../game/systemsRegistry';
import { playSound, registerSound } from '../audio/hooks';
import { spawnFx } from '../world/fx';
import { COIN_CACHES, COIN_RINGS, COIN_TRAILS, SLOT_COINS, cacheIds, ringCoinIds, trailCoinIds } from './coinSpots';
import { isPaid, registerRewardIds, subscribeLedger, todayKey } from './ledger';
import { registerHintSource } from './hints';

/** Lane V publishes the downtown headroom (plan MF9): until then the downtown coins are not drawn or picked up. */
export const DOWNTOWN_OPEN = false;
/** coins a cache pays (the ledger's cap for `cache:` is 12) */
export const CACHE_COINS = 10;
export const PICKUP = { foot: 1.2, footDy: 1.8, ride: 2, rideDy: 2.2, glideLow: 6, magnet: 2.5, air: 3.6 } as const;
/** instances drawn at most (one InstancedMesh: ≤ 32 × 48 tris = 1.5k), and how far they are looked for */
export const MAX_DRAWN = 32;
export const VIEW_R = { foot: 80, glide: 170 } as const;
/** the instances a cache takes (a little stack + one coin turning over it) */
export const CACHE_STACK = 5;
const BUCKET = 64;
/** the chime climbs a major pentatonic ladder (semitones) along a trail or a ring */
export const LADDER = [0, 2, 4, 7, 9, 12, 14, 16] as const;

export type CoinKind = 'trail' | 'cache' | 'ring';
export interface CoinItem {
  /** the ledger source (`trail:filbert-steps:3`, `cache:bernal-top`, `ring:coit:5`) */
  source: string;
  kind: CoinKind;
  /** the trail / cache / ring id (chime steps, finds) */
  entry: string;
  x: number; y: number; z: number;
  /** in the air (rings, air caches): picked up only while gliding, by 3D distance */
  air: boolean;
  /** rings: the flight direction's yaw (the coins face it) */
  yaw: number;
  coins: number;
}

/** Every coin item of the published spots (downtown ones only when `downtown`), in registry order. */
export function coinItems(downtown = DOWNTOWN_OPEN): CoinItem[] {
  const out: CoinItem[] = [];
  for (const t of COIN_TRAILS) {
    if (t.retired || (t.dt && !downtown)) continue;
    for (let i = 0; i < t.p.length / 3 && i < SLOT_COINS; i++) {
      out.push({ source: `trail:${t.id}:${i + 1}`, kind: 'trail', entry: t.id, x: t.p[3 * i], y: t.p[3 * i + 1], z: t.p[3 * i + 2], air: false, yaw: 0, coins: 1 });
    }
  }
  for (const c of COIN_CACHES) {
    if (c.retired || (c.dt && !downtown)) continue;
    out.push({ source: `cache:${c.id}`, kind: 'cache', entry: c.id, x: c.x, y: c.y, z: c.z, air: !!c.air, yaw: 0, coins: CACHE_COINS });
  }
  for (const r of COIN_RINGS) {
    if (r.retired || r.reserved || (r.dt && !downtown)) continue;
    for (const [i, p] of ringCoinPositions(r).entries()) {
      out.push({ source: `ring:${r.id}:${i + 1}`, kind: 'ring', entry: r.id, ...p, air: true, yaw: r.yaw, coins: 1 });
    }
  }
  return out;
}

/** The eight coins of a ring: a vertical circle of radius r across the flight direction `yaw` (coins-place ringCoins). */
export function ringCoinPositions(r: { x: number; y: number; z: number; yaw: number; r: number }): { x: number; y: number; z: number }[] {
  const ax = Math.cos(r.yaw), az = -Math.sin(r.yaw);
  return Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return { x: r.x + ax * Math.cos(a) * r.r, y: r.y + Math.sin(a) * r.r, z: r.z + az * Math.cos(a) * r.r };
  });
}

/** Where the player picks up from right now, or null (not playing, travelling, riding a line, photo mode). */
export interface Picker { x: number; y: number; z: number; mode: 'foot' | 'ride' | 'glide'; low: boolean }
export function currentPicker(): Picker | null {
  const s = game.get();
  if (s.phase !== 'playing' || s.worldMode !== 'city') return null;
  const mode = runtime.move.mode;
  if (mode === 'glide') {
    const gl = runtime.glide;
    return { x: gl.x, y: gl.y, z: gl.z, mode: 'glide', low: gl.height < PICKUP.glideLow };
  }
  const p = runtime.player;
  if (mode === 'foot' || mode === 'sit') return { x: p.x, y: p.y, z: p.z, mode: 'foot', low: true };
  if (mode === 'bike' || mode === 'car') { const v = runtime.vehicle; return { x: v.x, y: v.y, z: v.z, mode: 'ride', low: true }; }
  return null;
}

/** Would `p` pick up `c` (the radii above)? */
export function canPick(p: Picker, c: CoinItem): boolean {
  const dx = c.x - p.x, dz = c.z - p.z, d2 = dx * dx + dz * dz;
  if (c.air) {
    if (p.mode !== 'glide') return false;
    const dy = c.y - p.y;
    return d2 + dy * dy <= PICKUP.air * PICKUP.air;
  }
  if (p.mode === 'glide') return p.low && d2 <= PICKUP.magnet * PICKUP.magnet && p.y - c.y < PICKUP.glideLow + 1;
  const r = p.mode === 'ride' ? PICKUP.ride : PICKUP.foot, dyMax = p.mode === 'ride' ? PICKUP.rideDy : PICKUP.footDy;
  return d2 <= r * r && Math.abs(p.y - c.y) <= dyMax;
}

/**
 * The live coin set: items bucketed by 64 u, a `taken` flag per item recomputed from the ledger whenever it changes
 * (or the Bay day turns), the pickup step and the draw list. Pure apart from the ledger / events it calls (tests drive
 * it with a stub picker).
 */
export class CoinWorld {
  readonly items: CoinItem[];
  private readonly buckets = new Map<string, number[]>();
  private taken: Uint8Array;
  private day = '';
  private dirty = false;
  /** the instances to draw (index into items), nearest first, ≤ MAX_DRAWN instances (a cache counts CACHE_STACK) */
  visible: number[] = [];
  /** picked up in the last 0.4 s: [item index, performance.now() ms] (the layer plays the pop) */
  popping: [number, number][] = [];
  private lastPick = { entry: '', at: -1e9, step: 0 };
  private visibleAt = -1e9;
  stats = { picked: 0, visible: 0, instances: 0, refreshes: 0 };

  constructor(items: CoinItem[]) {
    this.items = items;
    this.taken = new Uint8Array(items.length);
    items.forEach((c, i) => {
      const k = `${Math.floor(c.x / BUCKET)},${Math.floor(c.z / BUCKET)}`;
      let list = this.buckets.get(k);
      if (!list) this.buckets.set(k, (list = []));
      list.push(i);
    });
    this.refresh();
  }

  /** Re-read which coins the ledger has paid (after any ledger change, a reset, a new Bay day). */
  refresh(): void {
    this.day = todayKey();
    for (let i = 0; i < this.items.length; i++) this.taken[i] = isPaid(this.items[i].source) ? 1 : 0;
    this.stats.refreshes++;
    this.visibleAt = -1e9;
  }

  /** The ledger changed (a payment, a purchase, a reset): re-read at the next step (once, not per coin of a ring). */
  markDirty(): void { this.dirty = true; }

  isTaken(i: number): boolean { return this.taken[i] === 1; }

  /** The items within r of (x, z) that are still there (bucket walk). */
  near(x: number, z: number, r: number, out: number[] = []): number[] {
    out.length = 0;
    const b0 = Math.floor((x - r) / BUCKET), b1 = Math.floor((x + r) / BUCKET), c0 = Math.floor((z - r) / BUCKET), c1 = Math.floor((z + r) / BUCKET);
    for (let bx = b0; bx <= b1; bx++) for (let bz = c0; bz <= c1; bz++) {
      const list = this.buckets.get(`${bx},${bz}`);
      if (!list) continue;
      for (const i of list) {
        if (this.taken[i]) continue;
        const c = this.items[i];
        if ((c.x - x) ** 2 + (c.z - z) ** 2 <= r * r) out.push(i);
      }
    }
    return out;
  }

  private scratch: number[] = [];
  /** One pickup step for `p` at `now` (ms): the items picked up (each paid through a `reward` event). */
  step(p: Picker | null, now: number): number[] {
    if (this.dirty || todayKey() !== this.day) { this.dirty = false; this.refresh(); }
    if (!p) return [];
    const got: number[] = [];
    for (const i of this.near(p.x, p.z, PICKUP.air + 1, this.scratch)) {
      const c = this.items[i];
      if (!canPick(p, c)) continue;
      this.taken[i] = 1;
      got.push(i);
      this.popping.push([i, now]);
      this.stats.picked++;
      emit({ type: 'reward', source: c.source, coins: c.coins });
      if (c.kind === 'cache') emit({ type: 'find', kind: 'cache', id: c.entry, first: true });
      this.chime(c, now);
      spawnFx('sparkle', c.x, c.air ? c.y : c.y + 0.9, c.z, { count: c.kind === 'cache' ? 14 : 5, scale: c.kind === 'cache' ? 1 : 0.6, color: '#ffd66b' });
    }
    if (got.length) this.visibleAt = -1e9;
    if (this.popping.length) this.popping = this.popping.filter(([, t]) => now - t < 400);
    return got;
  }

  private chime(c: CoinItem, now: number) {
    const same = c.entry === this.lastPick.entry && now - this.lastPick.at < 4000;
    const step = same ? Math.min(this.lastPick.step + 1, LADDER.length - 1) : 0;
    this.lastPick = { entry: c.entry, at: now, step };
    playSound(c.kind === 'cache' ? 'e-coin-cache' : 'e-coin', { pitch: 2 ** (LADDER[step] / 12), gain: 0.9 });
  }

  /** The draw list (≤ 5 Hz is plenty: coins do not move): nearest first, a cache as CACHE_STACK instances. */
  updateVisible(x: number, z: number, gliding: boolean, now: number): void {
    if (now - this.visibleAt < 200) return;
    this.visibleAt = now;
    const R = gliding ? VIEW_R.glide : VIEW_R.foot;
    const list = this.near(x, z, R, []);
    list.sort((a, b) => ((this.items[a].x - x) ** 2 + (this.items[a].z - z) ** 2) - ((this.items[b].x - x) ** 2 + (this.items[b].z - z) ** 2));
    const out: number[] = [];
    let n = 0;
    for (const i of list) {
      const w = this.items[i].kind === 'cache' ? CACHE_STACK : 1;
      if (n + w > MAX_DRAWN) continue;
      out.push(i);
      n += w;
    }
    this.visible = out;
    this.stats.visible = out.length;
    this.stats.instances = n;
  }
}

/** The one live coin world (the layer reads it); null outside city mode / before init. */
export let coinWorld: CoinWorld | null = null;

/** The chimes (audio/hooks): a bright two-note ting, and a small chord for a cache. */
function registerChimes(): () => void {
  const offA = registerSound('e-coin', (e, o) => {
    const k = o?.pitch ?? 1;
    const v = e.voice({ bus: 'sfx', dur: 0.45, gain: 0.22 * (o?.gain ?? 1), priority: 2, reverb: 0.12, name: 'coin' });
    if (!v) return;
    e.tone(v, { freq: 988 * k, type: 'triangle', decay: 0.12, peak: 0.5 });
    e.tone(v, { freq: 1319 * k, type: 'sine', decay: 0.3, peak: 0.45, offset: 0.06 });
  });
  const offB = registerSound('e-coin-cache', (e, o) => {
    const v = e.voice({ bus: 'sfx', dur: 0.9, gain: 0.26 * (o?.gain ?? 1), priority: 3, reverb: 0.25, name: 'coin-cache' });
    if (!v) return;
    for (const [i, f] of [1047, 1319, 1568, 2093].entries()) e.tone(v, { freq: f, type: i % 2 ? 'sine' : 'triangle', decay: 0.35 + i * 0.08, peak: 0.4, offset: i * 0.05 });
  });
  return () => { offA(); offB(); };
}

/** Start the coins (city mode; called by economy/index.ts after the ledger). Returns the off. */
export function initCoins(): () => void {
  const offs: (() => void)[] = [
    registerRewardIds('trail', trailCoinIds()),
    registerRewardIds('cache', cacheIds()),
    registerRewardIds('ring', ringCoinIds()),
  ];
  const world = new CoinWorld(coinItems());
  coinWorld = world;
  let lastStep = -1e9, gone = false;
  offs.push(subscribeLedger(() => world.markDirty()));
  offs.push(registerChimes());
  offs.push(registerFrameSystem('e-coins', (_dt, now) => {
    // ≤ 30 Hz: the pickup and (≤ 5 Hz inside) the draw list
    if (now - lastStep < 33) return;
    lastStep = now;
    const p = currentPicker();
    world.step(p, now);
    const at = p ?? runtime.player;
    world.updateVisible(at.x, at.z, runtime.move.mode === 'glide', now);
  }, 40));
  // the 寻宝罗盘 (shop, W5-E6) points at the nearest unfound cache
  offs.push(registerHintSource('cache', () => world.items.filter((c, i) => c.kind === 'cache' && !world.isTaken(i)).map(c => ({ id: c.entry, x: c.x, z: c.z }))));
  void import('./CoinLayer').then(m => { if (!gone) offs.push(registerSceneSystem('e-coins', m.CoinLayer)); });
  return () => {
    gone = true;
    for (const off of offs.splice(0).reverse()) off();
    if (coinWorld === world) coinWorld = null;
  };
}
