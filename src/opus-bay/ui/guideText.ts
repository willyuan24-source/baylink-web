import type { Bilingual } from '../core/types';
import { type TripLineInfo, lineDisplayName, tripTimeLabel, zhJoin } from '../game/tripPlan';
import { arrivalToast } from '../game/tripText';
import { TRIP_MODE_NAMES, type TripLeg, type TripLegVia, type TripState } from '../game/tripTypes';

/**
 * Wave 4 · the words of the guidance UI (lane G; plan sf-w4-plan.md §4.2): the trip pill, the trip card rows, the
 * arrival toast and card. Pure (node tests); ui/TripPill.tsx, ui/ArrivalCard.tsx and ui/PanoramaTags.tsx render them.
 */

/** Display width: a CJK character (or full-width form) counts 1, anything else 0.55 (the pill's 13 px font). */
export function textUnits(s: string): number {
  let u = 0;
  for (const ch of s) { const c = ch.codePointAt(0) ?? 0; u += (c >= 0x2e80 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef) ? 1 : 0.55; }
  return u;
}

/** Cut `s` to at most `max` units, ending with "…" when cut. */
export function fitText(s: string, max: number): string {
  if (textUnits(s) <= max) return s;
  let out = '', u = 0;
  for (const ch of s) {
    const w = textUnits(ch);
    if (u + w > max - 1) break;
    out += ch; u += w;
  }
  return `${out.trimEnd()}…`;
}

/** The pill fits 16 CJK on phones (plan §4.2), 24 on desktop. */
export const PILL_UNITS = { phone: 16, desktop: 24 } as const;

/** Which glyph a leg shows (ui/TripPill.tsx maps these to lucide icons). */
export type LegIcon = 'walk' | 'run' | 'bike' | 'car' | 'bus' | 'metro' | 'cable-car' | 'tram' | 'fly';
export function legIcon(leg: Pick<TripLeg, 'via'> & { line?: string }, lines?: ReadonlyMap<string, Pick<TripLineInfo, 'kind'>>): LegIcon {
  if (leg.via !== 'line') return leg.via;
  const kind = leg.line ? lines?.get(leg.line)?.kind : undefined;
  return kind === 'bus' ? 'bus' : kind === 'light-rail' ? 'metro' : kind === 'cable-car' ? 'cable-car' : kind === 'streetcar' ? 'tram' : 'bus';
}

const nameOf = (p: { name?: Bilingual; station?: string; place?: string }): Bilingual | null => p.name ?? null;

/** One leg in words: "步行到艺术宫" / "坐 N 线到 9th & Irving" / "飞到双峰" (the planner's label, else built here). */
export function legLabel(leg: TripLeg, lines?: ReadonlyMap<string, TripLineInfo>): Bilingual {
  if (leg.label) return leg.label;
  const to = nameOf(leg.to);
  const verb: Record<TripLegVia, Bilingual> = {
    walk: { zh: '步行', en: 'Walk' }, run: { zh: '跑', en: 'Run' }, bike: { zh: '骑车', en: 'Bike' }, car: { zh: '开车', en: 'Drive' },
    line: leg.via === 'line' ? (() => { const l = lines?.get(leg.line); const n = l ? lineDisplayName(l) : TRIP_MODE_NAMES.line; return { zh: `坐${zhJoin(n.zh)}`, en: n.en }; })() : TRIP_MODE_NAMES.line,
    fly: { zh: '飞', en: 'Fly' },
  };
  const v = verb[leg.via];
  return to ? { zh: `${v.zh}到${to.zh}`, en: `${v.en} to ${to.en}` } : v;
}

export interface PillText {
  icon: LegIcon;
  /** "下一站 艺术宫" (zh fitted to the pill with the time) */
  title: Bilingual;
  time: Bilingual;
  /** "2/3" when the trip has several legs */
  step: string | null;
}

/**
 * A name for the pill: without a trailing gloss in brackets ("彩绘女士（明信片排屋）" → "彩绘女士", "九曲花街（伦巴底街）" →
 * "九曲花街"), which would otherwise be cut mid-bracket on a phone ("彩绘女士（…").
 */
export function pillName(name: Bilingual): Bilingual {
  const strip = (s: string) => { const t = s.replace(/\s*[（(][^（）()]*[）)]\s*$/u, '').trim(); return t || s; };
  return { zh: strip(name.zh), en: strip(name.en) };
}

