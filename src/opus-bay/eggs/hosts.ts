import { playSound } from '../audio/hooks';
import { panFor, proximity } from '../audio/logic';
import { emit, onEvent, type GameEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import { isPaid } from '../economy/ledger';
import { cinemaActive, playShots, type Shot } from '../game/cinema';
import { bubble, busy } from '../game/flow';
import { invalidateInteractables, registerInteractables, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { openOverlay, openOverlays, subscribeOverlays } from '../ui/slots';
import { spawnFx, type FxOpts, type FxPreset } from '../world/fx';
import type { FactCardProps, NoteProps, OperatorProps } from './FactCard';
import { Flock, PropPool } from './props';
import { EGG_COINS, eggById, eggRewardSource, eggSpots } from './registry';
import type { EggSound } from './sounds';

/**
 * Wave 5 · lane D (W5-D2) · the egg hosts: one small object per egg (the area modules make them) that wakes up only
 * near its spots, plus the kit every host uses:
 *
 *   reveal(id, opts)    THE find: `find` event, the `reward` (egg:<id>, 10 金币, paid once by lane E's ledger), the find
 *                       chime and sparkle, BAYBAY's lines, then the fact card (first time only; later: quiet)
 *   say(lines)          BAYBAY's bubbles one after the other (game/flow bubble)
 *   sound(id, at?)      a registered egg sound, placed (gain by distance, pan by the camera's yaw) when `at` is given
 *   fx(preset, …)       the shared toy particle pool (world/fx: no new draw call)
 *   beat(shots)         a short camera beat through game/cinema playShots (holds the lock through the cinema, released
 *                       however it ends; skipped while gliding, riding, talking or in another cinematic)
 *   props / flock       the prop pool and the flock (eggs/props.ts)
 *   note / operator     the paper overlays (eggs/FactCard.tsx)
 *
 * Stepping: one frame system (`eggs`): the flock every frame; the hosts at ≈ 10 Hz, only those whose egg has a spot
 * within their `range` of the player (enter / update / leave); the prop pool at 2 Hz. Everything is undone by the
 * function `startHosts` returns.
 */

export interface HostCtx {
  /** seconds since the hosts started (the host clock) */
  t: number;
  /** seconds since this host's previous update */
  dt: number;
  /** the player */
  px: number; py: number; pz: number;
  /** distance to the nearest of the egg's spots (u) */
  dist: number;
  /** found before (the ledger's bit or this session) */
  found: boolean;
  /** a dialogue, a cinematic, a panel-less busy state (flow busy()): no moments now */
  busy: boolean;
}

export interface EggHost {
  /** the egg (registry id) */
  id: string;
  /** update() runs while the player is within this distance of one of the egg's spots (Infinity: always) */
  range: number;
  enter?(ctx: HostCtx): void;
  update?(ctx: HostCtx): void;
  leave?(ctx: HostCtx): void;
  /** game events, whatever the distance (glide:land, transit, …) */
  onEvent?(e: GameEvent, ctx: HostCtx): void;
  /** prompts on offer (source 'find', id `egg:<id>…`); asked again after `kit.invalidate()` */
  interactables?(): Interactable[];
  /** DEV / QA: play the moment now, gates ignored (screenshots) */
  qa?(): void;
  dispose?(): void;
}

export interface RevealOpts {
  /** BAYBAY's lines (default: the registry's lines); false = none */
  lines?: readonly Bilingual[] | false;
  /** the egg's own sound, played with the find */
  sound?: EggSound;
  /** where the sound comes from (default: the player) */
  at?: { x: number; z: number };
  /** delay before the card (s, default 1.6: the first line is read first) */
  cardDelay?: number;
  /** a repeat also says the first line (once a session) */
  repeatLine?: boolean;
}

const HOST_STEP = 0.1;

let hosts: EggHost[] = [];
const active = new Set<string>();
const sessionFound = new Set<string>();
const repeatSaid = new Set<string>();
const lastUpdate = new Map<string, number>();
let clock = 0;
let acc = 0;
let lineTimers: ReturnType<typeof setTimeout>[] = [];
let cardTimer: ReturnType<typeof setTimeout> | null = null;

export const props = new PropPool();
export const flock = new Flock();

/** Found before: paid by the ledger (the egg bitset) or found in this session. */
export function isFound(id: string): boolean {
  if (sessionFound.has(id)) return true;
  try { return isPaid(eggRewardSource(id)); } catch { return false; }
}

const lineMs = (b: Bilingual) => Math.max(3200, Math.min(5400, 2400 + 70 * [...b.zh].length));

/** BAYBAY's bubbles in order (a new call replaces a queue still running). */
export function say(lines: readonly Bilingual[] | Bilingual, gapMs = 250): void {
  for (const t of lineTimers) clearTimeout(t);
  lineTimers = [];
  const list = Array.isArray(lines) ? lines : [lines as Bilingual];
  let at = 0;
  for (const line of list) {
    const ms = lineMs(line);
    if (at === 0) bubble(line, ms);
    else lineTimers.push(setTimeout(() => bubble(line, ms), at));
    at += ms + gapMs;
  }
}

/** A registered egg sound; placed at `at` (gain by distance near…far, pan by the camera's yaw) or at the player. */
export function sound(id: EggSound, at?: { x: number; z: number } | null, o: { near?: number; far?: number; gain?: number; pitch?: number } = {}): void {
  if (!at) { playSound(id, { gain: o.gain ?? 1, pitch: o.pitch }); return; }
  const listener = { x: runtime.player.x, z: runtime.player.z };
  const d = Math.hypot(at.x - listener.x, at.z - listener.z);
  const k = proximity(d, o.near ?? 8, o.far ?? 120);
  if (k <= 0.01) return;
  playSound(id, { gain: k * (o.gain ?? 1), pan: panFor(listener, runtime.camera.yaw, at), pitch: o.pitch });
}

export function fx(preset: FxPreset, x: number, y: number, z: number, opts?: FxOpts): void { spawnFx(preset, x, y, z, opts); }

/** Nothing else is holding the screen: a moment may start (on foot or sitting, playing, no dialogue / cinematic). */
export function momentFree(): boolean {
  if (busy() || cinemaActive()) return false;
  const mode = runtime.move.mode;
  return mode === 'foot' || mode === 'sit';
}

/** A short camera beat (playShots holds the lock and releases it however it ends). False when it cannot play now. */
export function beat(shots: Shot[], onDone?: () => void): boolean {
  if (!shots.length || !momentFree() || runtime.glide.active) return false;
  playShots('viewpoint', shots, onDone);
  return true;
}

/**
 * A paper on screen (the egg-note overlay); `onClosed` runs once when it goes (×, 收好, Esc, E, walking away, or
 * another note taking its place): the find's lines and card wait for it, so nothing is read under the paper.
 */
export function note(p: NoteProps, onClosed?: () => void): void {
  openOverlay('egg-note', p);
  if (!onClosed) return;
  const isOpen = () => openOverlays().some(o => o.id === 'egg-note' && o.props === p);
  if (!isOpen()) { onClosed(); return; }
  const off = subscribeOverlays(() => { if (!isOpen()) { off(); onClosed(); } });
}
export const operator = (p: OperatorProps) => openOverlay('egg-operator', p);
/** The prompts changed (a phone started ringing, a prop appeared). */
export const invalidate = () => invalidateInteractables();

/**
 * The find. First time: `find` (first: true) + the reward + chime + sparkle + lines + the card; the returned value is
 * true. Found before: `find` (first: false), the egg's own sound, and (with `repeatLine`) its first line once a session.
 */
export function reveal(id: string, opts: RevealOpts = {}): boolean {
  const egg = eggById(id);
  if (!egg) return false;
  const first = !isFound(id);
  emit({ type: 'find', kind: 'egg', id, first });
  if (opts.sound) sound(opts.sound, opts.at ?? null);
  if (!first) {
    if (opts.repeatLine && opts.lines !== false && !repeatSaid.has(id)) { repeatSaid.add(id); say((opts.lines ?? egg.lines).slice(0, 1)); }
    return false;
  }
  sessionFound.add(id);
  repeatSaid.add(id);
  emit({ type: 'reward', source: eggRewardSource(id), coins: EGG_COINS });
  playSound('egg:find');
  const p = runtime.player;
  spawnFx('sparkle', p.x, p.y + 1.6, p.z, { count: 18, color: '#f3c75a' });
  if (opts.lines !== false) say(opts.lines ?? egg.lines);
  if (cardTimer) clearTimeout(cardTimer);
  cardTimer = setTimeout(() => {
    cardTimer = null;
    // the one-toast rule: a find replaces whatever toast is up (plan §3.1 UI)
    if (game.get().toasts.length) game.set({ toasts: [] });
    const props: FactCardProps = { id, coins: EGG_COINS };
    openOverlay('egg-card', props);
  }, Math.max(0, (opts.cardDelay ?? 1.6) * 1000));
  return true;
}

function ctxFor(h: EggHost, px: number, py: number, pz: number, dist: number, isBusy: boolean): HostCtx {
  const prev = lastUpdate.get(h.id) ?? clock;
  return { t: clock, dt: clock - prev, px, py, pz, dist, found: isFound(h.id), busy: isBusy };
}

function distTo(h: EggHost, x: number, z: number): number {
  const egg = eggById(h.id);
  if (!egg) return Infinity;
  let d = Infinity;
  for (const s of eggSpots(egg)) d = Math.min(d, Math.hypot(s.x - x, s.z - z));
  return d;
}

/** One frame (the frame system): the flock every frame, the hosts at ≈ 10 Hz, the prop pool at 2 Hz. */
export function stepHosts(dt: number): void {
  clock += dt;
  flock.step(dt);
  acc += dt;
  if (acc < HOST_STEP) return;
  acc = 0;
  const p = runtime.player;
  const isBusy = busy();
  for (const h of hosts) {
    const d = distTo(h, p.x, p.z);
    const inside = d <= h.range;
    try {
      if (inside) {
        const ctx = ctxFor(h, p.x, p.y, p.z, d, isBusy);
        if (!active.has(h.id)) { active.add(h.id); h.enter?.(ctx); }
        h.update?.(ctx);
        lastUpdate.set(h.id, clock);
      } else if (active.has(h.id)) {
        active.delete(h.id);
        h.leave?.(ctxFor(h, p.x, p.y, p.z, d, isBusy));
      }
    } catch (error) { if (import.meta.env?.DEV) console.error('[opus-bay eggs] host', h.id, error); }
  }
  props.step(clock);
}

/** The hosts listed now (QA / tests). */
export const liveHosts = (): readonly EggHost[] => hosts;
export const activeHosts = (): string[] => [...active];
export const hostClock = () => clock;

/** Start the hosts: the frame system, the event fan-out, the prompts. Returns the undo. */
export function startHosts(list: readonly EggHost[]): () => void {
  hosts = [...list];
  const offFrame = registerFrameSystem('eggs', dt => stepHosts(dt), 20);
  const offEvents = onEvent(e => {
    if (e.type === 'find' || e.type === 'reward' || e.type === 'coins') return;
    const p = runtime.player;
    const isBusy = busy();
    for (const h of hosts) {
      if (!h.onEvent) continue;
      try { h.onEvent(e, ctxFor(h, p.x, p.y, p.z, distTo(h, p.x, p.z), isBusy)); } catch (error) { if (import.meta.env?.DEV) console.error('[opus-bay eggs] event', h.id, error); }
    }
  });
  const offPrompts = registerInteractables('eggs', () => hosts.flatMap(h => { try { return h.interactables?.() ?? []; } catch { return []; } }));
  return () => {
    offFrame(); offEvents(); offPrompts();
    for (const t of lineTimers) clearTimeout(t);
    lineTimers = [];
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = null;
    for (const h of hosts) { try { h.dispose?.(); } catch { /* keep tearing down */ } }
    hosts = [];
    active.clear();
    lastUpdate.clear();
    flock.stop();
  };
}

/** tests: forget the session state */
export function __resetHostsForTests(): void {
  sessionFound.clear(); repeatSaid.clear(); active.clear(); lastUpdate.clear(); clock = 0; acc = 0; hosts = [];
}
