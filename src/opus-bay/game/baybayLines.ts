import { emit, onEvent, type GameEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import {
  EVENT_LINES, type LineEvent, type NeighbourhoodLine, type SpokenLine, lineMs, neighbourhoodGreeting, neighbourhoodLine,
} from '../data/sf/lines';
import { sfLandmark } from '../world/sf/landmarks/index';
import { cityStreamerLazy } from '../world/cityLoader';
import { baybayHeld } from './baybayHold';
import { cinemaActive } from './cinema';
import { travelActive } from './fastTravel';
import { bubble, dialogueOpen } from './flow';
import { flow } from './flowStore';
import { BAYBAY_ID } from './interactables';
import { registerFrameSystem } from './systemsRegistry';

/**
 * BAYBAY's event and neighbourhood lines in city mode (lane G2, plan G2-4). Loaded lazily by game/cityContent.ts
 * (city mode only, so none of this is in the GameRoot graph). The lines are data/sf/lines.ts.
 *
 *   LineScheduler      pure (a fake clock in tests/opus-bay-sf-lines.test.ts): what may be said now
 *   createLineMemory   the once-per-save memory (`opus-bay:lines:v1`; `?save=off` keeps it in memory)
 *   initBaybayLines()  core events → scheduler; a 5 Hz frame system checks the gates, shows the bubble and emits
 *                      `{ type: 'voice-line', id }` next to it (audio plays H2b's clip, or a chirp)
 *
 * Rules: 60 s per key (a line's `cooldown` may be longer), at least 8 s between two of these lines, never while a
 * bubble is on screen (anyone's) nor within 1 s after one, silent in dialogue / cinematics / fast travel / photo mode /
 * postcard rewards / open panels / the overlays and activities of game/baybayHold.ts (W8-K1) / the local "quiet"
 * start (a line waits there until its `ttl` runs out); a
 * neighbourhood greeting waits while you are in that neighbourhood, and while you glide it is held and only the
 * neighbourhood you land in is greeted.
 */

export const LINE_GAP = 8;
export const KEY_COOLDOWN = 60;
/** a line never follows another bubble closer than this (s) */
export const BUBBLE_SETTLE = 1;
const MAX_PENDING = 4;

/** Once-per-save memory of spent lines (a `once` key, `zone-<id>`). */
export interface LineMemory {
  has(key: string): boolean;
  add(key: string): void;
  clear(): void;
}

export const LINE_MEMORY_KEY = 'opus-bay:lines:v1';
const MEMORY_MAX = 256;
const KEY_RE = /^[a-z0-9:-]{1,80}$/;

/** The save's line memory in localStorage (a missing / blocked storage or `?save=off` keeps it for this page only). */
export function createLineMemory(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = defaultStorage()): LineMemory {
  const said = new Set<string>();
  try {
    const raw = storage?.getItem(LINE_MEMORY_KEY);
    const v = raw ? JSON.parse(raw) as { v?: number; said?: unknown } : null;
    if (v && v.v === 1 && Array.isArray(v.said)) for (const k of v.said.slice(0, MEMORY_MAX)) if (typeof k === 'string' && KEY_RE.test(k)) said.add(k);
  } catch { /* unreadable: start empty */ }
  const write = () => {
    try { storage?.setItem(LINE_MEMORY_KEY, JSON.stringify({ v: 1, said: [...said].slice(-MEMORY_MAX) })); } catch { /* full or blocked */ }
  };
  return {
    has: key => said.has(key),
    add: key => { if (said.has(key) || !KEY_RE.test(key)) return; said.add(key); write(); },
    clear: () => { said.clear(); try { storage?.removeItem(LINE_MEMORY_KEY); } catch { /* blocked */ } },
  };
}

function defaultStorage(): Storage | null {
  try {
    if (typeof location !== 'undefined' && /[?&]save=off(?:&|$)/.test(location.search)) return null;
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch { return null; }
}

/** What the scheduler needs to know about the game right now. */
export interface LineGates {
  /** nothing may be said: dialogue, cinematic, fast travel, photo mode, a postcard reward, a panel, not playing */
  silent: boolean;
  /** a speech bubble is on screen (BAYBAY's, an NPC's, lane F's …) */
  bubble: boolean;
  /** on the pelican: neighbourhood greetings are held */
  gliding: boolean;
  /** the "I'm a local" quiet minute: lines wait */
  quiet: boolean;
}

/** A line ready to be said. */
export interface PlayLine { key: string; voice: string; text: Bilingual; emote?: SpokenLine['emote']; zone?: string }

interface Pending { line: SpokenLine; at: number; ready: number; until: number }

/** The pure line picker: offers come in from events, `step` decides what is said (times in seconds). */
export class LineScheduler {
  private readonly memory: LineMemory;
  private readonly pending: Pending[] = [];
  private zoneId: string | null = null;
  private zoneLine: NeighbourhoodLine | null = null;
  private lastLine = -Infinity;
  private lastBubble = -Infinity;
  private readonly lastByKey = new Map<string, number>();

  constructor(memory: LineMemory) { this.memory = memory; }

  /** The line an event would say now (first unspent `once`, else the repeat), or null. */
  lineFor(event: LineEvent): SpokenLine | null {
    return EVENT_LINES[event].find(line => !(line.once && this.memory.has(line.key))) ?? null;
  }

  /** Something happened: queue its line (one per key; a key still cooling down is not queued). */
  offer(event: LineEvent, now: number): boolean {
    const line = this.lineFor(event);
    if (!line) return false;
    if (this.pending.some(p => p.line.key === line.key)) return false;
    if (now - (this.lastByKey.get(line.key) ?? -Infinity) < (line.cooldown ?? KEY_COOLDOWN)) return false;
    this.pending.push({ line, at: now, ready: now + (line.after ?? 0), until: now + line.ttl });
    if (this.pending.length > MAX_PENDING) {
      this.pending.sort((a, b) => b.line.priority - a.line.priority || a.at - b.at);
      this.pending.length = MAX_PENDING;
    }
    return true;
  }

  /**
   * The neighbourhood under the player (far.zones id, or null outside every one): its greeting waits while you stay.
   * `line` is its authored line or the template (null = nothing to say there).
   */
  zone(id: string | null, line: NeighbourhoodLine | null) {
    if (id === this.zoneId && (line?.zone ?? null) === (this.zoneLine?.zone ?? null)) return;
    this.zoneId = id;
    this.zoneLine = id && line && !this.memory.has(zoneKey(id)) ? line : null;
  }

  /** Lines waiting (tests / QA). */
  waiting(): { keys: string[]; zone: string | null } { return { keys: this.pending.map(p => p.line.key), zone: this.zoneLine?.zone ?? null }; }

  /** Once per tick: drop stale lines, and return the line to say now (recorded as said), or null. */
  step(now: number, g: LineGates): PlayLine | null {
    for (let i = this.pending.length - 1; i >= 0; i--) if (now > this.pending[i].until) this.pending.splice(i, 1);
    if (g.bubble) { this.lastBubble = now; return null; }
    if (g.silent || g.quiet) return null;
    if (now - this.lastLine < LINE_GAP || now - this.lastBubble < BUBBLE_SETTLE) return null;
    const zonePriority = 2;
    let best: Pending | null = null;
    for (const p of this.pending) if (!best || p.line.priority > best.line.priority || (p.line.priority === best.line.priority && p.at < best.at)) best = p;
    // a line that waits a moment on purpose (`after`, e.g. the glide lines after the take-off whoosh) keeps its turn
    if (best && now < best.ready) return null;
    const zone = this.zoneLine && !g.gliding ? this.zoneLine : null;
    if (zone && (!best || zonePriority >= best.line.priority)) {
      this.zoneLine = null;
      this.memory.add(zoneKey(zone.zone));
      this.lastLine = now;
      return { key: zoneKey(zone.zone), voice: zone.voice, text: zone.text, emote: 'wave', zone: zone.zone };
    }
    if (!best) return null;
    this.pending.splice(this.pending.indexOf(best), 1);
    const line = best.line;
    if (line.once) this.memory.add(line.key);
    this.lastByKey.set(line.key, now);
    this.lastLine = now;
    return { key: line.key, voice: line.voice, text: line.text, emote: line.emote };
  }
}

export const zoneKey = (zone: string) => `zone-${zone}`;

// ---------------------------------------------------------------------------------------------------------------
// Runtime wiring (city mode)
// ---------------------------------------------------------------------------------------------------------------

/** core event → line event (null: nothing to say) */
export function lineEventOf(ev: GameEvent, onFoot: boolean): LineEvent | null {
  switch (ev.type) {
    case 'vehicle:enter': return ev.vehicle === 'bike' ? 'bike' : 'car';
    case 'vehicle:bump': return ev.hard ? 'bump' : null;
    case 'vehicle:refuse': return ev.surface === 'stairs' ? 'stairs' : null;
    case 'vehicle:hop': return ev.crest ? 'crest' : null;
    case 'hill': return 'hill';
    case 'pant': return 'pant';
    case 'glide:start': return 'glide';
    case 'glide:land': return 'glide-land';
    case 'glide:no-landing': return 'glide-no-landing';
    case 'transit':
      if (ev.kind === 'cable-car') {
        if (ev.what === 'depart') return 'cable-ride';
        if (ev.what === 'push') return 'push';
        // a car ringing close by while you walk (your own car's bell is part of the ride)
        if (ev.what === 'bell' && onFoot && (ev.strength ?? 1) >= 0.4) return 'cable-bell';
        return null;
      }
      if (ev.kind === 'ferry') return ev.what === 'depart' || ev.what === 'board' ? 'ferry' : null;
      if (ev.kind === 'streetcar') return ev.what === 'depart' || ev.what === 'board' ? 'fline' : null;
      return null;
    default: return null;
  }
}

/** The far.zones neighbourhood (id + HUD name) of an area id, or null (landmark areas, hero zones, outside). */
function farZone(area: string | null): { id: string; name: Bilingual } | null {
  if (!area) return null;
  const z = cityStreamerLazy()?.far?.zones.find(item => item.id === area);
  return z ? { id: z.id, name: { zh: z.zh, en: z.en } } : null;
}

function zoneLineAt(area: string | null, p: { x: number; z: number }): { id: string | null; line: NeighbourhoodLine | null } {
  const zone = farZone(area);
  if (!zone) return { id: area, line: null };
  const line = neighbourhoodLine(zone.id) ?? neighbourhoodGreeting(zone.id, zone.name);
  if (line.near) {
    const l = sfLandmark(line.near.landmark);
    // not there yet: a distinct id, so walking up to the landmark counts as arriving
    if (l && Math.hypot(p.x - l.x, p.z - l.z) > line.near.r) return { id: `${zone.id}@far`, line: null };
  }
  return { id: zone.id, line };
}

let memory: LineMemory | null = null;

/** Settings → reset progress (lane G1): the firsts and greetings may be said again. */
export function clearLineMemory() { (memory ??= createLineMemory()).clear(); }

/** City mode, once per page (game/cityContent.ts initCityContent): wire the lines. Returns the disposer. */
export function initBaybayLines(): () => void {
  const mem = (memory ??= createLineMemory());
  const sched = new LineScheduler(mem);
  const now = () => performance.now() / 1000;
  const onFoot = () => { const m = game.get().move.mode; return m === 'foot' || m === 'sit' || m === 'photo'; };
  const offEvents = onEvent(ev => {
    const e = lineEventOf(ev, onFoot());
    if (e) sched.offer(e, now());
  });
  let acc = 0;
  const offFrame = registerFrameSystem('g2-baybay-lines', dt => {
    if ((acc += dt) < 0.2) return;
    acc = 0;
    const s = game.get(), f = flow.get(), t = now(), p = runtime.player;
    // the hero F-line (no transit events of its own): the first time the car rolls with you on it
    if (f.ride && !f.ride.line && f.ride.stage === 'riding') sched.offer('fline', t);
    const travelling = travelActive() || s.move.mode === 'travel';
    if (!travelling) { const z = zoneLineAt(s.area, p); sched.zone(z.id, z.line); }
    const line = sched.step(t, {
      silent: s.phase !== 'playing' || s.paused || dialogueOpen() || cinemaActive() || !!f.cinematic || travelling || s.photoMode
        || !!f.postcardReward || !!f.postcardFly || !!f.fishing || s.panel.kind !== null
        // W8-K1: a play panel, an egg card, the Halloween postcard, hide & seek, the kite… (game/baybayHold.ts)
        || baybayHeld(),
      bubble: !!f.bubble,
      gliding: s.move.mode === 'glide',
      quiet: performance.now() < f.quietUntil,
    });
    if (!line) return;
    // (W8-K1) the voice only with its bubble on screen
    if (!bubble(line.text, lineMs(line.text), BAYBAY_ID, 'bark')) return;
    emit({ type: 'voice-line', id: line.voice });
    // a gesture only while she walks beside you (in the basket, the car or on the pelican she just talks)
    if (line.emote && (s.move.mode === 'foot' || s.move.mode === 'sit')) {
      runtime.guide.emote = line.emote;
      emit({ type: 'emote', who: 'baybay', emote: line.emote });
    }
  }, 5);
  let offDev = () => {};
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    const api = { waiting: () => sched.waiting(), offer: (e: LineEvent) => sched.offer(e, now()), memory: mem, said: (k: string) => mem.has(k) };
    const put = () => { if (!w.__opusBay) w.__opusBay = { lines: api }; else if (w.__opusBay.lines !== api) w.__opusBay.lines = api; };
    put();
    const id = window.setInterval(put, 500);
    offDev = () => window.clearInterval(id);
  }
  return () => { offEvents(); offFrame(); offDev(); };
}
