import type { EditorialStatus, EventEditorial, MonthlyEvent } from '../monthly-types';
import type { FreebieOffer } from '../../components/FreebieBoard';
import type { SeptemberOpening } from '../september-openings';
import { displayUnits } from '../../lib/event-facts';
import eventEntries from './events.json';
import offerEntries from './offers.json';
import openingEntries from './openings.json';

/**
 * Editorial overlay (plan CNT-EVENTS; content.md §4.4). Short forms and structured facts keyed by id, applied after
 * every other content and media overlay. Source packages stay untouched and `verifiedAt` is never set here (D12).
 * Only ids with an entry change, so a new catalog item keeps its own text until an editor writes its entry (RC-29).
 * Corrections (`fix`) carry a dated source read in `docs/source-reads-2026-10.md`.
 */

/** Fields an entry may correct. `id`, `verifiedAt` and `imageKey` belong to the source package and the media overlays. */
type Correctable<T> = Partial<Omit<T, 'id' | 'verifiedAt' | 'imageKey'>>;
/**
 * `plan` replaces the cleaned plan: a number keeps that line of `cleanPlan(...)`, a string is a rewritten line.
 * `fix` corrects source facts; each correction has a dated source read in `docs/source-reads-2026-10.md`.
 */
export type EventOverlayEntry = EventEditorial & { plan?: (string | number)[]; fix?: Correctable<MonthlyEvent> };
/**
 * Offer fields read by `src/lib/event-facts.ts` (`valueText`, `publicBenefit`) plus the shared short forms.
 * `status: 'sold_out'` marks an offer with nothing on sale right now (its date label says when the next batch opens).
 */
export type OfferEditorial = { shortTitle?: string; dek?: string; tips?: string[]; valueText?: string; publicBenefit?: boolean; status?: EditorialStatus };
export type OfferOverlayEntry = OfferEditorial & { fix?: Correctable<FreebieOffer> };
export type OpeningEditorial = { shortTitle?: string; dek?: string };
/** `openedOn` only where the source states the first day of public service. */
export type OpeningOverlayEntry = OpeningEditorial & { openedOn?: string; fix?: Correctable<SeptemberOpening> };

export const EVENT_OVERLAY = eventEntries as Record<string, EventOverlayEntry>;
export const OFFER_OVERLAY = offerEntries as Record<string, OfferOverlayEntry>;
export const OPENING_OVERLAY = openingEntries as Record<string, OpeningOverlayEntry>;
/** Sources are recorded for the lint, tests and prerender scripts only; a production build never fills the map. */
const RECORD_SOURCES = !import.meta.env?.PROD;
/**
 * The record each entry was applied to, keyed `kind:id`: the lint compares it with basis.json to spot later source
 * edits. Filled outside production builds only (Node scripts, tests, the dev server).
 */
export const PRE_OVERLAY = new Map<string, Record<string, unknown>>();
type Sources = Map<string, Record<string, unknown>> | undefined;
const defaultSources = (): Sources => RECORD_SOURCES ? PRE_OVERLAY : undefined;

/** Sentences that carry no fact about the item (content.md §2.5: on 169 events, 56 of them free). */
export const FILLER_SENTENCES = [
  '出发前查看主办方最新公告，按场次确认余票、入场要求及交通安排。',
  '具体预约、年龄和票种条件见官方来源。',
  '出发前查看官网更新。',
] as const;
export const DATE_LINE_PREFIX = '时间安排：';
export const COST_LINE_PREFIX = '费用与参加条件：';
const squash = (text: string) => text.replace(/[\s。；;，,]/gu, '');

/**
 * The plan without filler, without a "时间安排：" line that only repeats the date label, and without the copy of the
 * cost label at the start of a "费用与参加条件：" line (what follows it stays as its own line). Duplicates collapse.
 */
export function cleanPlan(plan: readonly string[], dateLabel: string, costLabel: string): string[] {
  const lines: string[] = [];
  for (const line of plan) {
    let text = FILLER_SENTENCES.reduce((rest, filler) => rest.replaceAll(filler, ''), line).trim();
    if (text.startsWith(DATE_LINE_PREFIX) && squash(dateLabel).includes(squash(text.slice(DATE_LINE_PREFIX.length)))) continue;
    if (text.startsWith(COST_LINE_PREFIX) && text.slice(COST_LINE_PREFIX.length).startsWith(costLabel)) {
      text = text.slice(COST_LINE_PREFIX.length + costLabel.length).replace(/^[\s。；;，,]+/u, '').trim();
    }
    if (text && !lines.includes(text)) lines.push(text);
  }
  return lines;
}

/**
 * A label never repeats its own dates: "10/24 · 10 月 24 日 · 11:00–14:00" → "10/24 · 11:00–14:00",
 * "10/17 · 10/17/2026 18:30开始" → "10/17 · 18:30开始", "10/17–10/18 · 10 月 17–18 日 · 周六…" → "10/17–10/18 · 周六…".
 * Labels whose text after the dates adds per-day detail ("10/16–10/17 · 10/16 09:30…") stay as they are.
 */
