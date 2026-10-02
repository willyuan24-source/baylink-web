import type { Bilingual } from '../core/types';
import { timeLabel } from '../game/tripText';
import { TRIP_MODE_NAMES, TRIP_MODES, type TripLeg, type TripLineLeg, type TripOption } from '../game/tripTypes';
import { SCENIC_NAME, isScenicOption } from '../game/scenicTrip';
import { LINE_STYLES, type LineGlyph } from './mapLines';

/**
 * Wave 4 · the words of a trip option row (lane P, W4-P11; plan sf-w4-plan.md §4.2 "Trip planner", "带我去 → 跟 BAYBAY
 * 去"). Pure, so the rows read the same in TripOptions, the trip card (lane G) and tests:
 *   🚶 步行 · 约 4 分钟 · 🚲 骑车 约 2 分钟 · 🚌 观光巴士 2 站 约 3 分钟 · 🐦 飞过去 约 6 秒
 * Every time shown is real play time (the planner's honest seconds).
 */

/**
 * "约 6 秒" / "约 40 秒" / "约 4 分钟" / "约 1 小时 5 分钟": the game's ONE time rule (lane C's game/tripText.ts
 * `timeLabel`, lane G's review O4: pill, card, map and ETA chip say the same words).
 */
export function tripSecondsLabel(sec: number): Bilingual {
  return timeLabel(sec);
}

const firstLine = (o: TripOption): TripLineLeg | undefined => o.legs.find((l): l is TripLineLeg => l.via === 'line');

/** The row's title: the mode name, or for a line option what you ride and how many stops ("观光巴士 2 站"). */
export function optionTitle(o: TripOption): Bilingual {
  // W5-N9: the scenic flight has its own name (看风景飞过去)
  if (isScenicOption(o)) return SCENIC_NAME;
  const ride = firstLine(o);
  if (o.mode !== 'line' || !ride) return TRIP_MODE_NAMES[o.mode];
  const st = LINE_STYLES[ride.line];
  const name = st?.ride ?? { zh: ride.line, en: ride.line };
  const rides = o.legs.filter(l => l.via === 'line').length;
  const more = rides > 1 ? { zh: ' + 换乘', en: ' + change' } : { zh: '', en: '' };
  return { zh: `${name.zh} ${ride.stops} 站${more.zh}`, en: `${name.en} · ${ride.stops} stop${ride.stops === 1 ? '' : 's'}${more.en}` };
}

/** The glyph of the row: the first line leg's vehicle for line options (bus / Metro / cable car / streetcar). */
export function optionLineGlyph(o: TripOption): LineGlyph | null {
  const ride = firstLine(o);
  return o.mode === 'line' && ride ? LINE_STYLES[ride.line]?.glyph ?? 'Bus' : null;
}

const legWord = (l: TripLeg): Bilingual => {
  switch (l.via) {
    case 'walk': return { zh: '步行', en: 'walk' };
    case 'run': return { zh: '跑', en: 'run' };
    case 'bike': return { zh: '骑车', en: 'ride' };
    case 'car': return { zh: '开车', en: 'drive' };
    case 'fly': return { zh: '飞', en: 'fly' };
    case 'line': return { zh: '坐车', en: 'ride' };
  }
};

/**
 * The second line of a row: the option's note if any ("不算登顶 / 骑行成就"), else the legs for multi-leg options
 * ("步行 1 分钟 · 等 15 秒 · 坐车 2 分钟 · 步行 40 秒"), "计算中…" while any leg is still an estimate. null = none.
 */
export function optionDetail(o: TripOption): Bilingual | null {
  const est = o.legs.some(l => l.estimate);
  const parts: Bilingual[] = [];
  if (o.note) parts.push(o.note);
  else if (o.legs.length > 1 || o.mode === 'line') {
    for (const l of o.legs) {
      if (l.via === 'line' && l.wait > 0) { const wl = timeLabel(l.wait, 'bare'); parts.push({ zh: `等 ${wl.zh}`, en: `wait ${wl.en}` }); }
      const sec = l.via === 'line' ? Math.max(1, l.seconds - l.wait) : l.seconds;
      const w = legWord(l), tl = timeLabel(sec, 'bare');
      parts.push({ zh: `${w.zh} ${tl.zh}`, en: `${w.en} ${tl.en}` });
    }
  }
  if (est) parts.push({ zh: '计算中…', en: 'working it out…' });
  if (!parts.length) return null;
  return { zh: parts.map(p => p.zh).join(' · '), en: parts.map(p => p.en).join(' · ') };
}

