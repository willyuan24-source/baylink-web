/**
 * Wave 5 (FROZEN at day 0, plan sf-w5-plan.md §4.2 W5-0d) · Bay time for every lane.
 *
 *   bayNow()        the real time, as a Date. DEV and QA builds only: `?date=YYYY-MM-DDTHH:mm` (Bay wall-clock time,
 *                   America/Los_Angeles) shifts it — the clock starts at that Bay time when the page reads it and runs
 *                   on in real time. Production builds never read the parameter.
 *   bayParts(d?)    the Bay wall-clock parts of `d` (default bayNow()): year, month 1–12, day 1–31, hour 0–23,
 *                   minute 0–59, weekday 0 = Sunday … 6 = Saturday, dateKey 'YYYY-MM-DD' (the Bay date: daily refills,
 *                   今日三件小事, once-a-Bay-day lines).
 *
 * Every wave-5 feature that depends on the real day or hour (the sun, events in their window, the fire-ring season,
 * Fleet Week, eggs by month, daily coins) reads the time through here, so one `?date=` moves all of them together.
 *
 * "QA build" = a production build made with `VITE_OPUS_QA=1` in the environment (the lead's phone package for a dated
 * check). The shipped site is built without it: `?date=` does nothing there.
 *
 * Dependency-free (no game modules): data, world and UI code may all import it.
 */

export const BAY_TZ = 'America/Los_Angeles';

export interface BayParts { year: number; month: number; day: number; hour: number; minute: number; weekday: number; dateKey: string }

/** `?date=` format: the Bay wall-clock minute. */
export const BAY_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** DEV (vite dev server) or a QA build (VITE_OPUS_QA=1). Node tests: neither (import.meta.env is undefined there). */
export function bayDateOverrideAllowed(): boolean {
  const env = import.meta.env as { DEV?: boolean; VITE_OPUS_QA?: string } | undefined;
  return !!env && (env.DEV === true || env.VITE_OPUS_QA === '1');
}

let fmt: Intl.DateTimeFormat | null = null;
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
let cacheMinute = Number.NaN;
let cacheParts: BayParts | null = null;

const pad = (n: number) => String(n).padStart(2, '0');

/** The Bay wall-clock parts of `d` (default: bayNow()). Cached per real minute (cheap to call every frame). */
export function bayParts(d?: Date): BayParts {
  let t = (d ?? bayNow()).getTime();
  if (!Number.isFinite(t)) t = Date.now();
  const minute = Math.floor(t / 60_000);
  if (minute === cacheMinute && cacheParts) return { ...cacheParts };
  fmt ??= new Intl.DateTimeFormat('en-US', {
    timeZone: BAY_TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23',
  });
  const out: BayParts = { year: 0, month: 0, day: 0, hour: 0, minute: 0, weekday: 0, dateKey: '' };
  for (const p of fmt.formatToParts(new Date(minute * 60_000))) {
    switch (p.type) {
      case 'year': out.year = Number(p.value); break;
      case 'month': out.month = Number(p.value); break;
      case 'day': out.day = Number(p.value); break;
      case 'hour': out.hour = Number(p.value) % 24; break;
      case 'minute': out.minute = Number(p.value); break;
      case 'weekday': out.weekday = WEEKDAY[p.value] ?? 0; break;
    }
  }
  out.dateKey = `${out.year}-${pad(out.month)}-${pad(out.day)}`;
  cacheMinute = minute;
  cacheParts = out;
  return { ...out };
}

/**
 * A Bay wall-clock minute ('2026-10-03T10:30') → the real instant, or null when the text is not a real Bay minute.
 * DST: a minute that does not exist (the spring-forward hour) resolves an hour later; a repeated minute (fall back)
 * resolves to its first (daylight) occurrence.
 */
export function parseBayDate(spec: string): Date | null {
  const m = BAY_DATE_RE.exec(spec.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const want = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(want);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null; // 2026-02-30
  // start from PDT (UTC−7): the earlier of the two offsets, so a repeated fall-back minute resolves to its first occurrence
  let guess = want + 7 * 3_600_000;
  for (let i = 0; i < 3; i++) {
    const p = bayParts(new Date(guess));
    const diff = want - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

/** ms added to the real clock (0 in production); null until first read. */
let offsetMs: number | null = null;

function readOverride(): number {
  if (!bayDateOverrideAllowed()) return 0;
  try {
    const search = (globalThis as { location?: { search?: string } }).location?.search ?? '';
    const spec = new URLSearchParams(search).get('date');
    const at = spec ? parseBayDate(spec) : null;
    return at ? at.getTime() - Date.now() : 0;
  } catch { return 0; }
}

/** The real time (DEV / QA builds: shifted by `?date=`). */
export function bayNow(): Date {
  offsetMs ??= readOverride();
  return new Date(Date.now() + offsetMs);
}

/**
 * Tests and node QA scripts only (never product code): pretend the Bay clock reads `spec` now ('YYYY-MM-DDTHH:mm' Bay
 * time, or an instant). `null` forgets any shift (the URL is read again on the next bayNow()). Returns false for a
 * spec that does not parse (nothing changes then).
 */
export function __setBayNowForTests(spec: string | Date | null): boolean {
  if (spec === null) { offsetMs = null; return true; }
  const at = typeof spec === 'string' ? parseBayDate(spec) : Number.isFinite(spec.getTime()) ? spec : null;
  if (!at) return false;
  offsetMs = at.getTime() - Date.now();
  return true;
}