/** The ride stage (game/flowStore RideStage): waiting at the stop, or on board ('riding' / 'braking' / 'turning'). */
export type PillPhase = 'waiting' | 'riding' | 'braking' | 'turning';

/**
 * The trip pill (plan §4.2): "[icon] 下一站 名称 · 约 N 分钟". `secondsLeft` = tripRemainingSeconds (the live one);
 * `phase` of a line leg (flow.ride.stage as it is: 'waiting' at the stop, else on board); `compact` = phones (≤ 16 CJK
 * in all); `short` = the destination's short name (Attraction.short), used when the current leg ends there.
 * On board a line the pill says "坐到 名称" (the stop to get off at), not "下一站": the RideBanner right under it already
 * says "下一站 …" for the vehicle's next stop, and two different 下一站 on one screen read as a contradiction (review).
 */
export function tripPillText(trip: Pick<TripState, 'legs' | 'leg'> & { option?: { legs: TripLeg[] } }, secondsLeft: number, o: { lines?: ReadonlyMap<string, TripLineInfo>; phase?: PillPhase | null; compact?: boolean; destination?: Bilingual; short?: Bilingual | null } = {}): PillText {
  const legs = trip.legs;
  const cur = legs[Math.min(trip.leg, legs.length - 1)];
  const time = tripTimeLabel(secondsLeft);
  const max = o.compact ? PILL_UNITS.phone : PILL_UNITS.desktop;
  if (!cur) return { icon: 'walk', title: { zh: '到了', en: 'Arrived' }, time, step: null };
  const icon = legIcon(cur as TripLeg & { line?: string }, o.lines);
  const to = pillName((cur.to.place && o.short) || (nameOf(cur.to) ?? o.destination ?? { zh: '目的地', en: 'destination' }));
  let zh: string, en: string;
  if (cur.via === 'line' && o.phase === 'waiting') {
    const l = o.lines?.get(cur.line);
    const n = l ? lineDisplayName(l) : TRIP_MODE_NAMES.line;
    const board = nameOf(cur.from);
    zh = `等${zhJoin(n.zh)}${board ? ` · ${pillName(board).zh}` : ''}`;
    en = `Wait for the ${n.en}${board ? ` · ${pillName(board).en}` : ''}`;
  } else if (cur.via === 'line') {
    zh = `坐到 ${to.zh}`;
    en = `Ride to ${to.en}`;
  } else {
    zh = `下一站 ${to.zh}`;
    en = `Next: ${to.en}`;
  }
  // the time takes its own units + the " · " separator
  const room = Math.max(4, max - textUnits(time.zh) - 1.5);
  return { icon, title: { zh: fitText(zh, room), en }, time, step: legs.length > 1 ? `${Math.min(trip.leg + 1, legs.length)}/${legs.length}` : null };
}

export interface LegRow { icon: LegIcon; label: Bilingual; time: Bilingual; state: 'done' | 'now' | 'next'; wait?: Bilingual }

/** The trip card's rows: every leg with its icon, words, time and state (done / now / next). */
export function tripLegRows(trip: Pick<TripState, 'legs' | 'leg'>, lines?: ReadonlyMap<string, TripLineInfo>): LegRow[] {
  return trip.legs.map((leg, i) => ({
    icon: legIcon(leg as TripLeg & { line?: string }, lines),
    label: legLabel(leg, lines),
    time: tripTimeLabel(leg.seconds),
    state: i < trip.leg ? 'done' : i === trip.leg ? 'now' : 'next',
    ...(leg.via === 'line' && leg.wait > 0 ? { wait: { zh: `含等车${tripTimeLabel(leg.wait).zh}`, en: `incl. a ${tripTimeLabel(leg.wait).en} wait` } } : {}),
  }));
}

/**
 * The gold arrival toast: "抵达 · 艺术宫" with the English name under it in the Chinese locales (plan §4.2 "抵达 · 艺术宫
 * Palace of Fine Arts"; a long English name wraps on its own smaller line instead of doubling the toast); quiet
 * places (memorials, churches): "到了 · …", no gold.
 */
export function arrivalToastText(name: Bilingual, quiet = false): Bilingual {
  // one wording with lane C's arrivalBeats().toast (game/tripText.ts, lane C part 2 integration step 1)
  return arrivalToast(name, quiet);
}

/** How long the arrival peek card stays (ms, plan §4.2) and the toast. */
export const ARRIVAL_CARD_MS = 6000;
export const ARRIVAL_TOAST_MS = 3200;