/**
 * Rows in display order: recommended first, then by seconds, then the TRIP_MODES tie-break; at most `max`. W5-N9: the
 * scenic flight is not counted and stands right after the fast 飞过去 (without that row shown, not at all).
 */
export function orderOptions(options: readonly TripOption[], max = 4): TripOption[] {
  const scenic = options.find(isScenicOption);
  const rows = options.filter(o => o !== scenic)
    .sort((a, b) => Number(!!b.recommended) - Number(!!a.recommended) || a.seconds - b.seconds || TRIP_MODES.indexOf(a.mode) - TRIP_MODES.indexOf(b.mode)).slice(0, max);
  const i = scenic ? rows.findIndex(o => o.mode === 'fly') : -1;
  return i >= 0 && scenic ? [...rows.slice(0, i + 1), scenic, ...rows.slice(i + 1)] : rows;
}

/** A row's React key: the mode and its legs (W5-N9: the scenic flight apart from the fast one). */
export const optionKey = (o: TripOption): string => `${o.mode}${isScenicOption(o) ? '-scenic' : ''}:${o.legs.map(l => (l.via === 'line' ? l.line : l.via)).join('+')}`;

/**
 * (W5-N review) The way a row stands for, for its pressed state: the mode, and the scenic flight apart from the fast
 * 飞过去 (with the mode alone both fly rows showed pressed in 换个方式 while either flew: part c's known gap).
 */
export type TripWay = TripOption['mode'] | 'fly-scenic';
export const optionWay = (o: Pick<TripOption, 'mode' | 'legs'>): TripWay => (isScenicOption(o) ? 'fly-scenic' : o.mode);

/**
 * W5-N3 · the big go button's words (plan MF4 "🐦 飞过去 · 8 秒 / 🚶 BAYBAY 带路 · 3 分钟 / 🚲 骑车 · 2 分钟"): what
 * happens when you tap it and how long it takes — on foot BAYBAY leads (auto-travel carries you), a line option names
 * its ride. One tap starts moving (game/tripRun: auto-travel).
 */
export function goButtonLabel(o: TripOption): Bilingual {
  // (W9-N5, review R§6 界面: the map's "~1 min" read like a teleport and was ≈ 85 s on foot) a walk says it walks, with
  // BAYBAY, in seconds up to two minutes
  if (o.mode === 'walk' || o.mode === 'run') { const time = walkGoTime(o.seconds); return { zh: `和 BAYBAY 走 · ${time.zh}`, en: `Walk with BAYBAY · ${time.en}` }; }
  const what = optionTitle(o), time = tripSecondsLabel(o.seconds);
  return { zh: `${what.zh} · ${time.zh}`, en: `${what.en} · ${time.en}` };
}

/** A walk's time on the go button: 5-second steps up to two minutes ("约 85 秒" / "~85s"), then the one time rule. */
export function walkGoTime(sec: number): Bilingual {
  if (!Number.isFinite(sec) || sec < 60 || sec >= 120) return tripSecondsLabel(sec);
  const n = Math.round(sec / 5) * 5;
  return n >= 120 ? tripSecondsLabel(sec) : { zh: `约 ${n} 秒`, en: `~${n}s` };
}

/** A screen-reader line for a row ("观光巴士 2 站，约 3 分钟，推荐"). */
export function optionAria(o: TripOption): Bilingual {
  const title = optionTitle(o), time = tripSecondsLabel(o.seconds);
  return { zh: `${title.zh}，${time.zh}${o.recommended ? '，推荐' : ''}`, en: `${title.en}, ${time.en}${o.recommended ? ', recommended' : ''}` };
}
