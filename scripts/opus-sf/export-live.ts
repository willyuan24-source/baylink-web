/**
 * Wave 5 · lane R (W5-R7) · 今天免费 from BAYLINK's own offers (plan §3.3 "今天免费 badges", D13): reads the site's offer
 * data (`src/data`, read-only, the same pattern as scripts/export-planner-catalog.ts) and writes the San Francisco
 * offers that belong to a place in the game — museums, parks and transit only, never a shop or a brand promotion — to
 * `public/opus-bay/sf/v1/live.json`. The game reads that same-site file (realsf/live.ts): no third-party call.
 *
 *   npx tsx scripts/opus-sf/export-live.ts
 *
 * Each row keeps the offer's own title, conditions, source and check date, and adds what the game needs: the place in
 * the world (a place-index id and its point), a short "who" line, and — for a standing offer — the days and hours it
 * applies, read from the organiser's page on the day in `ruleCheckedAt`. A dated offer applies on its own dates. Links go
 * to BAYLINK's `/offers/:id`. The export fails if an offer disappeared from the site data or turned into a purchase deal.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { FreebieOffer } from '../../src/components/FreebieBoard';
import { currentFreebies } from '../../src/data/october-offers';
import { loadLocale, translateText } from '../../src/i18n/locale';

const OUT = resolve('public/opus-bay/sf/v1/live.json');
const RULES_CHECKED = '2026-09-28';

type Bi = { zh: string; en: string };
type Hours = [number, number];
interface Spec {
  id: string;
  kind: 'museum' | 'park' | 'transit';
  /** free entry (else a discount: shown as 优惠, never 免费) */
  free: boolean;
  /** the place in the world: a place-index id (data/sf places.json / attractions) and its point */
  place: { id?: string; x: number; z: number; name: Bi } | null;
  /** a short who line (the offer's full conditions stay in `requirement`) */
  who: Bi;
  /** a standing offer: the weekdays (0 = Sunday) it applies, or the n-th weekday of the month */
  weekdays?: number[];
  nth?: [weekday: number, n: number][];
  /** hours [open, close] in minutes after Bay midnight, per weekday (7 entries, null = closed) or one pair */
  hours?: Hours | (Hours | null)[];
  /** where the day rule / hours were read (the organiser's page) */
  ruleUrl?: string;
  /** the day that page was read (default RULES_CHECKED) */
  ruleCheckedAt?: string;
  /** the SF Today hand row (realsf/todayRows.ts) this offer belongs to: the tab links the offer there */
  hand?: string;
  /**
   * (W8-S) the site's source is a translated copy of an English page (`from`): the game links the English original
   * (`url`, read on `checkedAt`). The export fails once the site's own source changes, so the override is dropped then.
   */
  sourceEn?: { from: string; url: string; checkedAt: string };
}

