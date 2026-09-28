import type { Bilingual } from '../core/types';
import { bayNow, bayParts } from '../game/bayNow';
import { fetchSfJson } from './sameSite';

/**
 * Wave 5 · lane R (W5-R7) · San Francisco's real tides (plan §3.3 "tides baked"): NOAA CO-OPS predictions for station
 * 9414290 San Francisco (Golden Gate), the high and low waters in feet above MLLW, baked at build time by
 * scripts/opus-sf/export-tides.ts into the same-site `public/opus-bay/sf/v1/tides.json` (15 months, ≈ 6 KB gzip). No
 * runtime call leaves the site. Between two extremes the level follows a half cosine (the usual tide-table rule); past
 * the file's end there is nothing (every function answers null / [] / the neutral value).
 *
 *   loadTides()              fetch the file once (city mode, idle); tideTable() → the parsed table or null
 *   tideAt(ms)               the predicted level (ft MLLW) at an instant
 *   tidesOnDay(dateKey)      the day's highs and lows (Bay date)
 *   nextTide(ms, kind?)      the next extreme (of a kind)
 *   tideLoudness(ms)         0.25 … 1 for sound that swells with the water (lane D's Wave Organ)
 *
 * Uses: the 今天 tab's tide row (today's highs and lows, the Lands End wrecks at a low tide, the safety line), lane D's
 * Wave Organ louder near high tide (`setOrganTide`), the king-tide spray on the Embarcadero (realsf/dressing.ts).
 */

export interface TideExtreme { ms: number; ft: number; kind: 'H' | 'L' }
export interface TideTable { station: string; source: string; fetched: string; ex: TideExtreme[] }

export const TIDE_SOURCE = { label: 'NOAA Tides & Currents · 9414290', url: 'https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=9414290', verifiedAt: '2026-09-28' } as const;
/** "Their engines are still visible at low tide." — NOAA, the Frank H. Buck (1937) and Lyman Stewart (1922) off Lands End */
export const WRECKS_SOURCE = { label: 'oceanservice.noaa.gov', url: 'https://oceanservice.noaa.gov/news/oct14/shipwrecks.html', verifiedAt: '2026-09-28' } as const;
/** "the water is frigid and the currents hazardous" — NPS, Ocean Beach */
export const COAST_SAFETY_SOURCE = { label: 'nps.gov', url: 'https://www.nps.gov/goga/planyourvisit/oceanbeach.htm', verifiedAt: '2026-09-28' } as const;
/** "The sound is best heard at high tide." (en.wikipedia.org, Wave Organ) */
export const WAVE_ORGAN_SOURCE = { label: 'en.wikipedia.org', url: 'https://en.wikipedia.org/wiki/Wave_Organ', verifiedAt: '2026-09-28' } as const;
export const COAST_SAFETY: Bilingual = { zh: '海水冰冷、水流危险：别下水，别爬礁石', en: 'Cold water, dangerous currents: stay out, off the rocks' };
/** a low tide at or under this (ft MLLW) shows the wrecks' engines at Lands End (a practical mark, "about") */
export const WRECK_LOW_FT = 1;

/** Parse the baked file (untrusted input): null unless every field checks out. */
export function parseTides(raw: unknown): TideTable | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const { t0, dt, h, k } = r;
  if (typeof t0 !== 'number' || !Number.isFinite(t0) || !Array.isArray(dt) || !Array.isArray(h) || typeof k !== 'string') return null;
  if (dt.length !== h.length || h.length !== k.length || !h.length || h.length > 4000) return null;
  const ex: TideExtreme[] = [];
  let ms = t0;
  for (let i = 0; i < h.length; i++) {
    const d = dt[i], v = h[i], kind = k[i];
    if (typeof d !== 'number' || typeof v !== 'number' || !Number.isFinite(d) || !Number.isFinite(v) || d < 0 || d > 24 * 60 || (kind !== 'H' && kind !== 'L')) return null;
    if (i > 0 && d === 0) return null;
    ms += d * 60_000;
    ex.push({ ms, ft: v / 100, kind });
  }
  return {
    station: typeof r.station === 'string' ? r.station : '9414290',
    source: typeof r.source === 'string' && /^https:\/\//.test(r.source) ? r.source : TIDE_SOURCE.url,
    fetched: typeof r.fetched === 'string' ? r.fetched : '',
    ex,
  };
}

let TABLE: TideTable | null = null;
let loading: Promise<TideTable | null> | null = null;

export function tideTable(): TideTable | null { return TABLE; }
/** Tests / QA: install (or clear) the table. */
export function setTidesForTests(t: TideTable | null): void { TABLE = t; loading = t ? Promise.resolve(t) : null; }

/** Fetch the same-site tides.json once (later calls share the promise; a failure may be retried later). */
export function loadTides(fetcher?: typeof fetch): Promise<TideTable | null> {
  if (loading) return loading;
  loading = fetchSfJson('tides.json', fetcher).then(raw => {
    TABLE = parseTides(raw);
    if (!TABLE) loading = null;
    return TABLE;
  });
  return loading;
}

/** The index of the last extreme at or before `ms` (−1 before the first). */
function before(ex: readonly TideExtreme[], ms: number): number {
  let lo = 0, hi = ex.length - 1, at = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ex[mid].ms <= ms) { at = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return at;
}

/** The predicted level (ft above MLLW) at `ms`: a half cosine between the neighbouring extremes; null outside the table. */
export function tideAt(ms: number = bayNow().getTime(), table: TideTable | null = TABLE): number | null {
  if (!table) return null;
  const ex = table.ex;
  const i = before(ex, ms);
  if (i < 0 || i >= ex.length - 1) return i === ex.length - 1 && ex[i].ms === ms ? ex[i].ft : null;
  const a = ex[i], b = ex[i + 1];
  const f = (ms - a.ms) / (b.ms - a.ms);
  return a.ft + (b.ft - a.ft) * (1 - Math.cos(Math.PI * f)) / 2;
}

/** The highs and lows whose time falls on the Bay date `dateKey`, in order. */
export function tidesOnDay(dateKey: string, table: TideTable | null = TABLE): TideExtreme[] {
  if (!table) return [];
  return table.ex.filter(e => Math.abs(e.ms - Date.parse(`${dateKey}T12:00:00Z`)) < 40 * 3600_000 && bayParts(new Date(e.ms)).dateKey === dateKey);
}

/** The next extreme after `ms` (of `kind` when given), or null past the table. */
export function nextTide(ms: number = bayNow().getTime(), kind?: 'H' | 'L', table: TideTable | null = TABLE): TideExtreme | null {
  if (!table) return null;
  for (let i = Math.max(0, before(table.ex, ms) + 1); i < table.ex.length; i++) if (!kind || table.ex[i].kind === kind) return table.ex[i];
  return null;
}

/**
 * How loud water-driven sound is (0.25 … 1): the level from about 0.5 ft (quiet) to 5.5 ft (full); the neutral 0.7 when
 * there is no table (lane D's Wave Organ default).
 */
export function tideLoudness(ms: number = bayNow().getTime(), table: TideTable | null = TABLE): number {
  const ft = tideAt(ms, table);
  if (ft === null) return 0.7;
  return 0.25 + 0.75 * Math.min(1, Math.max(0, (ft - 0.5) / 5));
}

/** '1.2' feet with one decimal ('-0.3'), for the rows. */
export const ftLabel = (ft: number) => (Math.round(ft * 10) / 10).toFixed(1).replace(/^-0\.0$/, '0.0');
