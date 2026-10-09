import type { MonthlyEvent } from '../monthly-types';
import type { FreebieOffer } from '../../components/FreebieBoard';
import type { SeptemberOpening } from '../september-openings';
import { displayUnits } from '../../lib/event-facts';
import { COST_LINE_PREFIX, DATE_LINE_PREFIX, FILLER_SENTENCES, type EventOverlayEntry, type OfferEditorial, type OfferOverlayEntry, type OpeningEditorial, type OpeningOverlayEntry } from './apply';

/**
 * Editorial lints (content.md §4.4; plan CNT-EVENTS; RC-29). Run by `scripts/audit-editorial-content.ts` and the
 * overlay test, never by the app. Items with an overlay entry get errors; items without one (new catalog content
 * that no editor has covered yet) get the same findings as warnings, so content PRs are not blocked by this lane.
 */
export type LintLevel = 'error' | 'warn';
export type LintKind = 'event' | 'offer' | 'opening';
export type LintIssue = { level: LintLevel; kind: LintKind; id: string; rule: string; detail: string };
export type Overlay = { events: Record<string, EventOverlayEntry>; offers: Record<string, OfferOverlayEntry>; openings: Record<string, OpeningOverlayEntry> };
/** Source values the overlay was written against, from `basis.json`. */
export type Basis = Record<string, Record<string, unknown>>;
export type LintInput = {
  events: MonthlyEvent[];
  offers: (FreebieOffer & OfferEditorial)[];
  openings: (SeptemberOpening & OpeningEditorial)[];
  overlay: Overlay;
  /** The merged English dictionary (every file in scripts/english-sources.json). */
  english: Record<string, string>;
  /** Items ending before this day are archive pages and are not linted. */
  from: string;
  /** Pre-overlay source records (`PRE_OVERLAY` in apply.ts) and the values recorded in basis.json. */
  sources?: Map<string, Record<string, unknown>>;
  basis?: Basis;
};

/** The source fields an entry's short forms and corrections were written against (`basis.json`). */
export const BASIS_FIELDS = {
  event: ['title', 'startDate', 'endDate', 'occurrenceDates', 'dateLabel', 'cost', 'costLabel', 'venue', 'plan'],
  offer: ['title', 'startDate', 'endDate', 'dateLabel', 'requirement', 'description'],
  opening: ['name', 'status', 'openedOn', 'dateLabel', 'summary', 'editorTip'],
} as const;

/** The merged English dictionary, read from its sources (the same order as the generated english.json). */
export function readEnglishSources(read: (path: string) => string): Record<string, string> {
  const files = JSON.parse(read('scripts/english-sources.json')) as string[];
  return Object.assign({}, ...files.map(file => JSON.parse(read(file)) as Record<string, string>));
}

/** Pipeline vocabulary and editor's-log self-reference that must never reach a reader (CNT-09: 本次/本条/本卡…). */
export const INTERNAL_NOTE = /本包|本轮|本次|本卡|本条|本记录|录入|(?<!\d)403(?!\d)|读取|抓取|不再声明|returned|缓存|web open|封面|核实时已/iu;
/** Self-defensive phrasing (content.md §2.5); a warning, rewritten item by item. */
export const SELF_DEFENSIVE = /不把|不当作|不代表|不保证|不等于|非亲测|不直接|不沿用|不能据/u;
const HEDGES = /待核实|待确认|未核实|未确认|以[^，。；]{1,12}为准|出发前|复核|再查|另查|核对|可能/gu;
const DATE_LINE = /^\d{4}-\d{2}-\d{2}$/u;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/u;
const TITLE_SEPARATOR = /[：:｜|]| — | – /u;
const HAN = /[㐀-鿿]/u;
const LIMITS = { shortTitle: 16, dek: 30, tip: 40, tips: 3, dateLabel: 40 } as const;
const FORBIDDEN_FIX = ['id', 'verifiedAt', 'imageKey'];
const normalize = (text: string) => text.trim().replace(/\s+/gu, ' ');
const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];

