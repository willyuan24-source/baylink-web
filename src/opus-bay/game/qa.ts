import type { Quality, TimeOfDay } from '../core/store';

/** URL hooks (DESIGN.md §12): ?start ?time ?quality ?debug ?at (city extras: ?save=off in data/save.ts, ?discover=all in game/discovery.ts) */
export type StartMode = 'tour' | 'week' | 'free' | 'local';
export interface QaParams { start?: StartMode; time?: TimeOfDay; quality?: Quality; debug: boolean; at?: string }

/** ?at= values: district anchors / interactable ids (`postcard:sf-painted-ladies`), place and landmark ids, ll:, xz: */
const AT_RE = /^[a-z0-9:.,-]{1,80}$/i;

export function readQa(search: string = typeof location !== 'undefined' ? location.search : ''): QaParams {
  const q = new URLSearchParams(search);
  const start = q.get('start');
  const time = q.get('time');
  const quality = q.get('quality');
  const at = q.get('at');
  return {
    start: start === 'tour' || start === 'week' || start === 'free' || start === 'local' ? start : undefined,
    time: time === 'morning' || time === 'day' || time === 'golden' || time === 'night' ? time : undefined,
    quality: quality === 'low' || quality === 'mid' || quality === 'high' ? quality : undefined,
    debug: q.get('debug') === '1' || q.get('debug') === 'true',
    at: at && AT_RE.test(at) ? at : undefined,
  };
}

/** A parsed ?at= target (G1-12). */
export type AtSpec =
  | { kind: 'id'; id: string }
  | { kind: 'll'; lat: number; lng: number }
  | { kind: 'xz'; x: number; z: number };

/** `ll:37.8024,-122.4058` · `xz:120,-40` · anything else is an id (anchor, interactable, place, `lm-<landmark>`). */
export function parseAt(at: string | undefined): AtSpec | null {
  if (!at || !AT_RE.test(at)) return null;
  const m = /^(ll|xz):(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/i.exec(at);
  if (m) {
    const a = Number(m[2]), b = Number(m[3]);
    if (m[1].toLowerCase() === 'll') return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { kind: 'll', lat: a, lng: b } : null;
    return Math.abs(a) < 1e5 && Math.abs(b) < 1e5 ? { kind: 'xz', x: a, z: b } : null;
  }
  if (/^(ll|xz):/i.test(at)) return null;
  return { kind: 'id', id: at.toLowerCase() };
}

/**
 * Real Bay Area clock → rendered time of day. Same bands the world uses (morning 6–10, day 10–16,
 * golden 16–19, night 19–6) so the two writers of store.timeOfDay always agree.
 */
export function bayTimeOfDay(now = new Date()): TimeOfDay {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 12) + Number(parts.find(p => p.type === 'minute')?.value ?? 0) / 60;
  if (hour >= 6 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19) return 'golden';
  return 'night';
}
