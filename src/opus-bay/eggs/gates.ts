import { bayParts, type BayParts } from '../game/bayNow';

/**
 * Wave 5 · lane D (W5-D2) · date and month gates for the eggs, all on Bay time (game/bayNow.ts: one `?date=` in DEV / QA
 * builds moves every gate together; node tests use `__setBayNowForTests`). Pure apart from the clock, plus a small
 * per-viewer "once a Bay day" memory in localStorage (a convenience: the phone rings once a day, one cookie a day; losing
 * it only means the phone may ring again).
 */

/** The Bay month (1–12) is one of `months`. */
export const inMonths = (months: readonly number[], p: BayParts = bayParts()): boolean => months.includes(p.month);

/** The Bay date is `month`/`day` and the Bay hour is in [fromHour, toHour). */
export function onDay(month: number, day: number, fromHour = 0, toHour = 24, p: BayParts = bayParts()): boolean {
  return p.month === month && p.day === day && p.hour >= fromHour && p.hour < toHour;
}

/** The Bay year is `year`. */
export const inYear = (year: number, p: BayParts = bayParts()): boolean => p.year === year;

/** A stable 0 … 1 value for (Bay date, salt): the same all day for every player, different the next day. */
export function dayRoll(salt: string, dateKey: string = bayParts().dateKey): number {
  // FNV-1a over "salt|date", then a final avalanche (small inputs spread evenly)
  let h = 0x811c9dc5;
  const s = `${salt}|${dateKey}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Present on about `share` of days (0 … 1), decided by the Bay date (the labyrinth: ≈ 70 %). */
export const presentToday = (salt: string, share: number, dateKey?: string): boolean => dayRoll(salt, dateKey) < share;

/** The Bay hour as a number with minutes (13.5 = 13:30). */
export const bayHour = (p: BayParts = bayParts()): number => p.hour + p.minute / 60;

/** The sea-lion month words (PIER 39: numbers rise and fall with the seasons; June–July most leave to breed). */
export type SeaLionMonth = 'away' | 'returning' | 'home';
export function seaLionMonth(p: BayParts = bayParts()): SeaLionMonth {
  if (p.month === 6 || p.month === 7) return 'away';
  if (p.month === 8) return 'returning';
  return 'home';
}

// --- once a Bay day (per viewer) --------------------------------------------------------------------------------

const KEY = 'opus-bay:eggs:daily:v1';
let memory: Record<string, string> | null = null;

function load(): Record<string, string> {
  if (memory) return memory;
  memory = {};
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) if (typeof v === 'string' && /^[a-z0-9:-]{1,40}$/.test(k)) memory[k] = v;
    }
  } catch { /* private mode / blocked storage: memory only */ }
  return memory;
}

/** True when `key` has already been used on today's Bay date. */
export const usedToday = (key: string, dateKey: string = bayParts().dateKey): boolean => load()[key] === dateKey;

/** Mark `key` as used today (returns false when it already was). */
export function markToday(key: string, dateKey: string = bayParts().dateKey): boolean {
  const m = load();
  if (m[key] === dateKey) return false;
  m[key] = dateKey;
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(m)); } catch { /* keep it in memory */ }
  return true;
}

/** tests: forget the daily memory */
export function __resetDailyForTests(): void { memory = null; }
