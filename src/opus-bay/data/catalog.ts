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
  /** (W9-R4) what the asked place really had (the note's numbers) */
  counts?: WeekCounts;
};
export type WeekCounts = { inRegion?: number };

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
type EventExtra = CatalogEvent & { planning?: { minAge?: number | null; setting?: string | null } | null };

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

/** (W9-R4) 带长辈: an outing for everyone (never 18+ / professional), by day — not a night at the arena (starts ≥ 19:00). */
const FIRST_TIME_RE = /(\d{1,2})[:：](\d{2})/;
/** The label's first time after its date part is ≥ 19:00 (a night start; a range ending at 19:00 is not). */
export function startsAtNight(event: CatalogEvent): boolean {
  const m = FIRST_TIME_RE.exec((event.dateLabel ?? '').split(' · ').slice(1).join(' · '));
  return !!m && Number(m[1]) >= 19;
}
export const seniorsFit = (event: CatalogEvent) => !isAdultOnly(event) && !isProfessional(event) && !startsAtNight(event);
/** Positive wording for older people in the audience (长者, 所有年龄, 全龄). */
const SENIORS_RE = /长者|老人|长辈|所有年龄|全龄|senior/i;

/** Companion fit: kids→family/亲子 (never adult-only), date→food/culture, friends→any, solo→culture/outdoors, seniors
 *  (W9-R4)→ daytime and for everyone. */
export function companionFit(event: CatalogEvent, companions: string | null): boolean {
  switch (companions) {
    case 'kids': return !isAdultOnly(event) && !isProfessional(event) && (event.category === 'family' || kidsAudience(event));
    case 'date': return !isProfessional(event) && (event.category === 'food' || event.category === 'culture' || has(event.audience, DATE_WORDS));
    case 'solo': return event.category === 'culture' || event.category === 'outdoors';
    case 'seniors': return seniorsFit(event);
    default: return true;
  }
}

/** (W9-R4, review R§5 #12) 户外 by what the event is, not only its category: the catalog's outdoor setting, an open-air
 *  venue in the world (a stage / tents / a street arch), or a park / lawn / street / beach in the venue text. `city`
 *  false (district mode, W9-R-review R-RC-3: district mode never changes): the catalog's category only, as before. */
const OUTDOOR_RE = /park|garden|lawn|meadow|hollow|green\b|beach|plaza|street|streets|avenue|pier|公园|花园|草坪|草地|广场|海滩|街/i;
export function isOutdoor(event: CatalogEvent, city = true): boolean {
  if (event.category === 'outdoors') return true;
  if (!city) return false;
  const setting = (event as EventExtra).planning?.setting;
  if (setting === 'outdoor') return true;
  if (setting === 'indoor') return false;
  if (eventSpot(event)?.outdoor) return true;
  return OUTDOOR_RE.test((event.venue ?? '').split(' · ')[0]) && !/library|图书馆|theater|theatre|hall|center|centre|museum|博物馆|中心/i.test(event.venue ?? '');
}

