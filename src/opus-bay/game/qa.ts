import { game, type Quality, type TimeOfDay, type WorldMode } from '../core/store';
import { bayNow, bayParts } from './bayNow';

/**
 * URL hooks (DESIGN.md §12): ?start ?time ?quality ?debug ?at (city extras: ?save=off in data/save.ts, ?discover=all in
 * game/discovery.ts; wave 5, DEV / QA builds only: ?date=YYYY-MM-DDTHH:mm in game/bayNow.ts moves the Bay clock)
 */
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

// ---------------------------------------------------------------------------
// Wave 5 · lane R (W5-R1): San Francisco's real sun
// ---------------------------------------------------------------------------

/**
 * Where the sun is computed: San Francisco (Civic Center); across the city the times differ by < 30 s.
 * The maths is NOAA's solar calculator (the Meeus-based spreadsheet equations: declination and the equation of time
 * from the Julian century, refraction-corrected horizon 90.833°, civil twilight 96°). Checked on 2026-09-28 against the
 * US Naval Observatory (aa.usno.navy.mil/api/rstt/oneday at these coordinates) on 14 dates from Sep 2026 to Jun 2027:
 * every sunrise, sunset and civil twilight within 1 minute (tests/opus-bay-w5-sun.test.ts).
 * It sits here (≈ 1 KB in the main graph, plan D16) because both writers of store.timeOfDay read bayTimeOfDay; the
 * lanes read the sun through realsf/sun.ts.
 */
export const SF_SUN = { lat: 37.7749, lng: -122.4194 } as const;

const RAD = Math.PI / 180;

/** The sun's declination (rad) and the equation of time (minutes) at an instant (ms). */
export function solarAt(ms: number): { decl: number; eqt: number } {
  const T = (ms / 864e5 + 2440587.5 - 2451545) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = (357.52911 + T * (35999.05029 - 0.0001537 * T)) * RAD;
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M) * (0.019993 - 0.000101 * T) + Math.sin(3 * M) * 0.000289;
  const om = (125.04 - 1934.136 * T) * RAD;
  const lam = (L0 + C - 0.00569 - 0.00478 * Math.sin(om)) * RAD;
  const eps = (23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om)) * RAD;
  const y = Math.tan(eps / 2) ** 2, L = L0 * RAD;
  const eqt = (4 / RAD) * (y * Math.sin(2 * L) - 2 * e * Math.sin(M) + 4 * e * y * Math.sin(M) * Math.cos(2 * L) - 0.5 * y * y * Math.sin(4 * L) - 1.25 * e * e * Math.sin(2 * M));
  return { decl: Math.asin(Math.sin(eps) * Math.sin(lam)), eqt };
}

/**
 * When the sun's centre crosses `zenithDeg` on a Bay calendar day (ms), rising (morning) or setting (evening); NaN when
 * it never does. The day is taken from 00:00 UTC of that date: SF's solar noon (≈ 20:10 UTC) sits inside it, so the
 * morning and evening events of Bay date y-m-d come out on that date (the evening ones past 24:00 UTC).
 */
export function sunCrossing(y: number, m: number, d: number, zenithDeg: number, rising: boolean, at: { lat: number; lng: number } = SF_SUN): number {
  const day0 = Date.UTC(y, m - 1, d);
  let t = day0 + (720 - 4 * at.lng) * 60_000;
  for (let i = 0; i < 3; i++) {
    const { decl, eqt } = solarAt(t);
    const c = Math.cos(zenithDeg * RAD) / (Math.cos(at.lat * RAD) * Math.cos(decl)) - Math.tan(at.lat * RAD) * Math.tan(decl);
    if (c > 1 || c < -1) return Number.NaN;
    const ha = Math.acos(c) / RAD;
    t = day0 + (720 - 4 * (at.lng + (rising ? ha : -ha)) - eqt) * 60_000;
  }
  return t;
}

/** A Bay day's sun (ms): civil dawn, sunrise, the afternoon 6° mark (golden light starts), sunset, civil dusk. */
export interface SunDay { dateKey: string; dawn: number; sunrise: number; golden: number; sunset: number; dusk: number }

const sunDays = new Map<string, SunDay>();
/** The sun of the Bay date `dateKey` ('YYYY-MM-DD'), cached. */
export function sunDay(dateKey: string): SunDay {
  let s = sunDays.get(dateKey);
  if (s) return s;
  const [y, m, d] = dateKey.split('-').map(Number);
  s = {
    dateKey,
    dawn: sunCrossing(y, m, d, 96, true),
    sunrise: sunCrossing(y, m, d, 90.833, true),
    golden: sunCrossing(y, m, d, 84, false),
    sunset: sunCrossing(y, m, d, 90.833, false),
    dusk: sunCrossing(y, m, d, 96, false),
  };
  if (sunDays.size > 64) sunDays.clear();
  sunDays.set(dateKey, s);
  return s;
}

/** The district's bands (unchanged since wave 1): morning 6–10, day 10–16, golden 16–19, night 19–6. */
export function fixedHourBand(now: Date = bayNow()): TimeOfDay {
  const p = bayParts(now);
  const hour = p.hour + p.minute / 60;
  if (hour >= 6 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19) return 'golden';
  return 'night';
}

/**
 * The band the real sun gives an instant (plan §3.3 item 3): night until civil dawn; morning until 3 h after sunrise;
 * day until the sun is 6° up in the afternoon (≈ 35 min before sunset); golden until civil dusk; then night.
 */
export function realSunBand(now: Date = bayNow()): TimeOfDay {
  const t = now.getTime();
  const s = sunDay(bayParts(now).dateKey);
  if (![s.dawn, s.sunrise, s.golden, s.dusk].every(Number.isFinite)) return fixedHourBand(now);
  if (t < s.dawn || t >= s.dusk) return 'night';
  if (t < s.sunrise + 3 * 3_600_000) return 'morning';
  if (t < s.golden) return 'day';
  return 'golden';
}

/**
 * Real Bay Area clock → rendered time of day; both writers of store.timeOfDay (ui/Overlay.tsx `useTimeOfDay`,
 * game/flow.ts `offerRealTime`) read it, so they always agree. City mode follows San Francisco's real sun
 * (`realSunBand`); district mode keeps its fixed hour bands (the district never changes). The clock is `bayNow()`:
 * DEV / QA builds shift it with `?date=YYYY-MM-DDTHH:mm`. Settings' fixed time, `?time=` and the first-visit golden rule
 * are applied by the callers and still win.
 */
export function bayTimeOfDay(now: Date = bayNow(), world: WorldMode = game.get().worldMode): TimeOfDay {
  return world === 'city' ? realSunBand(now) : fixedHourBand(now);
}
