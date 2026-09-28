import type { Bilingual, Vec2 } from '../core/types';
import { weekday } from '../data/catalog';
import { fetchSfJson } from './sameSite';

/**
 * Wave 5 · lane R (W5-R7) · 今天免费 from BAYLINK's own offers (plan §3.3): scripts/opus-sf/export-live.ts writes the San
 * Francisco museum, park and transit offers that belong to a place in the game to the same-site
 * `public/opus-bay/sf/v1/live.json`; this module reads it (never a third-party call) and answers which apply on a Bay
 * date. Every offer keeps its own title, conditions, source and check date, and links BAYLINK's `/offers/:id`.
 *
 *   loadLive() / liveOffers()           the parsed file (null until loaded)
 *   offersOn(dateKey)                   the offers that apply that day (a dated offer on its dates; a standing one on its
 *                                       weekdays / n-th weekdays), with that day's hours
 *   standingOffers()                    the always-on offers with a condition (a benefits card, an age): no day rule
 *   offersForPlace(placeId, dateKey?)   what a place card or a map badge can show (lanes C / N)
 */

export interface LiveOffer {
  id: string;
  kind: 'museum' | 'park' | 'transit';
  /** free entry (false: a discount, shown as 优惠) */
  free: boolean;
  title: Bilingual;
  /** who it is for, short */
  who: Bilingual;
  /** the offer's full conditions */
  requirement: Bilingual;
  /** a dated offer's first and last Bay dates */
  from?: string;
  to?: string;
  /** a standing offer's weekdays (0 = Sunday) and n-th weekdays of the month ([weekday, n]) */
  weekdays?: number[];
  nth?: [number, number][];
  /** hours in minutes after Bay midnight: one pair, or seven (by weekday, null = closed) */
  hours?: [number, number] | ([number, number] | null)[];
  place: { id?: string; x: number; z: number; name: Bilingual } | null;
  /** the SF Today hand row (realsf/todayRows.ts) this offer belongs to */
  hand?: string;
  /** `/offers/<id>` on BAYLINK */
  href: string;
  source: { label: string; url: string; verifiedAt: string };
  /** where the day rule and hours were read, and when */
  rule?: { url: string; verifiedAt: string };
}

export interface OfferToday { offer: LiveOffer; hours: [number, number] | null }

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isBi = (v: unknown): v is Bilingual => !!v && typeof v === 'object' && typeof (v as Bilingual).zh === 'string' && typeof (v as Bilingual).en === 'string';
const isPair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number' && n >= 0 && n <= 48 * 60) && v[0] < v[1];
const https = (u: unknown): u is string => typeof u === 'string' && /^https:\/\//.test(u);

/** Parse live.json (untrusted input): rows that do not check out are dropped. */
export function parseLive(raw: unknown): LiveOffer[] | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { offers?: unknown }).offers)) return null;
  const out: LiveOffer[] = [];
  for (const r of (raw as { offers: unknown[] }).offers) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(o.id)) continue;
    if (o.kind !== 'museum' && o.kind !== 'park' && o.kind !== 'transit') continue;
    if (!isBi(o.title) || !isBi(o.who) || !isBi(o.requirement)) continue;
    const src = o.source as Record<string, unknown> | undefined;
    if (!src || typeof src.label !== 'string' || !https(src.url) || typeof src.verifiedAt !== 'string') continue;
    if (o.href !== `/offers/${o.id}`) continue;
    const from = typeof o.from === 'string' && DAY.test(o.from) ? o.from : undefined;
    const to = typeof o.to === 'string' && DAY.test(o.to) ? o.to : undefined;
    const weekdays = Array.isArray(o.weekdays) && o.weekdays.every(n => Number.isInteger(n) && n >= 0 && n <= 6) ? (o.weekdays as number[]) : undefined;
    const nth = Array.isArray(o.nth) && o.nth.every(p => Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && p[0] >= 0 && p[0] <= 6 && Number.isInteger(p[1]) && p[1] >= 1 && p[1] <= 5) ? (o.nth as [number, number][]) : undefined;
    const hours = isPair(o.hours) ? o.hours : Array.isArray(o.hours) && o.hours.length === 7 && o.hours.every(p => p === null || isPair(p)) ? (o.hours as ([number, number] | null)[]) : undefined;
    const p = o.place as Record<string, unknown> | null | undefined;
    const place = p && typeof p.x === 'number' && typeof p.z === 'number' && Number.isFinite(p.x) && Number.isFinite(p.z) && isBi(p.name)
      ? { ...(typeof p.id === 'string' ? { id: p.id } : {}), x: p.x, z: p.z, name: p.name } : null;
    const rule = o.rule as Record<string, unknown> | undefined;
    out.push({
      id: o.id, kind: o.kind, free: o.free !== false, title: o.title, who: o.who, requirement: o.requirement,
      ...(from && to ? { from, to } : {}), ...(weekdays ? { weekdays } : {}), ...(nth ? { nth } : {}), ...(hours ? { hours } : {}),
      place, ...(typeof o.hand === 'string' ? { hand: o.hand } : {}), href: o.href,
      source: { label: src.label, url: src.url, verifiedAt: src.verifiedAt },
      ...(rule && https(rule.url) && typeof rule.verifiedAt === 'string' ? { rule: { url: rule.url, verifiedAt: rule.verifiedAt } } : {}),
    });
  }
  return out;
}

