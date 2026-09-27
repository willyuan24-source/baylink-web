import type { Bilingual } from '../core/types';
import { TRIP_MODE_NAMES, TRIP_MODES, type TripLeg, type TripLineLeg, type TripOption } from '../game/tripTypes';
import { LINE_STYLES, type LineGlyph } from './mapLines';

/**
 * Wave 4 · the words of a trip option row (lane P, W4-P11; plan sf-w4-plan.md §4.2 "Trip planner", "带我去 → 跟 BAYBAY
 * 去"). Pure, so the rows read the same in TripOptions, the trip card (lane G) and tests:
 *   🚶 步行 · 约 4 分钟 · 🚲 骑车 约 2 分钟 · 🚌 观光巴士 2 站 约 3 分钟 · 🐦 飞过去 约 6 秒
 * Every time shown is real play time (the planner's honest seconds).
 */

/** "约 6 秒" / "约 40 秒" / "约 4 分钟" / "约 1 小时 5 分" (rounded: 5 s steps from 20 s, whole minutes from 90 s). */
export function tripSecondsLabel(sec: number): Bilingual {
  const s = Math.max(1, Math.round(sec));
  if (s < 20) return { zh: `约 ${s} 秒`, en: `~${s} s` };
  if (s < 90) { const r = Math.round(s / 5) * 5; return r < 60 ? { zh: `约 ${r} 秒`, en: `~${r} s` } : { zh: `约 1 分钟`, en: '~1 min' }; }
  const m = Math.round(s / 60);
  if (m < 60) return { zh: `约 ${m} 分钟`, en: `~${m} min` };
  return { zh: `约 ${Math.floor(m / 60)} 小时 ${m % 60} 分`, en: `~${Math.floor(m / 60)} h ${m % 60} min` };
}

const firstLine = (o: TripOption): TripLineLeg | undefined => o.legs.find((l): l is TripLineLeg => l.via === 'line');

/** The row's title: the mode name, or for a line option what you ride and how many stops ("观光巴士 2 站"). */
export function optionTitle(o: TripOption): Bilingual {
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
      if (l.via === 'line' && l.wait > 0) parts.push({ zh: `等 ${tripSecondsLabel(l.wait).zh.replace('约 ', '')}`, en: `wait ${tripSecondsLabel(l.wait).en.replace('~', '')}` });
      const sec = l.via === 'line' ? Math.max(1, l.seconds - l.wait) : l.seconds;
      const w = legWord(l), tl = tripSecondsLabel(sec);
      parts.push({ zh: `${w.zh} ${tl.zh.replace('约 ', '')}`, en: `${w.en} ${tl.en.replace('~', '')}` });
    }
  }
  if (est) parts.push({ zh: '计算中…', en: 'working it out…' });
  if (!parts.length) return null;
  return { zh: parts.map(p => p.zh).join(' · '), en: parts.map(p => p.en).join(' · ') };
}

/** Rows in display order: recommended first, then by seconds, then the TRIP_MODES tie-break; at most `max`. */
export function orderOptions(options: readonly TripOption[], max = 4): TripOption[] {
  return [...options].sort((a, b) => Number(!!b.recommended) - Number(!!a.recommended) || a.seconds - b.seconds || TRIP_MODES.indexOf(a.mode) - TRIP_MODES.indexOf(b.mode)).slice(0, max);
}

/** A screen-reader line for a row ("观光巴士 2 站，约 3 分钟，推荐"). */
export function optionAria(o: TripOption): Bilingual {
  const title = optionTitle(o), time = tripSecondsLabel(o.seconds);
  return { zh: `${title.zh}，${time.zh}${o.recommended ? '，推荐' : ''}`, en: `${title.en}, ${time.en}${o.recommended ? ', recommended' : ''}` };
}
