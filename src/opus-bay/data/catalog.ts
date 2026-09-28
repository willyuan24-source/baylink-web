import { useSyncExternalStore } from 'react';
import { game } from '../core/store';
import type { Bilingual, Catalog, CatalogEvent, CatalogGuide, CatalogPlace } from '../core/types';
import { bayNow } from '../game/bayNow';

/**
 * Live BAYLINK catalog (published `/planner-catalog.json`). Fetched once, cached, never invented.
 * Pure selectors below take the catalog + a Bay Area day string so they are deterministic and testable.
 * Wave 5 (lane R): "now" defaults to the Bay clock `bayNow()` (DEV / QA builds: `?date=` moves it), and city mode
 * registers where San Francisco's events happen (`setEventVenueHooks`, from realsf/index.ts): "附近这周" then finds
 * events by their mapped venue, flyers and event cards offer 带我去, and the week board ranks the playable city first.
 */

// ---------------------------------------------------------------------------
// Dates (America/Los_Angeles calendar days as YYYY-MM-DD strings)
// ---------------------------------------------------------------------------

export const todayInBay = (now = bayNow()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export const isDay = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** The coming Saturday (today if today is Saturday). */
export function nextSaturday(today: string): string {
  return addDays(today, (6 - weekday(today) + 7) % 7);
}

const eventEnd = (event: Pick<CatalogEvent, 'startDate' | 'endDate'>) => (isDay(event.endDate) ? event.endDate! : event.startDate);

/** Every confirmed day of the event inside [from, to] (never before `today`). Capped to keep it cheap. */
export function eventDaysInWindow(event: CatalogEvent, from: string, to: string, today = from): string[] {
  const start = event.startDate, end = eventEnd(event);
  const lo = [from, today, start].sort().at(-1)!, hi = [to, end].sort()[0];
  if (lo > hi) return [];
  if (Array.isArray(event.occurrenceDates)) {
    return [...new Set(event.occurrenceDates)].filter(day => isDay(day) && day >= lo && day <= hi).sort();
  }
  const days: string[] = [];
  for (let day = lo; day <= hi && days.length < 62; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Next confirmed day of the event from `today` on, or null when it has ended. */
export function eventNextDate(event: CatalogEvent, today: string): string | null {
  const end = eventEnd(event);
  if (end < today) return null;
  if (Array.isArray(event.occurrenceDates)) {
    const next = event.occurrenceDates.filter(day => isDay(day) && day >= today && day >= event.startDate && day <= end).sort()[0];
    return next ?? null;
  }
  return event.startDate > today ? event.startDate : today;
}

export const isExpired = (event: CatalogEvent, today: string) => eventNextDate(event, today) === null;

/** The next showing as of now (evening-aware, see upcomingEvents): its day and whether that is "tonight"; null = over. */
export function nextShowing(event: CatalogEvent, now = bayNow()): { date: string; tonight: boolean } | null {
  const today = todayInBay(now);
  const hit = upcomingEvents({ events: [event], places: [], guides: [] }, today, 400, now)[0];
  return hit ? { date: hit.nextDate, tonight: !!hit.tonight } : null;
}

/** `tonight`: the only day left today and it is evening in the Bay (labelled 今晚, ranked lower). */
export type UpcomingEvent = { event: CatalogEvent; nextDate: string; days: string[]; tonight?: boolean };

/** Hour of day (fractional) in the Bay Area. */
export function bayHour(now = bayNow()): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  return Number(parts.find(p => p.type === 'hour')?.value ?? 12) + Number(parts.find(p => p.type === 'minute')?.value ?? 0) / 60;
}

/** End time of a one-day event from its date label ("09:00–13:00", "11–19 时"), in hours; null when unknown. */
export function labelEndHour(event: CatalogEvent): number | null {
  const label = event.dateLabel ?? '';
  const range = /(\d{1,2})[:：](\d{2})\s*[–—~-]\s*(\d{1,2})[:：](\d{2})/.exec(label);
  if (range) return Number(range[3]) + Number(range[4]) / 60;
  const hours = /(\d{1,2})\s*[–—~-]\s*(\d{1,2})\s*时/.exec(label);
  if (hours) return Number(hours[2]);
  return null;
}

/**
 * Events with at least one confirmed day in today..today+days (inclusive), soonest first. Expired never shown.
 * With `now` after 18:00 Bay time, "today" is treated honestly: an event whose today has ended moves on to its next
 * day (or drops out when today was its last), one still running tonight is marked `tonight`, and one with unknown
 * hours but more days ahead starts tomorrow.
 */
export function upcomingEvents(catalog: Catalog | null, today: string, days = 7, now?: Date): UpcomingEvent[] {
  if (!catalog) return [];
  const to = addDays(today, days);
  const evening = now && todayInBay(now) === today && bayHour(now) >= 18 ? bayHour(now) : null;
  const list: UpcomingEvent[] = [];
  for (const event of catalog.events) {
    let inWindow = eventDaysInWindow(event, today, to, today);
    if (!inWindow.length) continue;
    let tonight = false;
    if (evening !== null && inWindow[0] === today) {
      const end = labelEndHour(event);
      const later = inWindow.length > 1;
      if (end !== null && end > evening + 0.25) tonight = true; // still on tonight (known hours): keep today
      else if (later) inWindow = inWindow.slice(1); // today is over (or hours unknown): its next day
      else if (end === null) tonight = true; // one day, hours unknown: keep, but say "tonight" and rank it lower
      else continue; // today was its last day and it is over
    }
    list.push({ event, nextDate: inWindow[0], days: inWindow, ...(tonight ? { tonight } : {}) });
  }
  return list.sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.event.title.localeCompare(b.event.title));
}

// ---------------------------------------------------------------------------
// "这周去哪" preference matching
// ---------------------------------------------------------------------------

export type WeekPrefs = { companions: string | null; vibe: string | null; region: string | null };
export type RelaxStep = 'companions' | 'vibe' | 'region' | 'window';
export type RankedEvent = UpcomingEvent & { score: number; reasons: Bilingual[] };
export type WeekResult = {
  events: RankedEvent[];
  relaxed: RelaxStep[];
  windowDays: number;
  strictCount: number;
  /** honest one-liner about what was swapped when filters were relaxed (null when nothing was relaxed) */
  note?: Bilingual | null;
};

const has = (list: string[] | undefined, words: string[]) => !!list?.some(item => words.some(word => item.includes(word)));
/** Kids: only positive audience wording — never a bare "岁" (it also matches "21 岁及以上"). */
const KIDS_RE = /亲子|儿童|孩子|家庭|\d+\s*岁(及)?以下|kid|family/i;
/** Audience lines that say 家庭 but are not about children. */
const NOT_KIDS_RE = /养狗|宠物|pet|dog/i;
const DATE_WORDS = ['约会', '情侣'];
const FRIEND_WORDS = ['朋友', '结伴', '聚会'];
const ADULT_RE = /21\+|18\+|21 ?岁|18 ?岁及以上/;
const PRO_AUDIENCE_RE = /开发者|从业者|工程|职业|求职|数据与产品|创业/;
const PRO_TITLE_RE = /\bAI\b|LLM|Conference|大会|Summit|Hackathon|Design Sprint/;
const FESTIVE_RE = /市集|集市|节|庆|festival|fest\b|market|faire|fair\b|oktoberfest/i;

/** The published catalog carries a few planning fields our core type does not list; read them defensively. */
type EventExtra = CatalogEvent & { planning?: { minAge?: number | null } | null };

/** Positive kid wording in the audience (not "养狗家庭"). */
export const kidsAudience = (event: CatalogEvent) => !!event.audience?.some(line => KIDS_RE.test(line) && !NOT_KIDS_RE.test(line));

/** 18+/21+ only (planning.minAge ≥ 18, or "21+" / "21 岁" / "18 岁及以上" in title, audience or cost). Never for kids. */
export function isAdultOnly(event: CatalogEvent): boolean {
  const minAge = (event as EventExtra).planning?.minAge;
  if (typeof minAge === 'number' && minAge >= 18) return true;
  return ADULT_RE.test([event.title, ...(event.audience ?? []), event.costLabel ?? ''].join(' '));
}

/** Professional / tech-industry events (conferences, dev days). Not leisure picks: only for "solo + culture". */
export function isProfessional(event: CatalogEvent): boolean {
  return !!event.audience?.some(line => PRO_AUDIENCE_RE.test(line)) || PRO_TITLE_RE.test(event.title);
}

/** Hard exclusions that are never relaxed: adult-only events for kids, professional events outside "solo + culture". */
export function hardFit(event: CatalogEvent, prefs: WeekPrefs): boolean {
  if (prefs.companions === 'kids' && isAdultOnly(event)) return false;
  if (isProfessional(event) && !(prefs.companions === 'solo' && prefs.vibe === 'culture')) return false;
  return true;
}

/** Companion fit: kids→family/亲子 (never adult-only), date→food/culture, friends→any, solo→culture/outdoors. */
export function companionFit(event: CatalogEvent, companions: string | null): boolean {
  switch (companions) {
    case 'kids': return !isAdultOnly(event) && !isProfessional(event) && (event.category === 'family' || kidsAudience(event));
    case 'date': return !isProfessional(event) && (event.category === 'food' || event.category === 'culture' || has(event.audience, DATE_WORDS));
    case 'solo': return event.category === 'culture' || event.category === 'outdoors';
    default: return true;
  }
}

/** How close an event is to a vibe it does not strictly match (used to rank once the vibe was relaxed). 0–3. */
export function vibeCloseness(event: CatalogEvent, vibe: string | null): number {
  const festive = FESTIVE_RE.test(`${event.title} ${(event.audience ?? []).join(' ')}`);
  const freeOutdoors = event.cost === 'free' && event.category === 'outdoors';
  switch (vibe) {
    case 'food': return event.category === 'food' ? 3 : festive || freeOutdoors ? 2 : event.category === 'culture' ? 1 : 0;
    case 'outdoors': return event.category === 'outdoors' ? 3 : festive ? 2 : event.category === 'family' ? 1.5 : event.category === 'culture' ? 1 : 0;
    case 'culture': return event.category === 'culture' ? 3 : festive ? 2 : 1;
    case 'free': return event.cost === 'free' ? 3 : event.cost === 'mixed' ? 2 : 0;
    default: return 0;
  }
}

/** Category label for chips and flyers — professional events read 科技 (tech), not 文化. */
export function categoryLabel(event: CatalogEvent): Bilingual | undefined {
  if (isProfessional(event)) return { zh: '科技', en: 'Tech' };
  return event.category ? CATEGORY_LABELS[event.category] : undefined;
}

/** Vibe fit: free→cost free, food/outdoors/culture→category. */
export function vibeFit(event: CatalogEvent, vibe: string | null): boolean {
  if (!vibe || vibe === 'any') return true;
  if (vibe === 'free') return event.cost === 'free';
  return event.category === vibe;
}

export const regionFit = (event: CatalogEvent, region: string | null) => !region || region === 'any' || event.region === region;

export function scoreEvent(item: UpcomingEvent, prefs: WeekPrefs, today: string, vibeRelaxed = false, cityFirst = false): RankedEvent {
  const { event } = item;
  let score = 0;
  const reasons: Bilingual[] = [];
  if (prefs.region && prefs.region !== 'any' && event.region === prefs.region) { score += 3; reasons.push(REGION_LABELS[event.region] ?? { zh: event.region, en: event.region }); }
  if (prefs.vibe && prefs.vibe !== 'any' && vibeFit(event, prefs.vibe)) {
    score += 3;
    reasons.push(prefs.vibe === 'free' ? { zh: '免费', en: 'Free' } : categoryLabel(event) ?? { zh: '合你口味', en: 'Your vibe' });
  } else {
    if (event.cost === 'free') score += 0.5;
    // the vibe was relaxed: the nearest kind of thing first (food → markets / festivals / free outdoors → culture)
    if (vibeRelaxed && prefs.vibe && prefs.vibe !== 'any') score += vibeCloseness(event, prefs.vibe) * 1.2;
  }
  // Companion reason tags only from positive audience wording — never from the category alone.
  if (prefs.companions === 'kids' && companionFit(event, 'kids')) {
    score += 2;
    if (kidsAudience(event)) { score += 1; reasons.push(COMPANION_REASONS.kids); }
  }
  if (prefs.companions === 'date' && companionFit(event, 'date')) {
    score += 2;
    if (has(event.audience, DATE_WORDS)) { score += 1; reasons.push(COMPANION_REASONS.date); }
  }
  if (prefs.companions === 'solo' && companionFit(event, 'solo')) { score += 2; reasons.push(COMPANION_REASONS.solo); }
  if (prefs.companions === 'friends' && has(event.audience, FRIEND_WORDS)) { score += 1.5; reasons.push(COMPANION_REASONS.friends); }
  // Sooner is a little better; the weekend a little more.
  const daysAway = Math.max(0, (Date.parse(`${item.nextDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  score += Math.max(0, 1 - daysAway / 10);
  if (item.days.some(day => weekday(day) === 0 || weekday(day) === 6)) score += 0.4;
  if (item.tonight) score -= item.days.length > 1 ? 1 : 2.5; // late in the evening: "today" is nearly over — never the top pick
  // wave 5 (city mode): the playable city first — San Francisco events, and above all the ones you can walk to in the
  // world — unless the player asked for another part of the Bay
  if (cityFirst && event.region === 'sf' && (!prefs.region || prefs.region === 'any' || prefs.region === 'sf')) score += eventSpot(event) ? 2.5 : 1.5;
  return { ...item, score, reasons };
}

export function scoreEvents(items: UpcomingEvent[], prefs: WeekPrefs, today: string, vibeRelaxed = false, cityFirst = false): RankedEvent[] {
  return items.map(item => scoreEvent(item, prefs, today, vibeRelaxed, cityFirst))
    .sort((a, b) => b.score - a.score || a.nextDate.localeCompare(b.nextDate) || a.event.id.localeCompare(b.event.id));
}

const VIBE_NAMES: Record<string, Bilingual> = {
  food: { zh: '吃喝类', en: 'food & drink' },
  outdoors: { zh: '户外类', en: 'outdoor' },
  culture: { zh: '文化类', en: 'culture' },
  free: { zh: '免费的', en: 'free' },
};
const COMPANION_NAMES: Record<string, Bilingual> = {
  date: { zh: '约会', en: 'a date' },
  solo: { zh: '一个人', en: 'going solo' },
};

/** What an off-vibe pick actually is, in plain words ("免费户外", "节庆", "文化"). */
function kindOf(event: CatalogEvent): Bilingual {
  if (event.cost === 'free' && event.category === 'outdoors') return { zh: '免费户外', en: 'free outdoor picks' };
  if (FESTIVE_RE.test(event.title)) return { zh: '节庆', en: 'festivals' };
  const label = categoryLabel(event);
  return label ? { zh: label.zh, en: label.en.toLowerCase() } : { zh: '其他活动', en: 'other events' };
}

/** The honest note shown above relaxed results: says exactly what was swapped. */
export function relaxNote(result: Pick<WeekResult, 'events' | 'relaxed' | 'windowDays'>, prefs: WeekPrefs): Bilingual | null {
  if (!result.relaxed.length || !result.events.length) return null;
  const zh: string[] = [], en: string[] = [];
  if (result.relaxed.includes('window')) { zh.push('7 天内合适的不多，我把时间放宽到了两周'); en.push('not much in the next 7 days, so I looked two weeks out'); }
  if (result.relaxed.includes('region') && prefs.region && prefs.region !== 'any') {
    const r = REGION_LABELS[prefs.region] ?? { zh: prefs.region, en: prefs.region };
    zh.push(`${r.zh}这几天不多，也放了别的地区的`); en.push(`${r.en} is quiet, so I added other areas`);
  }
  if (result.relaxed.includes('vibe') && prefs.vibe && VIBE_NAMES[prefs.vibe]) {
    const off = result.events.filter(item => !vibeFit(item.event, prefs.vibe)).map(item => kindOf(item.event));
    const kinds = off.filter((kind, i) => off.findIndex(other => other.zh === kind.zh) === i).slice(0, 2);
    const v = VIBE_NAMES[prefs.vibe];
    const fitting = result.events.length - off.length;
    if (kinds.length && fitting > 0) {
      zh.push(`合适的${v.zh}只有 ${fitting} 个，另外给你挑了${kinds.map(kind => kind.zh).join('和')}`);
      en.push(`only ${fitting} ${v.en} pick${fitting > 1 ? 's' : ''} fit, so I added ${kinds.map(kind => kind.en).join(' and ')}`);
    } else if (kinds.length) {
      zh.push(`这周没有合适的${v.zh}，给你挑了${kinds.map(kind => kind.zh).join('和')}`);
      en.push(`there's little ${v.en} this week, so I picked ${kinds.map(kind => kind.en).join(' and ')}`);
    } else { zh.push(`${v.zh}不多，我放宽了一点`); en.push(`${v.en} picks are thin, so I loosened it a little`); }
  }
  if (result.relaxed.includes('companions') && prefs.companions && COMPANION_NAMES[prefs.companions]) {
    const c = COMPANION_NAMES[prefs.companions];
    zh.push(`专门适合${c.zh}的不多，也放了大家都能去的`); en.push(`few picks are made for ${c.en}, so I added ones anyone can enjoy`);
  }
  if (!zh.length) return null;
  const first = en.join('; ');
  return { zh: `${zh.join('；')}。`, en: `${first.charAt(0).toUpperCase()}${first.slice(1)}.` };
}

/**
 * Filter this week's events by preferences; if fewer than `min` match, relax one filter at a time
 * (a two-week window → region → vibe → companions) and report what was relaxed so the UI can say so.
 * Hard exclusions never relax: adult-only events for kids, professional events outside "solo + culture",
 * and "kids" itself is never relaxed. `cityFirst` (default: city mode) ranks San Francisco first (see scoreEvent).
 */
export function recommendEvents(catalog: Catalog | null, prefs: WeekPrefs, today: string, opts: { min?: number; max?: number; days?: number; now?: Date; cityFirst?: boolean } = {}): WeekResult {
  const min = opts.min ?? 3, max = opts.max ?? 5, days = opts.days ?? 7;
  const cityFirst = opts.cityFirst ?? game.get().worldMode === 'city';
  let pool = upcomingEvents(catalog, today, days, opts.now).filter(({ event }) => hardFit(event, prefs));
  const active = { companions: true, vibe: true, region: true };
  const filter = () => pool.filter(({ event }) =>
    (!active.companions || companionFit(event, prefs.companions)) && (!active.vibe || vibeFit(event, prefs.vibe)) && (!active.region || regionFit(event, prefs.region)));
  let matches = filter();
  const strictCount = matches.length;
  // 1) a two-week window, 2) region, 3) vibe, 4) companions — cumulative, until there are enough picks
  if (matches.length < min && days < 14) { pool = upcomingEvents(catalog, today, 14, opts.now).filter(({ event }) => hardFit(event, prefs)); matches = filter(); }
  for (const step of ['region', 'vibe', 'companions'] as const) {
    if (matches.length >= min) break;
    if (step === 'companions' && prefs.companions === 'kids') continue; // never relax "with kids"
    const meaningful = step === 'companions' ? !!prefs.companions && prefs.companions !== 'friends' : !!prefs[step] && prefs[step] !== 'any';
    if (!meaningful) continue;
    active[step] = false;
    matches = filter();
  }
  const events = scoreEvents(matches, prefs, today, !active.vibe, cityFirst).slice(0, max);
  // Report only what the shown picks actually relax (honest: never claim a relaxation nobody sees).
  const end7 = addDays(today, days);
  const relaxed: RelaxStep[] = [];
  if (events.some(item => item.nextDate > end7)) relaxed.push('window');
  if (!active.region && events.some(item => !regionFit(item.event, prefs.region))) relaxed.push('region');
  if (!active.vibe && events.some(item => !vibeFit(item.event, prefs.vibe))) relaxed.push('vibe');
  if (!active.companions && events.some(item => !companionFit(item.event, prefs.companions))) relaxed.push('companions');
  const result: WeekResult = { events, relaxed, windowDays: relaxed.includes('window') ? 14 : days, strictCount };
  result.note = relaxNote(result, prefs);
  return result;
}

// ---------------------------------------------------------------------------
// Places / guides
// ---------------------------------------------------------------------------

export const REGION_ORDER = ['sf', 'east-bay', 'peninsula', 'south-bay', 'north-bay'];
export const REGION_LABELS: Record<string, Bilingual> = {
  sf: { zh: '旧金山', en: 'San Francisco' },
  'east-bay': { zh: '东湾', en: 'East Bay' },
  peninsula: { zh: '半岛', en: 'Peninsula' },
  'south-bay': { zh: '南湾', en: 'South Bay' },
  'north-bay': { zh: '北湾', en: 'North Bay' },
};
export const CATEGORY_LABELS: Record<string, Bilingual> = {
  family: { zh: '亲子', en: 'Family' },
  food: { zh: '吃喝', en: 'Food' },
  outdoors: { zh: '户外', en: 'Outdoors' },
  culture: { zh: '文化', en: 'Culture' },
};
const COMPANION_REASONS: Record<string, Bilingual> = {
  kids: { zh: '适合带娃', en: 'Kid-friendly' },
  date: { zh: '适合约会', en: 'Date-friendly' },
  solo: { zh: '一个人也自在', en: 'Good solo' },
  friends: { zh: '适合朋友结伴', en: 'Good with friends' },
};

export function placesByRegion(catalog: Catalog | null): { region: string; places: CatalogPlace[] }[] {
  if (!catalog) return [];
  const groups = new Map<string, CatalogPlace[]>();
  for (const place of catalog.places) {
    const list = groups.get(place.region) ?? [];
    list.push(place);
    groups.set(place.region, list);
  }
  const order = (region: string) => { const i = REGION_ORDER.indexOf(region); return i < 0 ? 99 : i; };
  return [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([region, places]) => ({ region, places }));
}

export const placeById = (catalog: Catalog | null, id: string | undefined) => (id && catalog ? catalog.places.find(place => place.id === id) : undefined);
export const eventById = (catalog: Catalog | null, id: string | undefined) => (id && catalog ? catalog.events.find(event => event.id === id) : undefined);
export const guideTitle = (catalog: Catalog | null, slug: string | undefined) => (slug && catalog ? catalog.guides.find(guide => guide.slug === slug)?.title : undefined);
export const hasGuide = (catalog: Catalog | null, slug: string | undefined) => !!guideTitle(catalog, slug);

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type NearEvent = UpcomingEvent & { km: number; walkMin: number };

/** Walking minutes for a distance (≈ 80 m per minute, rounded to 5). */
export const walkMinutes = (km: number) => Math.max(5, Math.round((km * 1000) / 80 / 5) * 5);

// ---------------------------------------------------------------------------
// Wave 5 · where an event happens in the world (city mode; lane R's realsf/index.ts registers it)
// ---------------------------------------------------------------------------

/** An event's place in the world: the venue point (city frame), its real coordinates and its name. */
export interface EventSpot { x: number; z: number; lat: number; lng: number; name: Bilingual }
export interface EventVenueHooks {
  /** the event's mapped venue (null: not in San Francisco's venue table, adult-only or professional) */
  locate(event: CatalogEvent): EventSpot | null;
  /** take the player there (带我去) */
  go(event: CatalogEvent): void;
}

let venueHooks: EventVenueHooks | null = null;
/** City mode (realsf/index.ts): register the venue table; returns the undo. District mode never registers one. */
export function setEventVenueHooks(hooks: EventVenueHooks | null): () => void {
  venueHooks = hooks;
  listeners.forEach(listener => listener());
  return () => { if (venueHooks === hooks) { venueHooks = null; listeners.forEach(listener => listener()); } };
}
/** Where the event happens in the world (null in district mode, before the city registers, or unmapped). */
export const eventSpot = (event: CatalogEvent): EventSpot | null => venueHooks?.locate(event) ?? null;
/** 带我去 an event's venue; false when there is nowhere to go. */
export function goToEvent(event: CatalogEvent): boolean {
  if (!venueHooks || !venueHooks.locate(event)) return false;
  venueHooks.go(event);
  return true;
}

/**
 * Upcoming leisure events with a known location within `km` of a point (for "附近这周"), nearest first: the event's
 * own `location`, else (city mode) its mapped venue. Adult-only and professional events never show here (the card is
 * read by everyone, kids included).
 */
export function eventsNear(catalog: Catalog | null, point: { lat: number; lng: number }, today: string, km = 1.0, days = 7, now?: Date): NearEvent[] {
  const out: NearEvent[] = [];
  for (const item of upcomingEvents(catalog, today, days, now)) {
    const { event } = item;
    if (isAdultOnly(event) || isProfessional(event)) continue;
    const own = event.location && Number.isFinite(event.location.lat) && Number.isFinite(event.location.lng) ? event.location : null;
    const where = own ?? eventSpot(event);
    if (!where) continue;
    const d = distanceKm(point, where);
    if (d <= km) out.push({ ...item, km: d, walkMin: walkMinutes(d) });
  }
  return out.sort((a, b) => a.km - b.km || a.nextDate.localeCompare(b.nextDate));
}

// ---------------------------------------------------------------------------
// Loading (fetch once, cache, graceful error)
// ---------------------------------------------------------------------------

const str = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Keep only well-formed records so a malformed row can never break the UI. */
export function sanitizeCatalog(raw: unknown): Catalog {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const events = (Array.isArray(data.events) ? data.events : []).filter((event): event is CatalogEvent =>
    !!event && typeof event === 'object' && str((event as CatalogEvent).id) && str((event as CatalogEvent).title) && isDay((event as CatalogEvent).startDate));
  const places = (Array.isArray(data.places) ? data.places : []).filter((place): place is CatalogPlace =>
    !!place && typeof place === 'object' && str((place as CatalogPlace).id) && str((place as CatalogPlace).title));
  const guides = (Array.isArray(data.guides) ? data.guides : []).filter((guide): guide is CatalogGuide =>
    !!guide && typeof guide === 'object' && str((guide as CatalogGuide).slug) && str((guide as CatalogGuide).title));
  return { checkedAt: str(data.checkedAt) ? data.checkedAt : undefined, events, places, guides };
}

let cache: Catalog | null = null;
let pending: Promise<Catalog | null> | null = null;
const listeners = new Set<() => void>();

export const getCatalog = () => cache;

export function loadCatalog(fetcher: typeof fetch = (...args) => fetch(...args)): Promise<Catalog | null> {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;
  game.set({ catalogStatus: 'loading' });
  pending = fetcher('/planner-catalog.json', { credentials: 'omit' })
    .then(response => { if (!response.ok) throw new Error(`catalog ${response.status}`); return response.json(); })
    .then(raw => {
      cache = sanitizeCatalog(raw);
      game.set({ catalogStatus: 'ready' });
      listeners.forEach(listener => listener());
      return cache;
    })
    .catch(() => {
      pending = null; // allow a retry
      game.set({ catalogStatus: 'error' });
      return null;
    });
  return pending;
}

/** Test/QA helper: seed the cache directly. */
export function setCatalogForTests(catalog: Catalog | null) {
  cache = catalog;
  pending = null;
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useCatalog(): Catalog | null {
  return useSyncExternalStore(subscribe, getCatalog, getCatalog);
}
