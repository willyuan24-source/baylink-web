/**
 * Wave 5 · lane R (W5-R7) · San Francisco's tides, baked at build time (plan §3.3 "tides baked", D13): NOAA CO-OPS tide
 * predictions for station 9414290 San Francisco (Golden Gate) — the high and low waters (`interval=hilo`), feet above
 * MLLW, times in UTC — written to `public/opus-bay/sf/v1/tides.json`. The game never calls NOAA from the player's
 * browser (production CSP `connect-src 'self'`): it reads this same-site file (realsf/tides.ts) and interpolates between
 * the extremes by a cosine.
 *
 *   npx tsx scripts/opus-sf/export-tides.ts                       # 2026-09-01 … 2027-11-30 (15 months)
 *   npx tsx scripts/opus-sf/export-tides.ts 2026-09-01 2027-11-30  # another span
 *
 * The API takes at most one year per request for these predictions, so the span is fetched in ≤ 1-year pieces, each
 * with the `application=` parameter NOAA asks for. Predictions are public domain (NOAA / NOS CO-OPS).
 *
 * The file: { station, name, datum, units, source, api, fetched, from, to, t0, dt, h, k } — `t0` the first extreme
 * (UTC ms), `dt` minutes from the previous extreme, `h` the heights in hundredths of a foot, `k` one letter per extreme
 * (H / L). About 1,800 extremes for 15 months, ≈ 7 KB gzip.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const STATION = '9414290';
const APPLICATION = 'baylink_opus_bay';
const API = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const OUT = resolve('public/opus-bay/sf/v1/tides.json');

interface Prediction { t: string; v: string; type: 'H' | 'L' }

const day = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`not a date: ${s}`);
  return new Date(`${s}T00:00:00Z`);
};
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const compact = (d: Date) => ymd(d).replace(/-/g, '');

async function fetchSpan(from: Date, to: Date): Promise<Prediction[]> {
  const params = new URLSearchParams({
    product: 'predictions', application: APPLICATION, begin_date: compact(from), end_date: compact(to), datum: 'MLLW',
    station: STATION, time_zone: 'gmt', units: 'english', interval: 'hilo', format: 'json',
  });
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${API}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { predictions?: Prediction[]; error?: { message: string } };
      if (!body.predictions) throw new Error(body.error?.message ?? 'no predictions');
      return body.predictions;
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise(r => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
}

const [fromArg = '2026-09-01', toArg = '2027-11-30'] = process.argv.slice(2);
const from = day(fromArg), to = day(toArg);
if (to <= from) throw new Error('the span is empty');

const rows: Prediction[] = [];
for (let a = from; a <= to;) {
  // ≤ 1 year per request: [a, min(a + 1 year − 1 day, to)]
  const b = new Date(Date.UTC(a.getUTCFullYear() + 1, a.getUTCMonth(), a.getUTCDate() - 1));
  const end = b < to ? b : to;
  rows.push(...(await fetchSpan(a, end)));
  a = new Date(end.getTime() + 864e5);
}

const ms = (p: Prediction) => Date.parse(`${p.t.replace(' ', 'T')}:00Z`);
rows.sort((p, q) => ms(p) - ms(q));
const seen = new Set<number>();
const clean = rows.filter(p => { const t = ms(p); if (!Number.isFinite(t) || seen.has(t)) return false; seen.add(t); return p.type === 'H' || p.type === 'L'; });
if (clean.length < 100) throw new Error(`only ${clean.length} extremes`);
for (let i = 1; i < clean.length; i++) if (clean[i].type === clean[i - 1].type) throw new Error(`two ${clean[i].type} in a row at ${clean[i].t}`);

const t0 = ms(clean[0]);
const out = {
  station: STATION,
  name: 'San Francisco (Golden Gate), CA',
  datum: 'MLLW',
  units: 'ft',
  source: `https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=${STATION}`,
  api: `${API}?product=predictions&interval=hilo&datum=MLLW&station=${STATION}&time_zone=gmt&units=english&application=${APPLICATION}`,
  fetched: ymd(new Date()),
  from: fromArg,
  to: toArg,
  t0,
  dt: clean.map((p, i) => (i === 0 ? 0 : Math.round((ms(p) - ms(clean[i - 1])) / 60000))),
  h: clean.map(p => Math.round(Number(p.v) * 100)),
  k: clean.map(p => p.type).join(''),
};
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out) + '\n');
console.log(`Wrote ${clean.length} tide extremes (${clean[0].t} … ${clean[clean.length - 1].t} UTC) to ${OUT}`);
