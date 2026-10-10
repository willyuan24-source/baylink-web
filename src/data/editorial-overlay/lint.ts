import type { MonthlyEvent } from '../monthly-types';
import type { FreebieOffer } from '../../components/FreebieBoard';
import type { SeptemberOpening } from '../september-openings';
import { displayUnits } from '../../lib/event-facts';
import { cleanPlan, COST_LINE_PREFIX, DATE_LINE_PREFIX, FILLER_SENTENCES, type EventOverlayEntry, type OfferEditorial, type OfferOverlayEntry, type OpeningEditorial, type OpeningOverlayEntry } from './apply';

/**
 * Editorial lints (content.md §4.4; plan CNT-EVENTS; RC-29). Run by `scripts/audit-editorial-content.ts` and the
 * overlay test, never by the app. Items with an overlay entry get errors; items without one (new catalog content
 * that no editor has covered yet) get the same findings as warnings, so content PRs are not blocked by this lane.
 */
export type LintLevel = 'error' | 'warn';
export type LintKind = 'event' | 'offer' | 'opening';
export type LintIssue = { level: LintLevel; kind: LintKind; id: string; rule: string; detail: string };
export type Overlay = { events: Record<string, EventOverlayEntry>; offers: Record<string, OfferOverlayEntry>; openings: Record<string, OpeningOverlayEntry> };
/** `kind:id` → field → `fieldHash` of the source value the entry was written against (`basis.json`). */
export type Basis = Record<string, Record<string, string>>;
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
  event: ['title', 'startDate', 'endDate', 'occurrenceDates', 'dateLabel', 'cost', 'costLabel', 'venue', 'plan', 'summary', 'audience'],
  offer: ['title', 'startDate', 'endDate', 'dateLabel', 'requirement', 'description'],
  opening: ['name', 'status', 'openedOn', 'dateLabel', 'summary', 'editorTip'],
} as const;