let OFFERS: LiveOffer[] | null = null;
let loading: Promise<LiveOffer[] | null> | null = null;
const listeners = new Set<() => void>();

export function liveOffers(): LiveOffer[] | null { return OFFERS; }
/** Re-render hooks (the 今天 tab) when the file arrives. */
export function subscribeLive(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
/** Tests / QA: install (or clear) the offers. */
export function setLiveForTests(o: LiveOffer[] | null): void { OFFERS = o; loading = o ? Promise.resolve(o) : null; for (const fn of listeners) fn(); }

/** Fetch the same-site live.json once. */
export function loadLive(fetcher?: typeof fetch): Promise<LiveOffer[] | null> {
  if (loading) return loading;
  loading = fetchSfJson('live.json', fetcher).then(raw => {
    OFFERS = parseLive(raw);
    if (!OFFERS) loading = null;
    for (const fn of listeners) fn();
    return OFFERS;
  });
  return loading;
}

/** An offer's hours on a Bay date (null: all its open hours, not stated). */
export function offerHours(o: LiveOffer, dateKey: string): [number, number] | null {
  if (!o.hours) return null;
  if (o.hours.length === 2 && typeof o.hours[0] === 'number') return o.hours as [number, number];
  return (o.hours as ([number, number] | null)[])[weekday(dateKey)] ?? null;
}

const standing = (o: LiveOffer) => !o.from && !o.weekdays && !o.nth;

/** Does the offer apply on the Bay date? (A standing offer with a condition answers false: see standingOffers.) */
export function offerApplies(o: LiveOffer, dateKey: string): boolean {
  if (o.from && o.to) return dateKey >= o.from && dateKey <= o.to;
  const w = weekday(dateKey);
  const d = Number(dateKey.slice(8, 10));
  if (o.weekdays?.includes(w)) return true;
  return !!o.nth?.some(([nw, n]) => nw === w && Math.ceil(d / 7) === n);
}

/** The offers that apply on a Bay date, with that day's hours (a weekday it is closed on never applies). */
export function offersOn(dateKey: string, offers: LiveOffer[] | null = OFFERS): OfferToday[] {
  if (!offers) return [];
  const out: OfferToday[] = [];
  for (const offer of offers) {
    if (standing(offer) || !offerApplies(offer, dateKey)) continue;
    const hours = offerHours(offer, dateKey);
    if (Array.isArray(offer.hours) && offer.hours.length === 7 && !hours) continue;
    out.push({ offer, hours });
  }
  return out;
}

/** The always-on offers with a condition (a benefits card, an age): no day rule. */
export function standingOffers(offers: LiveOffer[] | null = OFFERS): LiveOffer[] {
  return (offers ?? []).filter(standing);
}

/** What a place card or a map badge can show for a place: the offers there today, then its standing offers. */
export function offersForPlace(placeId: string, dateKey: string, offers: LiveOffer[] | null = OFFERS): { today: OfferToday[]; standing: LiveOffer[] } {
  const at = (o: LiveOffer) => o.place?.id === placeId;
  return { today: offersOn(dateKey, offers).filter(t => at(t.offer)), standing: standingOffers(offers).filter(at) };
}

/** The offer's point (null for city-wide offers such as Muni). */
export const offerPoint = (o: LiveOffer): Vec2 | null => (o.place ? { x: o.place.x, z: o.place.z } : null);
