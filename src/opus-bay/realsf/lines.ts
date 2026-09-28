import type { Bilingual } from '../core/types';

/**
 * Wave 5 · lane R · BAYBAY's real-San-Francisco lines, at most once per key per Bay day (plan §3.3: the sunset line,
 * one line per event per Bay day on zone entry). Pure scheduling + a small localStorage memory
 * (`opus-bay:realsf:v1` = { d: Bay date, said: keys }); a new Bay date forgets yesterday. `?save=off` or a blocked
 * storage keeps the memory for this page only.
 */

export const REALSF_MEMORY_KEY = 'opus-bay:realsf:v1';
const KEY_RE = /^[a-z0-9:-]{1,80}$/;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export interface DayMemory {
  has(day: string, key: string): boolean;
  add(day: string, key: string): void;
}

function defaultStorage(): Store | null {
  try {
    if (typeof location !== 'undefined' && /[?&]save=off(?:&|$)/.test(location.search)) return null;
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch { return null; }
}

/** Once-per-Bay-day memory. */
export function createDayMemory(storage: Store | null = defaultStorage()): DayMemory {
  let day = '';
  let said = new Set<string>();
  try {
    const raw = storage?.getItem(REALSF_MEMORY_KEY);
    const v = raw ? JSON.parse(raw) as { d?: unknown; said?: unknown } : null;
    if (v && typeof v.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.d) && Array.isArray(v.said)) {
      day = v.d;
      said = new Set(v.said.filter((k): k is string => typeof k === 'string' && KEY_RE.test(k)).slice(0, 64));
    }
  } catch { /* unreadable: start empty */ }
  const roll = (d: string) => { if (d !== day) { day = d; said = new Set(); } };
  return {
    has: (d, key) => { roll(d); return said.has(key); },
    add: (d, key) => {
      roll(d);
      if (!KEY_RE.test(key) || said.has(key)) return;
      said.add(key);
      try { storage?.setItem(REALSF_MEMORY_KEY, JSON.stringify({ d: day, said: [...said].slice(-64) })); } catch { /* full or blocked */ }
    },
  };
}

/** A line on offer now: its once-a-day key and its text. */
export interface OfferedLine { key: string; text: Bilingual }

/** Gates the scheduler reads each step (the same ones as BAYBAY's city lines, game/baybayLines.ts). */
export interface LineGates { silent: boolean; bubble: boolean; quiet: boolean }

/** Space between two of these lines, and after anyone's bubble (s). */
export const REALSF_LINE_GAP = 20;
export const REALSF_BUBBLE_SETTLE = 1.5;

/**
 * Picks at most one line per step: the first offered line not yet said today, never while silent / quiet, never with a
 * bubble on screen or within REALSF_BUBBLE_SETTLE s after one, and REALSF_LINE_GAP s after its own last line.
 */
export class RealLineScheduler {
  private lastSaid = -Infinity;
  private bubbleGoneAt = -Infinity;
  private hadBubble = false;
  private readonly mem: DayMemory;
  constructor(mem: DayMemory) { this.mem = mem; }

  step(now: number, day: string, gates: LineGates, offered: readonly OfferedLine[]): OfferedLine | null {
    if (gates.bubble) { this.hadBubble = true; return null; }
    if (this.hadBubble) { this.hadBubble = false; this.bubbleGoneAt = now; }
    if (gates.silent || gates.quiet) return null;
    if (now - this.bubbleGoneAt < REALSF_BUBBLE_SETTLE || now - this.lastSaid < REALSF_LINE_GAP) return null;
    const line = offered.find(l => !this.mem.has(day, l.key));
    if (!line) return null;
    this.mem.add(day, line.key);
    this.lastSaid = now;
    return line;
  }
}