/** FNV-1a over the JSON of a field value: 8 hex characters, enough to notice that a source field changed. */
export function fieldHash(value: unknown): string {
  let hash = 0x811c9dc5;
  for (const char of JSON.stringify(value ?? null)) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

/** basis.json content for the given pre-overlay records (`PRE_OVERLAY`), sorted for stable diffs. */
export function basisFor(sources: Map<string, Record<string, unknown>>): Basis {
  return Object.fromEntries([...sources].sort(([a], [b]) => a.localeCompare(b)).map(([key, record]) => [key,
    Object.fromEntries(BASIS_FIELDS[key.split(':')[0] as keyof typeof BASIS_FIELDS].map(field => [field, fieldHash(record[field])]))]));
}

/**
 * Source fields each stored entry field was written from. When one of them changes upstream, the stored value would
 * silently win over the edit (the overlay applies last), so the lint reports an error until an editor re-checks the
 * entry. A `fix.<field>` always depends on that same source field.
 */
export const DERIVED_FROM: Record<LintKind, Record<string, readonly string[]>> = {
  event: {
    shortTitle: ['title'], price: ['cost', 'costLabel'], sessions: ['startDate', 'endDate', 'occurrenceDates', 'dateLabel'],
    dateNote: ['startDate', 'endDate', 'occurrenceDates', 'dateLabel'], venueShort: ['venue'], address: ['venue'], ageChip: ['audience'],
    plan: ['plan'], status: ['startDate', 'endDate', 'occurrenceDates', 'dateLabel', 'costLabel'],
  },
  offer: { shortTitle: ['title'], status: ['startDate', 'endDate', 'dateLabel'] },
  opening: { shortTitle: ['name'], openedOn: ['status', 'openedOn', 'dateLabel'] },
};
/** The stored entry fields that would mask an upstream edit of each source field. */
export function overriddenFields(kind: LintKind, entry: object & { fix?: object }): Map<string, string[]> {
  const owners = new Map<string, string[]>();
  const own = (source: string, owner: string) => owners.set(source, [...(owners.get(source) ?? []), owner]);
  for (const key of Object.keys(entry)) if (key !== 'fix') for (const source of DERIVED_FROM[kind][key] ?? []) own(source, key);
  for (const key of Object.keys(entry.fix ?? {})) own(key, `fix.${key}`);
  return owners;
}
export const STATUSES = ['postponed', 'cancelled', 'sold_out'] as const;

/** The merged English dictionary, read from its sources (the same order as the generated english.json). */
export function readEnglishSources(read: (path: string) => string): Record<string, string> {
  const files = JSON.parse(read('scripts/english-sources.json')) as string[];
  return Object.assign({}, ...files.map(file => JSON.parse(read(file)) as Record<string, string>));
}

/** Pipeline vocabulary and editor's-log self-reference that must never reach a reader (CNT-09: 本次/本条/本卡…). */
export const INTERNAL_NOTE = /本包|本轮|本次|本卡|本条|本记录|录入|(?:^|\D)403(?!\d)|读取|抓取|不再声明|returned|缓存|web open|封面|核实时已/iu;
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
/** Text without spaces and punctuation, to compare a tip with the fields shown beside it. */
const squash = (text: string) => text.replace(/[\s。；;，,、：:（）()·.!！?？“”"'‘’]/gu, '');
const bigrams = (text: string) => {
  const chars = [...squash(text)];
  return new Set(chars.slice(0, -1).map((char, index) => char + chars[index + 1]));
};
/** Share of a tip's character pairs that one shown field already carries (1 = the field says all of it). */
const overlap = (tip: string, field: string) => {
  const own = bigrams(tip), other = bigrams(field);
  return own.size ? [...own].filter(pair => other.has(pair)).length / own.size : 0;
};
/**
 * A tip must add information no other shown field carries (content.md §4.4). A tip contained in the plan, a label,
 * the summary or the date note (after squashing) is an error; one whose wording is mostly in one field is a warning.
 */
export function tipRepeats(tip: string, shown: Record<string, string | readonly string[]>): { field: string; level: LintLevel } | undefined {
  let warn: string | undefined;
  for (const [field, value] of Object.entries(shown)) for (const text of typeof value === 'string' ? [value] : value) {
    if (squash(tip) && squash(text).includes(squash(tip))) return { field, level: 'error' };
    if (!warn && overlap(tip, text) >= 0.75) warn = field;
  }
  return warn ? { field: warn, level: 'warn' } : undefined;
}
const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];

export function lintEditorial(input: LintInput): LintIssue[] {
  const issues: LintIssue[] = [];
  const add = (covered: boolean, kind: LintKind, id: string, rule: string, detail: string, level?: LintLevel) => issues.push({ level: level ?? (covered ? 'error' : 'warn'), kind, id, rule, detail });
  /** Every Chinese string an entry adds must have its own English entry (zh-Hant is the runtime conversion). */
  const english = (covered: boolean, kind: LintKind, id: string, texts: string[]) => {
    for (const text of texts) if (HAN.test(text) && !Object.hasOwn(input.english, normalize(text))) add(covered, kind, id, 'english', text);
  };
  /** A composed label translates whole or, like `translateText`, part by part at its separators. */
  const englishLabel = (kind: LintKind, id: string, label: string) => {
    if (!HAN.test(label) || Object.hasOwn(input.english, normalize(label))) return;
    for (const part of label.split(/\n| · | \/ |｜/u)) if (HAN.test(part) && !Object.hasOwn(input.english, normalize(part))) add(true, kind, id, 'english', `${label} (${part})`);
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
  /** A fix key the basis does not track could mask an upstream edit unnoticed. */
  const fixKeys = (kind: LintKind, id: string, fix: object | undefined) => {
    for (const key of Object.keys(fix ?? {})) {
      if (FORBIDDEN_FIX.includes(key)) add(true, kind, id, 'fix-field', `${key} belongs to the source package`);
      else if (!(BASIS_FIELDS[kind] as readonly string[]).includes(key)) add(true, kind, id, 'fix-field', `${key} is not tracked in BASIS_FIELDS, so an upstream edit would go unnoticed`);
    }
  };
  /**
   * A source field that changed since the entry was written (basis.json): an error when a stored entry field overrides
   * it (the upstream edit would be masked), otherwise a warning to re-read the short forms.
   */
  const drift = (kind: LintKind, id: string, entry: object & { fix?: object }) => {
    const recorded = input.basis?.[`${kind}:${id}`], source = input.sources?.get(`${kind}:${id}`);
    if (!recorded || !source) return;
    const owners = overriddenFields(kind, entry);
    for (const [field, hash] of Object.entries(recorded)) {
      if (fieldHash(source[field]) === hash) continue;
      const masking = owners.get(field);
      if (masking) add(true, kind, id, 'source-changed', `${field} changed upstream but the entry's ${masking.join(', ')} still applies over it: update or remove that, then run the audit with --write-basis`);
      else add(false, kind, id, 'source-changed', `${field} changed since the overlay entry was written; re-check it`);
    }
  };

  const eventIds = new Set(input.events.map(event => event.id));
  for (const id of Object.keys(input.overlay.events)) if (!eventIds.has(id)) add(false, 'event', id, 'unknown-id', 'overlay entry has no catalog event (removed upstream?)');
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
    drift('event', event.id, entry);
    const source = input.sources?.get(`event:${event.id}`) as MonthlyEvent | undefined;
    if (entry.plan && source) {
      const cleaned = cleanPlan(source.plan, source.dateLabel, source.costLabel);
      for (const line of entry.plan) if (typeof line === 'number' && !(Number.isInteger(line) && line >= 0 && line < cleaned.length)) add(true, 'event', event.id, 'plan-index', `line ${line} of ${cleaned.length} cleaned lines`);
    }
    for (const session of event.sessions ?? []) {
      const confirmed = event.occurrenceDates;
      if (!DATE_LINE.test(session.date) || session.date < event.startDate || session.date > event.endDate || (confirmed && !confirmed.includes(session.date))) add(true, 'event', event.id, 'sessions', `${session.date} is not a confirmed day`);
      if ((session.start && !TIME.test(session.start)) || (session.end && !TIME.test(session.end)) || (session.end && !session.start) || (session.start && session.end && session.end <= session.start)) add(true, 'event', event.id, 'sessions', `${session.date} ${session.start ?? ''}–${session.end ?? ''}`);
    }
    if (event.sessions && new Set(event.sessions.map(session => session.date)).size !== event.sessions.length) add(true, 'event', event.id, 'sessions', 'repeated day');
    for (const tip of event.tips ?? []) {
      const repeat = tipRepeats(tip, { plan: event.plan, costLabel: event.costLabel, dateLabel: event.dateLabel, summary: event.summary, dateNote: event.dateNote ?? '' });
      if (repeat) add(true, 'event', event.id, 'tip-repeats', `${tip} (${repeat.field})`, repeat.level);
    }
    if (event.status !== undefined) {
      if (!(STATUSES as readonly string[]).includes(event.status)) add(true, 'event', event.id, 'status', `unknown status ${event.status}`);
      // A postponed or cancelled event has no confirmed day; its original date belongs in dateNote.
      if ((event.status === 'postponed' || event.status === 'cancelled') && (event.occurrenceDates?.length !== 0 || event.sessions?.length)) add(true, 'event', event.id, 'status', `${event.status} but it still has confirmed days`);
    }
    const price = event.price;
    if (price) {
      const numbers = [price.min, price.max].filter((value): value is number => value !== undefined);
      if (numbers.some(value => !Number.isFinite(value) || value < 0) || (price.min !== undefined && price.max !== undefined && price.max < price.min)) add(true, 'event', event.id, 'price', JSON.stringify(price));
      if (price.free && event.cost !== 'free' && event.cost !== 'mixed') add(true, 'event', event.id, 'price', `free entry but cost is ${event.cost}`);
      if ((price.min ?? 0) > 0 && event.cost !== 'paid' && event.cost !== 'mixed') add(true, 'event', event.id, 'price', `an amount but cost is ${event.cost}`);
    }
    english(true, 'event', event.id, [event.shortTitle ?? '', event.dek ?? '', ...(event.tips ?? []), event.dateNote ?? '', event.ageChip ?? '', event.venueShort ?? '', event.address ?? '', price?.note ?? '', ...event.plan, ...strings(entry.fix)]);
    englishLabel('event', event.id, event.dateLabel);
  }

  const offerIds = new Set(input.offers.map(offer => offer.id));
  for (const id of Object.keys(input.overlay.offers)) if (!offerIds.has(id)) add(false, 'offer', id, 'unknown-id', 'overlay entry has no catalog offer (removed upstream?)');
  for (const offer of input.offers) {
    if (offer.endDate && offer.endDate < input.from) continue;
    const covered = Object.hasOwn(input.overlay.offers, offer.id);
    const entry: OfferOverlayEntry = covered ? input.overlay.offers[offer.id] : {};
    reader(covered, 'offer', offer.id, { title: offer.title, dateLabel: offer.dateLabel, requirement: offer.requirement, description: offer.description, dek: offer.dek, tips: offer.tips });
    if (!covered) continue;
    short(true, 'offer', offer.id, entry, offer);
    if (offer.status !== undefined && offer.status !== 'sold_out') add(true, 'offer', offer.id, 'status', `an offer is only marked sold_out, not ${offer.status}`);
    fixKeys('offer', offer.id, entry.fix);
    drift('offer', offer.id, entry);
    english(true, 'offer', offer.id, [offer.shortTitle ?? '', offer.dek ?? '', ...(offer.tips ?? []), ...strings(entry.fix)]);
  }

  const openingIds = new Set(input.openings.map(shop => shop.id));
  for (const id of Object.keys(input.overlay.openings)) if (!openingIds.has(id)) add(false, 'opening', id, 'unknown-id', 'overlay entry has no catalog opening (removed upstream?)');
  for (const shop of input.openings) {
    const covered = Object.hasOwn(input.overlay.openings, shop.id);
    const entry: OpeningOverlayEntry = covered ? input.overlay.openings[shop.id] : {};
    reader(covered, 'opening', shop.id, { summary: shop.summary, editorTip: shop.editorTip, dateLabel: shop.dateLabel, category: shop.category, dek: shop.dek });
    if (!covered) continue;
    short(true, 'opening', shop.id, entry, shop);
    fixKeys('opening', shop.id, entry.fix);
    drift('opening', shop.id, entry);
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