export function cleanDateLabel(label: string, startDate: string, endDate: string): string {
  const [year, month, day] = startDate.split('-').map(Number);
  const [, endMonth, endDay] = endDate.split('-').map(Number);
  const oneDay = startDate === endDate;
  const head = oneDay ? `${month}/${day} · ` : `${month}/${day}–${endMonth}/${endDay} · `;
  if (!label.startsWith(head)) return label;
  const rest = label.slice(head.length);
  const repeats = oneDay
    ? [`${month} 月 ${day} 日 · `, `${month} 月 ${day} 日 `, `${month}月${day}日 `, `${month}/${day}/${year} `]
    : month === endMonth ? [`${month} 月 ${day}–${endDay} 日 · `] : [];
  const repeat = repeats.find(text => rest.startsWith(text));
  return repeat && rest.length > repeat.length ? head + rest.slice(repeat.length) : label;
}

const TITLE_SEPARATOR = /[：:｜|]| — | – /u;
/** A title that already reads as a card title (≤16 units, no separator) is its own short title. */
export const ownShortTitle = (title: string) => displayUnits(title) <= 16 && !TITLE_SEPARATOR.test(title) ? title : undefined;

const STREET_ADDRESS = /^\d+[A-Za-z]?[\s–-]|\bCA\b|\d{5}/u;
/**
 * "Baldwin Park · 2790A Parkside Circle, Concord, CA" → place "Baldwin Park", address "2790A Parkside Circle, Concord, CA";
 * "Fairfax Library, 2097 Sir Francis Drake Boulevard" splits at the comma before the street number. An entry's own
 * `venueShort` / `address` wins; an empty `address` means the venue has no single street address.
 */
export function venueParts(venue: string): { venueShort: string; address?: string } {
  const parts = venue.split(' · ');
  let place = parts[0], address: string | undefined;
  if (parts.length > 1 && STREET_ADDRESS.test(parts[parts.length - 1])) address = parts[parts.length - 1];
  else if (parts.length === 1) {
    const match = /^(.*?),\s*(\d+.*)$/u.exec(venue);
    if (match) [place, address] = [match[1], match[2]];
  }
  return { venueShort: place.replace(/[，,;；].*$/u, '').trim(), ...(address ? { address: address.replace(/[；;].*$/u, '').trim() } : {}) };
}

export function applyEventOverlay<T extends MonthlyEvent>(events: T[], entries: Record<string, EventOverlayEntry> = EVENT_OVERLAY, sources: Sources = defaultSources()): T[] {
  return events.map(event => {
    if (!Object.hasOwn(entries, event.id)) return event;
    sources?.set(`event:${event.id}`, event);
    const { fix, plan, venueShort, address, ...editorial } = entries[event.id];
    const corrected = { ...event, ...fix };
    const cleaned = cleanPlan(event.plan, event.dateLabel, event.costLabel);
    const place = venueParts(corrected.venue);
    const street = address ?? place.address;
    return {
      ...corrected, ...editorial,
      dateLabel: cleanDateLabel(corrected.dateLabel, corrected.startDate, corrected.endDate),
      plan: plan ? plan.flatMap(line => typeof line === 'number' ? cleaned[line] ?? [] : [line]) : cleaned,
      shortTitle: editorial.shortTitle ?? ownShortTitle(corrected.title),
      venueShort: venueShort ?? place.venueShort,
      ...(street ? { address: street } : {}),
    };
  });
}

export function applyOfferOverlay<T extends FreebieOffer>(offers: T[], entries: Record<string, OfferOverlayEntry> = OFFER_OVERLAY, sources: Sources = defaultSources()): (T & OfferEditorial)[] {
  return offers.map(offer => {
    if (!Object.hasOwn(entries, offer.id)) return offer;
    sources?.set(`offer:${offer.id}`, offer);
    const { fix, ...editorial } = entries[offer.id];
    const corrected = { ...offer, ...fix };
    return { ...corrected, ...editorial, shortTitle: editorial.shortTitle ?? ownShortTitle(corrected.title) };
  });
}

export function applyOpeningOverlay<T extends SeptemberOpening>(openings: T[], entries: Record<string, OpeningOverlayEntry> = OPENING_OVERLAY, sources: Sources = defaultSources()): (T & OpeningEditorial)[] {
  return openings.map(shop => {
    if (!Object.hasOwn(entries, shop.id)) return shop;
    sources?.set(`opening:${shop.id}`, shop);
    const { fix, ...editorial } = entries[shop.id];
    const corrected = { ...shop, ...fix };
    return { ...corrected, ...editorial, shortTitle: editorial.shortTitle ?? ownShortTitle(corrected.name) };
  });
}