/** How close an event is to a vibe it does not strictly match (used to rank once the vibe was relaxed). 0–3. */
export function vibeCloseness(event: CatalogEvent, vibe: string | null, city = true): number {
  const festive = FESTIVE_RE.test(`${event.title} ${(event.audience ?? []).join(' ')}`);
  const freeOutdoors = event.cost === 'free' && isOutdoor(event, city);
  switch (vibe) {
    case 'food': return event.category === 'food' ? 3 : festive || freeOutdoors ? 2 : event.category === 'culture' ? 1 : 0;
    case 'outdoors': return isOutdoor(event, city) ? 3 : festive ? 2 : event.category === 'family' ? 1.5 : event.category === 'culture' ? 1 : 0;
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

/** Vibe fit: free→cost free, outdoors→isOutdoor (W9-R4: by what it is, not only the category), food/culture→category. */
export function vibeFit(event: CatalogEvent, vibe: string | null, city = true): boolean {
  if (!vibe || vibe === 'any') return true;
  if (vibe === 'free') return event.cost === 'free';
  if (vibe === 'outdoors') return isOutdoor(event, city);
  return event.category === vibe;
}

// ---------------------------------------------------------------------------
// W9-R4 · the city's own parts (review R§5 #12: the game's third question asked East Bay / North Bay although the game
// is San Francisco only). City mode asks for a part of San Francisco ('sf-north' …), all of it ('sf') or the rest of
// the Bay ('bay': no 带我去 there). An event's part comes from its venue in the world, else its own location.
// ---------------------------------------------------------------------------

export const SF_AREAS = ['sf-north', 'sf-central', 'sf-west', 'sf-south'] as const;
export type SfArea = (typeof SF_AREAS)[number];
export const SF_AREA_LABELS: Record<SfArea, Bilingual> = {
  'sf-north': { zh: '北岸 · 码头 · 唐人街', en: 'North shore · the Wharf · Chinatown' },
  'sf-central': { zh: '市中心 · SoMa', en: 'Downtown · SoMa' },
  'sf-west': { zh: '金门公园 · 西边', en: 'Golden Gate Park · the west' },
  'sf-south': { zh: 'Mission · 南边', en: 'the Mission · the south' },
};
/** Short names for notes (「北岸这几天合适的不多」). */
const SF_AREA_SHORT: Record<SfArea, Bilingual> = {
  'sf-north': { zh: '北岸一带', en: 'the north shore' },
  'sf-central': { zh: '市中心一带', en: 'downtown' },
  'sf-west': { zh: '西边一带', en: 'the west side' },
  'sf-south': { zh: '南边一带', en: 'the south side' },
};
export const isSfArea = (v: string | null | undefined): v is SfArea => !!v && (SF_AREAS as readonly string[]).includes(v);
/** 这周去哪's third question in city mode: four parts of San Francisco, all of it, or the rest of the Bay. */
export const CITY_REGION_OPTIONS: { value: string; label: Bilingual }[] = [
  ...SF_AREAS.map(value => ({ value, label: SF_AREA_LABELS[value] })),
  { value: 'sf', label: { zh: '旧金山哪儿都行', en: 'Anywhere in SF' } },
  { value: 'bay', label: { zh: '湾区其他地方', en: 'Elsewhere in the Bay' } },
];
/** 这周去哪's first question gains 带长辈 (the planner's request: no option for parents / elders). */
export const SENIORS_OPTION = { value: 'seniors', label: { zh: '带长辈', en: 'With elders' } } as const;

/**
 * The part of San Francisco a point is in (lat / lng): the west = west of Twin Peaks' longitude (the Richmond, the
 * Sunset, Golden Gate Park, the Presidio, Ocean Beach, Lake Merced) down to Sloat Blvd's latitude, and south of it only
 * west of 19th Ave (the zoo, Lake Merced, SF State; W9-R-review R-RP-3: Ocean View and Ingleside are the south); else the north shore = north of Bush St's latitude
 * (the Marina, North Beach, Chinatown, Fisherman's Wharf, the Embarcadero); else downtown = north of Duboce / 15th St's
 * latitude (Civic Center, SoMa, Hayes Valley, the Western Addition) and the east side down to 23rd St (Mission Bay, the
 * Chase Center, Potrero Hill, Dogpatch); else the south (the Mission, the Castro, Noe Valley, Bernal Heights, the
 * Excelsior, Ingleside, Bayview).
 */
export function sfAreaAt(ll: { lat: number; lng: number }): SfArea {
  if (ll.lng < -122.447 && (ll.lat >= 37.734 || ll.lng < -122.475)) return 'sf-west';
  if (ll.lat >= 37.789) return 'sf-north';
  if (ll.lat >= 37.7685 || (ll.lng > -122.405 && ll.lat >= 37.755)) return 'sf-central';
  return 'sf-south';
}

/** An event's part of San Francisco (null: not in San Francisco, or nowhere known). */
export function eventArea(event: CatalogEvent): SfArea | null {
  if (event.region !== 'sf') return null;
  const own = event.location && Number.isFinite(event.location.lat) && Number.isFinite(event.location.lng) ? event.location : null;
  const at = eventSpot(event) ?? own;
  return at ? sfAreaAt(at) : null;
}

/** Region fit: a region id, a part of San Francisco ('sf-north' …), 'bay' (anywhere but San Francisco), 'any'. */
export function regionFit(event: CatalogEvent, region: string | null): boolean {
  if (!region || region === 'any') return true;
  if (region === 'bay') return event.region !== 'sf';
  if (isSfArea(region)) return eventArea(event) === region;
  return event.region === region;
}

/** The label of an answer to the third question (a region, a part of the city, the rest of the Bay). */
export function regionLabel(region: string | null): Bilingual | null {
  if (!region || region === 'any') return null;
  if (isSfArea(region)) return SF_AREA_LABELS[region];
  if (region === 'bay') return { zh: '湾区其他地方', en: 'Elsewhere in the Bay' };
  return REGION_LABELS[region] ?? null;
}

/** A San Francisco answer ('sf' or one of its parts): the city ranks first and its region relaxes last. */
const inSf = (region: string | null) => region === 'sf' || isSfArea(region);

export function scoreEvent(item: UpcomingEvent, prefs: WeekPrefs, today: string, vibeRelaxed = false, cityFirst = false): RankedEvent {
  const { event } = item;
  let score = 0;
  const reasons: Bilingual[] = [];
  if (prefs.region && prefs.region !== 'any' && regionFit(event, prefs.region)) {
    score += 3;
    const label = isSfArea(prefs.region) ? SF_AREA_LABELS[prefs.region] : REGION_LABELS[event.region] ?? { zh: event.region, en: event.region };
    reasons.push(label);
  } else if (isSfArea(prefs.region) && event.region === 'sf') score += 1.5; // another part of the city: still near
  if (prefs.vibe && prefs.vibe !== 'any' && vibeFit(event, prefs.vibe, cityFirst)) {
    score += 3;
    reasons.push(prefs.vibe === 'free' ? { zh: '免费', en: 'Free' } : categoryLabel(event) ?? { zh: '合你口味', en: 'Your vibe' });
  } else {
    if (event.cost === 'free') score += 0.5;
    // the vibe was relaxed: the nearest kind of thing first (food → markets / festivals / free outdoors → culture)
    if (vibeRelaxed && prefs.vibe && prefs.vibe !== 'any') score += vibeCloseness(event, prefs.vibe, cityFirst) * 1.2;
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
  if (prefs.companions === 'seniors' && companionFit(event, 'seniors')) {
    score += 1.5;
    if (SENIORS_RE.test((event.audience ?? []).join(' '))) { score += 1; reasons.push(COMPANION_REASONS.seniors); }
  }
  if (prefs.companions === 'friends' && has(event.audience, FRIEND_WORDS)) { score += 1.5; reasons.push(COMPANION_REASONS.friends); }
  // Sooner is a little better; the weekend a little more.
  const daysAway = Math.max(0, (Date.parse(`${item.nextDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  score += Math.max(0, 1 - daysAway / 10);
  if (item.days.some(day => weekday(day) === 0 || weekday(day) === 6)) score += 0.4;
  if (item.tonight) score -= item.days.length > 1 ? 1 : 2.5; // late in the evening: "today" is nearly over — never the top pick
  // wave 5 (city mode): the playable city first — San Francisco events, and above all the ones you can walk to in the
  // world — unless the player asked for another part of the Bay
  if (cityFirst && event.region === 'sf' && (!prefs.region || prefs.region === 'any' || inSf(prefs.region))) score += eventSpot(event) ? 2.5 : 1.5;
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
  seniors: { zh: '带长辈', en: 'going with elders' },
};

/** How a note names where the player asked for (「旧金山」「北岸一带」「东湾」). */
function whereName(region: string | null): Bilingual | null {
  if (!region || region === 'any') return null;
  if (isSfArea(region)) return SF_AREA_SHORT[region];
  if (region === 'bay') return { zh: '湾区其他地方', en: 'the rest of the Bay' };
  return REGION_LABELS[region] ?? null;
}

/** What an off-vibe pick actually is, in plain words ("免费户外", "节庆", "文化"). */
function kindOf(event: CatalogEvent, city = true): Bilingual {
  if (event.cost === 'free' && isOutdoor(event, city)) return { zh: '免费户外', en: 'free outdoor picks' };
  if (FESTIVE_RE.test(event.title)) return { zh: '节庆', en: 'festivals' };
  const label = categoryLabel(event);
  return label ? { zh: label.zh, en: label.en.toLowerCase() } : { zh: '其他活动', en: 'other events' };
}

/**
 * The honest note shown above relaxed results: says exactly what was swapped. (W9-R4, review R§5 #12: "San Francisco is
 * quiet" was false — that week had 29 events, only few of the asked kind) — the region note counts what the asked place
 * really had (`counts.inRegion`: its events that fit the other answers), and the vibe note names the place and the week
 * (「旧金山合适的吃喝类这周只有 2 个」).
 */
export function relaxNote(result: Pick<WeekResult, 'events' | 'relaxed' | 'windowDays'> & { counts?: WeekCounts }, prefs: WeekPrefs, city = true): Bilingual | null {
  if (!result.relaxed.length || !result.events.length) return null;
  const zh: string[] = [], en: string[] = [];
  const week = result.windowDays > 7 ? { zh: '这两周', en: 'these two weeks' } : { zh: '这周', en: 'this week' };
  if (result.relaxed.includes('window')) { zh.push('7 天内合适的不多，我把时间放宽到了两周'); en.push('not much in the next 7 days, so I looked two weeks out'); }
  const where = whereName(prefs.region);
  if (result.relaxed.includes('region') && where) {
    const n = result.counts?.inRegion;
    const outSf = result.events.some(item => item.event.region !== 'sf');
    const rest = isSfArea(prefs.region)
      ? (outSf ? { zh: '旧金山别处和湾区其他地方', en: 'the rest of San Francisco and the Bay' } : { zh: '旧金山别处', en: 'the rest of San Francisco' })
      : { zh: '别的地区', en: 'other areas' };
    if (n === undefined) { zh.push(`${where.zh}这几天合适的不多，也放了${rest.zh}的`); en.push(`few picks in ${where.en} these days, so I added ${rest.en}`); }
    else if (n === 0) { zh.push(`${where.zh}${week.zh}没有完全合适的，放了${rest.zh}的`); en.push(`nothing in ${where.en} fits ${week.en}, so I picked from ${rest.en}`); }
    else { zh.push(`${where.zh}${week.zh}合适的只有 ${n} 个，也放了${rest.zh}的`); en.push(`only ${n} pick${n > 1 ? 's' : ''} in ${where.en} fit ${week.en}, so I added ${rest.en}`); }
  }
  if (result.relaxed.includes('vibe') && prefs.vibe && VIBE_NAMES[prefs.vibe]) {
    const off = result.events.filter(item => !vibeFit(item.event, prefs.vibe, city)).map(item => kindOf(item.event, city));
    const kinds = off.filter((kind, i) => off.findIndex(other => other.zh === kind.zh) === i).slice(0, 2);
    const v = VIBE_NAMES[prefs.vibe];
    const fitting = result.events.length - off.length;
    // the place it counted in, when the region answer still holds
    const at = where && !result.relaxed.includes('region') ? where : null;
    if (kinds.length && fitting > 0) {
      zh.push(`${at ? at.zh : ''}合适的${v.zh}${week.zh}只有 ${fitting} 个，另外给你挑了${kinds.map(kind => kind.zh).join('和')}`);
      en.push(`only ${fitting} ${v.en} pick${fitting > 1 ? 's' : ''}${at ? ` in ${at.en}` : ''} fit ${week.en}, so I added ${kinds.map(kind => kind.en).join(' and ')}`);
    } else if (kinds.length) {
      zh.push(`${week.zh}${at ? at.zh : ''}没有合适的${v.zh}，给你挑了${kinds.map(kind => kind.zh).join('和')}`);
      en.push(`there's little ${v.en}${at ? ` in ${at.en}` : ''} ${week.en}, so I picked ${kinds.map(kind => kind.en).join(' and ')}`);
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
  // (W9-R4) a part of San Francisco relaxes in two stages: to all of the city first, then to the Bay
  let wholeCity = false;
  const regionOk = (event: CatalogEvent) => !active.region || (wholeCity ? event.region === 'sf' : regionFit(event, prefs.region));
  const filter = () => pool.filter(({ event }) =>
    (!active.companions || companionFit(event, prefs.companions)) && (!active.vibe || vibeFit(event, prefs.vibe, cityFirst)) && regionOk(event));
  let matches = filter();
  const strictCount = matches.length;
  // 1) a two-week window, then (district) region → vibe → companions; (W9-R4, review R§5 #12) in city mode the place
  // the player asked for holds longest: vibe → companions → region (a part of the city → all of San Francisco → the Bay)
  if (matches.length < min && days < 14) { pool = upcomingEvents(catalog, today, 14, opts.now).filter(({ event }) => hardFit(event, prefs)); matches = filter(); }
  const order = cityFirst ? (['vibe', 'companions', 'region'] as const) : (['region', 'vibe', 'companions'] as const);
  for (const step of order) {
    if (matches.length >= min) break;
    if (step === 'companions' && prefs.companions === 'kids') continue; // never relax "with kids"
    const meaningful = step === 'companions' ? !!prefs.companions && prefs.companions !== 'friends' : !!prefs[step] && prefs[step] !== 'any';
    if (!meaningful) continue;
    if (step === 'region' && cityFirst && isSfArea(prefs.region)) {
      wholeCity = true;
      matches = filter();
      if (matches.length >= min) break;
      wholeCity = false;
    }
    active[step] = false;
    matches = filter();
  }
  const ranked = scoreEvents(matches, prefs, today, !active.vibe, cityFirst);
  // (W9-R4) once the vibe is relaxed, every pick that does fit it comes first (the note counts them: 「只有 2 个」 must be
  // the two on the board, not one of them pushed off by a festival); a stable sort keeps the score order inside each
  if (cityFirst && !active.vibe && prefs.vibe && prefs.vibe !== 'any') ranked.sort((a, b) => Number(vibeFit(b.event, prefs.vibe)) - Number(vibeFit(a.event, prefs.vibe)));
  const events = ranked.slice(0, max);
  // Report only what the shown picks actually relax (honest: never claim a relaxation nobody sees).
  const end7 = addDays(today, days);
  const relaxed: RelaxStep[] = [];
  if (events.some(item => item.nextDate > end7)) relaxed.push('window');
  if ((!active.region || wholeCity) && events.some(item => !regionFit(item.event, prefs.region))) relaxed.push('region');
  if (!active.vibe && events.some(item => !vibeFit(item.event, prefs.vibe, cityFirst))) relaxed.push('vibe');
  if (!active.companions && events.some(item => !companionFit(item.event, prefs.companions))) relaxed.push('companions');
  const windowDays = relaxed.includes('window') ? 14 : days;
  // what the asked place really had (the region note's count): its events fitting the answers still held
  const inRegion = pool.filter(({ event }) => regionFit(event, prefs.region)
    && (!active.companions || companionFit(event, prefs.companions)) && (!active.vibe || vibeFit(event, prefs.vibe, cityFirst))
    && eventDaysInWindow(event, today, addDays(today, windowDays), today).length > 0).length;
  // (W9-R-review R-RC-3) district mode keeps its old note (the counted wording is city mode's)
  const result: WeekResult = { events, relaxed, windowDays, strictCount, ...(cityFirst ? { counts: { inRegion } } : {}) };
  result.note = relaxNote(result, prefs, cityFirst);
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
  seniors: { zh: '适合带长辈', en: 'Good with elders' },
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
/** (W9-R4) `outdoor`: an open-air venue (a stage, tents, a street arch — not a board at an indoor door). */
export interface EventSpot { x: number; z: number; lat: number; lng: number; name: Bilingual; outdoor?: boolean }
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
