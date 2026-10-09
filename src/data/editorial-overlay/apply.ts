import type { EventEditorial, MonthlyEvent } from '../monthly-types';
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
export type EventOverlayEntry = EventEditorial & { plan?: string[]; fix?: Correctable<MonthlyEvent> };
/** Offer fields read by `src/lib/event-facts.ts` (`valueText`, `publicBenefit`) plus the shared short forms. */
export type OfferEditorial = { shortTitle?: string; dek?: string; tips?: string[]; valueText?: string; publicBenefit?: boolean };
export type OfferOverlayEntry = OfferEditorial & { fix?: Correctable<FreebieOffer> };
export type OpeningEditorial = { shortTitle?: string; dek?: string };
/** `openedOn` only where the source states the first day of public service. */
export type OpeningOverlayEntry = OpeningEditorial & { openedOn?: string; fix?: Correctable<SeptemberOpening> };

export const EVENT_OVERLAY = eventEntries as Record<string, EventOverlayEntry>;
export const OFFER_OVERLAY = offerEntries as Record<string, OfferOverlayEntry>;
export const OPENING_OVERLAY = openingEntries as Record<string, OpeningOverlayEntry>;

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

const TITLE_SEPARATOR = /[：:｜|]| — | – /u;
/** A title that already reads as a card title (≤16 units, no separator) is its own short title. */
export const ownShortTitle = (title: string) => displayUnits(title) <= 16 && !TITLE_SEPARATOR.test(title) ? title : undefined;

export function applyEventOverlay<T extends MonthlyEvent>(events: T[], entries: Record<string, EventOverlayEntry> = EVENT_OVERLAY): T[] {
  return events.map(event => {
    if (!Object.hasOwn(entries, event.id)) return event;
    const { fix, plan, ...editorial } = entries[event.id];
    const corrected = { ...event, ...fix };
    return { ...corrected, ...editorial, plan: plan ?? cleanPlan(event.plan, event.dateLabel, event.costLabel), shortTitle: editorial.shortTitle ?? ownShortTitle(corrected.title) };
  });
}

export function applyOfferOverlay<T extends FreebieOffer>(offers: T[], entries: Record<string, OfferOverlayEntry> = OFFER_OVERLAY): (T & OfferEditorial)[] {
  return offers.map(offer => {
    if (!Object.hasOwn(entries, offer.id)) return offer;
    const { fix, ...editorial } = entries[offer.id];
    const corrected = { ...offer, ...fix };
    return { ...corrected, ...editorial, shortTitle: editorial.shortTitle ?? ownShortTitle(corrected.title) };
  });
}

export function applyOpeningOverlay<T extends SeptemberOpening>(openings: T[], entries: Record<string, OpeningOverlayEntry> = OPENING_OVERLAY): (T & OpeningEditorial)[] {
  return openings.map(shop => {
    if (!Object.hasOwn(entries, shop.id)) return shop;
    const { fix, ...editorial } = entries[shop.id];
    const corrected = { ...shop, ...fix };
    return { ...corrected, ...editorial, shortTitle: editorial.shortTitle ?? ownShortTitle(corrected.name) };
  });
}