const H = (h: number, m = 0) => h * 60 + m;
const SPECS: Spec[] = [
  {
    id: 'asian-art-free-oct4', kind: 'museum', free: true, who: { zh: '所有人 · 普通展区', en: 'Everyone · general admission' },
    place: { id: 'osm-w24588037', x: 109.18, z: 379.12, name: { zh: '亚洲艺术博物馆', en: 'the Asian Art Museum' } }, hours: [H(10), H(17)],
    ruleUrl: 'https://about.asianart.org/ticketing/',
  },
  {
    id: 'conservatory-free-oct6', kind: 'park', free: true, who: { zh: '所有人', en: 'Everyone' }, hand: 'free-conservatory',
    place: { id: 'conservatory-of-flowers', x: -177.51, z: 858.11, name: { zh: '花卉温室', en: 'the Conservatory of Flowers' } }, hours: [H(10), H(16)],
  },
  {
    id: 'botanical-free-oct13', kind: 'park', free: true, who: { zh: '所有人', en: 'Everyone' }, hand: 'free-botanical',
    place: { id: 'sf-botanical-garden', x: -178.3, z: 970.9, name: { zh: '旧金山植物园', en: 'the SF Botanical Garden' } }, hours: [H(7, 30), H(17)],
  },
  {
    id: 'japanese-tea-garden-free-hour', kind: 'park', free: true, who: { zh: '所有人', en: 'Everyone' }, hand: 'free-teaGarden',
    place: { id: 'japanese-tea-garden', x: -242.9, z: 964.4, name: { zh: '日本茶园', en: 'the Japanese Tea Garden' } }, weekdays: [1, 3, 5], hours: [H(9), H(10)],
    ruleUrl: 'https://gggp.org/visit/admissions-hours/',
  },
  {
    id: 'sfmoma-family-oct25', kind: 'museum', free: true, who: { zh: '带 18 岁及以下孩子，最多两位成人', en: 'With a child 18 or under, up to two adults' },
    place: { id: 'sfmoma', x: 177.3, z: 181.81, name: { zh: '旧金山现代艺术博物馆', en: 'SFMOMA' } }, hours: [H(10), H(17)],
    ruleUrl: 'https://www.sfmoma.org/visit/',
  },
  {
    id: 'cable-car-museum-free', kind: 'museum', free: true, who: { zh: '所有人', en: 'Everyone' },
    place: { id: 'cable-car-museum', x: -12.9, z: 184.41, name: { zh: '缆车博物馆', en: 'the Cable Car Museum' } }, weekdays: [0, 2, 3, 4, 5, 6],
    hours: [[H(10), H(17)], null, [H(10), H(16)], [H(10), H(16)], [H(10), H(16)], [H(10), H(17)], [H(10), H(17)]],
    ruleUrl: 'https://www.cablecarmuseum.org/info.html',
  },
  {
    id: 'randall-museum-free', kind: 'museum', free: true, who: { zh: '所有人', en: 'Everyone' },
    place: { id: 'osm-w705309578', x: 95.91, z: 746.08, name: { zh: '兰德尔博物馆', en: 'the Randall Museum' } }, weekdays: [2, 3, 4, 5, 6], hours: [H(10), H(17)],
    ruleUrl: 'https://randallmuseum.org/faqs/',
  },
  {
    id: 'museo-italo-free-days', kind: 'museum', free: true, who: { zh: '所有人 · 普通入馆', en: 'Everyone · general admission' },
    place: { id: 'osm-n4022645781', x: -320.2, z: 228.43, name: { zh: '意大利裔美国人博物馆', en: 'the Museo Italo Americano' } },
    weekdays: [4], nth: [[0, 1]], hours: [[H(10), H(14)], null, null, null, [H(12), H(16)], null, null],
    ruleUrl: 'https://sfmuseo.org/',
  },
  {
    id: 'exploratorium-for-all-five', kind: 'museum', free: false, who: { zh: '持福利卡加证件，$5', en: 'With a benefits card and ID, $5' },
    place: { id: 'exploratorium', x: 28.97, z: 4.31, name: { zh: '探索馆', en: 'the Exploratorium' } },
  },
  {
    id: 'sfmoma-museums-for-all', kind: 'museum', free: true, who: { zh: 'SF 居民持福利卡', en: 'SF residents with a benefits card' },
    place: { id: 'sfmoma', x: 177.3, z: 181.81, name: { zh: '旧金山现代艺术博物馆', en: 'SFMOMA' } },
  },
  {
    id: 'muni-youth-free', kind: 'transit', free: true, who: { zh: '18 岁及以下', en: '18 and under' }, place: null,
  },
  // W7-S: GPT's Sep 29 refresh — free Muni (cable cars included) for SF residents 65+ under the income limit, after an
  // application; the site's source is SFMTA's Vietnamese page, the rule is read from the English one
  {
    id: 'sfmta-free-muni-seniors', kind: 'transit', free: true, who: { zh: '65 岁以上 SF 居民，收入符合，须先申请', en: 'SF residents 65+, income limit, apply first' }, place: null,
    ruleUrl: 'https://www.sfmta.com/fares/free-muni-seniors-ages-65', ruleCheckedAt: '2026-09-29',
    // (W9-L) the site's sourceUrl is SFMTA's English page now (it was the Vietnamese copy, /vi/node/12193: W8-S's sourceEn
    // override is gone); the page still reads "All San Francisco seniors, ages 65+, with a gross annual family income at or
    // below 100 percent of Bay Area Median Income level are eligible", apply first, cable cars included (2026-10-01)
  },
  // W6-S: GPT's autumn release (2026-09-29) — the Museum of the African Diaspora reopens on Sep 30 (moadsf.org/visit:
  // Tue–Wed, Fri–Sun 11–5, Thu 12–8, closed Monday; "Every Second Saturday" free); its first-Thursday night is 4–8 pm
  {
    id: 'sf-moad-free-thursday-oct1-2026', kind: 'museum', free: true, who: { zh: '所有人', en: 'Everyone' },
    place: { id: 'osm-n415567060', x: 164.14, z: 183.56, name: { zh: '非洲侨民博物馆', en: 'the Museum of the African Diaspora' } }, hours: [H(16), H(20)],
    ruleUrl: 'https://www.moadsf.org/event/downtown-first-thursdays---october-1', ruleCheckedAt: '2026-09-29',
  },
  {
    id: 'sf-moad-thrive-second-saturday-oct2026', kind: 'museum', free: true, who: { zh: '所有人', en: 'Everyone' },
    place: { id: 'osm-n415567060', x: 164.14, z: 183.56, name: { zh: '非洲侨民博物馆', en: 'the Museum of the African Diaspora' } }, hours: [H(11), H(17)],
    ruleUrl: 'https://www.moadsf.org/visit', ruleCheckedAt: '2026-09-29',
  },
  {
    id: 'sf-zoo-resident-free-oct7-2026', kind: 'park', free: true, who: { zh: 'SF 居民 · 凭地址证件', en: 'SF residents · with proof of address' },
    place: { id: 'sf-zoo', x: -110.3, z: 1657.6, name: { zh: '旧金山动物园', en: 'the San Francisco Zoo' } }, hours: [H(10), H(16)],
    ruleUrl: 'https://www.sfzoo.org/calendar/sf-resident-free-day-5/', ruleCheckedAt: '2026-09-30',
  },
];

