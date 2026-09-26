import type { Quality, TimeOfDay } from '../core/store';

/** URL hooks (DESIGN.md §12): ?start ?time ?quality ?debug ?at */
export type StartMode = 'tour' | 'week' | 'free' | 'local';
export interface QaParams { start?: StartMode; time?: TimeOfDay; quality?: Quality; debug: boolean; at?: string }

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
    at: at && /^[a-z0-9-]{1,64}$/i.test(at) ? at : undefined,
  };
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