export function lintEditorial(input: LintInput): LintIssue[] {
  const issues: LintIssue[] = [];
  const add = (covered: boolean, kind: LintKind, id: string, rule: string, detail: string, level?: LintLevel) => issues.push({ level: level ?? (covered ? 'error' : 'warn'), kind, id, rule, detail });
  /** Every Chinese string an entry adds must have its own English entry (zh-Hant is the runtime conversion). */
  const english = (covered: boolean, kind: LintKind, id: string, texts: string[]) => {
    for (const text of texts) if (HAN.test(text) && !Object.hasOwn(input.english, normalize(text))) add(covered, kind, id, 'english', text);
  };
  const reader = (covered: boolean, kind: LintKind, id: string, fields: Record<string, unknown>) => {
    for (const [field, value] of Object.entries(fields)) for (const text of strings(value)) {
      if (INTERNAL_NOTE.test(text)) add(covered, kind, id, 'internal-note', `${field}: ${text}`);
      if (SELF_DEFENSIVE.test(text)) add(covered, kind, id, 'self-defensive', `${field}: ${text}`, 'warn');
    }
  };
  const short = (covered: boolean, kind: LintKind, id: string, entry: { shortTitle?: string; dek?: string; tips?: string[] }, applied: { shortTitle?: string }) => {
    if (covered && !applied.shortTitle) add(true, kind, id, 'short-title', 'missing');
    if (applied.shortTitle && (displayUnits(applied.shortTitle) > LIMITS.shortTitle || TITLE_SEPARATOR.test(applied.shortTitle))) add(covered, kind, id, 'short-title', `${applied.shortTitle} (${displayUnits(applied.shortTitle)} units)`);
    if (entry.dek && displayUnits(entry.dek) > LIMITS.dek) add(covered, kind, id, 'dek', `${entry.dek} (${displayUnits(entry.dek)} units)`);
    if (entry.tips && (entry.tips.length > LIMITS.tips || entry.tips.some(tip => !tip.trim() || displayUnits(tip) > LIMITS.tip))) add(covered, kind, id, 'tips', entry.tips.join(' | '));
  };
  const fixKeys = (kind: LintKind, id: string, fix: object | undefined) => {
    for (const key of Object.keys(fix ?? {})) if (FORBIDDEN_FIX.includes(key)) add(true, kind, id, 'fix-field', `${key} belongs to the source package`);
  };
  const drift = (kind: LintKind, id: string) => {
    const recorded = input.basis?.[`${kind}:${id}`], source = input.sources?.get(`${kind}:${id}`);
    if (!recorded || !source) return;
    for (const [field, value] of Object.entries(recorded)) if (JSON.stringify(source[field]) !== JSON.stringify(value)) add(false, kind, id, 'source-changed', `${field} changed since the overlay entry was written; re-check it`);
  };

  const eventIds = new Set(input.events.map(event => event.id));
  for (const id of Object.keys(input.overlay.events)) if (!eventIds.has(id)) add(true, 'event', id, 'unknown-id', 'overlay entry has no catalog event');
  for (const event of input.events) {
    if (event.endDate < input.from) continue;
    const covered = Object.hasOwn(input.overlay.events, event.id);
    const entry: EventOverlayEntry = covered ? input.overlay.events[event.id] : {};
    reader(covered, 'event', event.id, { title: event.title, summary: event.summary, dateLabel: event.dateLabel, costLabel: event.costLabel, venue: event.venue, plan: event.plan, audience: event.audience, dek: event.dek, tips: event.tips, dateNote: event.dateNote });
    if (/免费/u.test(event.title) && event.cost !== 'free' && event.cost !== 'mixed') add(covered, 'event', event.id, 'free-title', `cost is ${event.cost}`);
    if (event.cost === 'free' && [...event.plan, ...(event.tips ?? []), event.costLabel].some(text => /余票/u.test(text))) add(covered, 'event', event.id, 'free-sold-out', '免费活动不提“余票”');
    for (const line of event.plan) {
      if (FILLER_SENTENCES.some(filler => line.includes(filler))) add(covered, 'event', event.id, 'boilerplate', line);
      if (line.startsWith(DATE_LINE_PREFIX) || line.startsWith(COST_LINE_PREFIX) || line.startsWith(event.dateLabel) || line.startsWith(event.costLabel)) add(covered, 'event', event.id, 'plan-repeats-label', line);
    }
    if (new Set(event.plan).size !== event.plan.length) add(covered, 'event', event.id, 'plan-duplicate', 'repeated line');
    if (displayUnits(event.dateLabel) > LIMITS.dateLabel) add(false, 'event', event.id, 'date-label-long', `${displayUnits(event.dateLabel)} units`);
    const prose = [event.summary, ...event.plan].join('');
    const hedges = prose.match(HEDGES)?.length ?? 0;
    if (prose.length && hedges * 1000 / prose.length > 8) add(false, 'event', event.id, 'hedging', `${hedges} hedges in ${prose.length} characters`);
    if (!covered) continue;
    short(true, 'event', event.id, entry, event);
    fixKeys('event', event.id, entry.fix);
    drift('event', event.id);
    for (const session of event.sessions ?? []) {
      const confirmed = event.occurrenceDates;
      if (!DATE_LINE.test(session.date) || session.date < event.startDate || session.date > event.endDate || (confirmed && !confirmed.includes(session.date))) add(true, 'event', event.id, 'sessions', `${session.date} is not a confirmed day`);
      if ((session.start && !TIME.test(session.start)) || (session.end && !TIME.test(session.end)) || (session.end && !session.start) || (session.start && session.end && session.end <= session.start)) add(true, 'event', event.id, 'sessions', `${session.date} ${session.start ?? ''}–${session.end ?? ''}`);
    }
    if (event.sessions && new Set(event.sessions.map(session => session.date)).size !== event.sessions.length) add(true, 'event', event.id, 'sessions', 'repeated day');
    const price = event.price;
    if (price) {
      const numbers = [price.min, price.max].filter((value): value is number => value !== undefined);
      if (numbers.some(value => !Number.isFinite(value) || value < 0) || (price.min !== undefined && price.max !== undefined && price.max < price.min)) add(true, 'event', event.id, 'price', JSON.stringify(price));
      if (price.free && event.cost !== 'free' && event.cost !== 'mixed') add(true, 'event', event.id, 'price', `free entry but cost is ${event.cost}`);
      if ((price.min ?? 0) > 0 && event.cost !== 'paid' && event.cost !== 'mixed') add(true, 'event', event.id, 'price', `an amount but cost is ${event.cost}`);
    }
    english(true, 'event', event.id, [event.shortTitle ?? '', event.dek ?? '', ...(event.tips ?? []), event.dateNote ?? '', event.ageChip ?? '', event.venueShort ?? '', event.address ?? '', price?.note ?? '', ...event.plan, ...strings(entry.fix)]);
  }

  const offerIds = new Set(input.offers.map(offer => offer.id));
  for (const id of Object.keys(input.overlay.offers)) if (!offerIds.has(id)) add(true, 'offer', id, 'unknown-id', 'overlay entry has no catalog offer');
  for (const offer of input.offers) {
    if (offer.endDate && offer.endDate < input.from) continue;
    const covered = Object.hasOwn(input.overlay.offers, offer.id);
    const entry: OfferOverlayEntry = covered ? input.overlay.offers[offer.id] : {};
    reader(covered, 'offer', offer.id, { title: offer.title, dateLabel: offer.dateLabel, requirement: offer.requirement, description: offer.description, dek: offer.dek, tips: offer.tips });
    if (!covered) continue;
    short(true, 'offer', offer.id, entry, offer);
    fixKeys('offer', offer.id, entry.fix);
    drift('offer', offer.id);
    english(true, 'offer', offer.id, [offer.shortTitle ?? '', offer.dek ?? '', ...(offer.tips ?? []), ...strings(entry.fix)]);
  }

  const openingIds = new Set(input.openings.map(shop => shop.id));
  for (const id of Object.keys(input.overlay.openings)) if (!openingIds.has(id)) add(true, 'opening', id, 'unknown-id', 'overlay entry has no catalog opening');
  for (const shop of input.openings) {
    const covered = Object.hasOwn(input.overlay.openings, shop.id);
    const entry: OpeningOverlayEntry = covered ? input.overlay.openings[shop.id] : {};
    reader(covered, 'opening', shop.id, { summary: shop.summary, editorTip: shop.editorTip, dateLabel: shop.dateLabel, category: shop.category, dek: shop.dek });
    if (!covered) continue;
    short(true, 'opening', shop.id, entry, shop);
    fixKeys('opening', shop.id, entry.fix);
    drift('opening', shop.id);
    if (entry.openedOn !== undefined && (!DATE_LINE.test(entry.openedOn) || shop.status === 'announced')) add(true, 'opening', shop.id, 'opened-on', `${entry.openedOn} (${shop.status})`);
    english(true, 'opening', shop.id, [shop.shortTitle ?? '', shop.dek ?? '', ...strings(entry.fix)]);
  }
  return issues;
}

/** Share of live covered items with each field, for the PR and the lane report. */
export function overlayCoverage(input: Pick<LintInput, 'events' | 'overlay' | 'from'>) {
  const live = input.events.filter(event => event.endDate >= input.from);
  const covered = live.filter(event => Object.hasOwn(input.overlay.events, event.id));
  const count = (field: keyof MonthlyEvent) => covered.filter(event => event[field] !== undefined && event[field] !== '').length;
  return { live: live.length, covered: covered.length, shortTitle: count('shortTitle'), dek: count('dek'), sessions: count('sessions'), price: count('price'), venueShort: count('venueShort'), address: count('address'), ageChip: count('ageChip'), tips: count('tips'), dateNote: count('dateNote') };
}