// Use the same dictionaries and override order as the website and guide catalog.
await loadLocale('en');
const bi = (zh: string): Bi => ({ zh, en: translateText(zh, 'en') });

const byId = new Map<string, FreebieOffer>(currentFreebies.map(o => [o.id, o]));
const rows = SPECS.map(s => {
  const o = byId.get(s.id);
  if (!o) throw new Error(`offer ${s.id} is not in the site data any more`);
  if (o.kind === 'purchase' && s.free) throw new Error(`offer ${s.id} is a purchase deal now`);
  if (!/^https:\/\//.test(o.sourceUrl)) throw new Error(`offer ${s.id}: no https source`);
  if (o.availability === 'dated' && !(o.startDate && o.endDate)) throw new Error(`offer ${s.id}: dated without dates`);
  if (s.sourceEn && o.sourceUrl !== s.sourceEn.from) throw new Error(`offer ${s.id}: the site's source is now ${o.sourceUrl} — drop the sourceEn override`);
  return {
    id: s.id, kind: s.kind, free: s.free,
    title: bi(o.title), who: s.who, requirement: bi(o.requirement),
    ...(o.availability === 'dated' ? { from: o.startDate, to: o.endDate } : {}),
    ...(s.weekdays ? { weekdays: s.weekdays } : {}),
    ...(s.nth ? { nth: s.nth } : {}),
    ...(s.hours ? { hours: s.hours } : {}),
    place: s.place,
    ...(s.hand ? { hand: s.hand } : {}),
    href: `/offers/${encodeURIComponent(s.id)}`,
    source: s.sourceEn
      ? { label: o.sourceLabel, url: s.sourceEn.url, verifiedAt: s.sourceEn.checkedAt }
      : { label: o.sourceLabel, url: o.sourceUrl, verifiedAt: o.verifiedAt ?? '2026-09-15' },
    ...(s.ruleUrl ? { rule: { url: s.ruleUrl, verifiedAt: s.ruleCheckedAt ?? RULES_CHECKED } } : {}),
  };
});

// (W8-S) the export's date is the Bay date (it wrote the UTC date: an evening export read tomorrow)
const bayToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const out = { version: 1, exported: bayToday, source: 'BAYLINK offers (src/data), San Francisco museums, parks and transit', offers: rows };
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`Wrote ${rows.length} San Francisco offers to ${OUT}`);
