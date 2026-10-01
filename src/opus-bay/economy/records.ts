import type { Bilingual } from '../core/types';
import type { PlaySaveV1 } from '../data/playSave';

/**
 * Wave 5 · lane E · W5-E9: 我的记录 on the 手帐's 足迹 page (lane A's request) — the stair steps lane A counts
 * (`play.b.steps`, `steps-today` with its Bay day `steps-day` = days since 1970 of the Bay date) and the activity bests
 * lane A keeps through lane E's `recordBest` (`slides` and `stairs-<course>`: seconds, lower is better; `bell`: points).
 * Pure: the notebook passes the play save and today's Bay date. Nothing is compared with anyone else, and nothing is
 * a streak: yesterday's count simply is not shown.
 */

export interface RecordRow { key: string; name: Bilingual; value: Bilingual }
export interface Records { stepsToday: number; stepsTotal: number; bests: RecordRow[] }

/** The activities lane A saves a best for, in the order they are shown (names as lane A's cards say them). */
export const BEST_ROWS: readonly { key: string; name: Bilingual; unit: 'seconds' | 'points' }[] = [
  { key: 'slides', name: { zh: '纸板滑梯', en: 'Cardboard slides' }, unit: 'seconds' },
  { key: 'stairs-filbert', name: { zh: '台阶赛跑 · 菲尔伯特台阶', en: 'Stair race · Filbert Steps' }, unit: 'seconds' },
  { key: 'stairs-tiled', name: { zh: '台阶赛跑 · 马赛克阶梯', en: 'Stair race · Tiled Steps' }, unit: 'seconds' },
  // W6-W3 / W6-W4 (lane W): the Lyon Street Steps race and hide & seek (the kit keeps their bests under the activity id)
  { key: 'stairs-lyon', name: { zh: '台阶赛跑 · 里昂街台阶', en: 'Stair race · Lyon Street Steps' }, unit: 'seconds' },
  { key: 'hide-seek', name: { zh: '捉迷藏 · 找到 BAYBAY', en: 'Hide & seek · found BAYBAY' }, unit: 'seconds' },
  { key: 'bell', name: { zh: '缆车摇铃', en: 'Cable-car bell' }, unit: 'points' },
  // W7-W2 (lane W2): 放风筝 (points: a point a second aloft, ten more for the top of the line)
  { key: 'kite', name: { zh: '放风筝', en: 'Kite flying' }, unit: 'points' },
  // W7-W2: 那是什么？ the skyline quiz (points: landmarks named of three)
  { key: 'skyline', name: { zh: '那是什么？认地标', en: 'What’s that? Landmarks named' }, unit: 'points' },
  // W7-M (lane M): the San Francisco mini-games (the kit keeps their bests under the activity id: the claw's souvenirs
  // in one go, the crabbing's and the sourdough's points)
  { key: 'claw', name: { zh: '机械博物馆抓娃娃', en: 'Musée claw machine' }, unit: 'points' },
  { key: 'crab', name: { zh: '7 号码头捞螃蟹', en: 'Crabbing off Pier 7' }, unit: 'points' },
  { key: 'sourdough', name: { zh: '捏酸面包', en: 'Shaping sourdough' }, unit: 'points' },
  // W8-M (lane M): the second set (the kit keeps their bests under the activity id: points of 100)
  { key: 'grip', name: { zh: '叮当车拉闸', en: 'Cable-car grip' }, unit: 'points' },
];

/** Days since 1970 of a Bay date (lane A's `steps-day`). */
export const bayDayNumber = (dateKey: string): number => Math.round(Date.parse(`${dateKey}T00:00:00Z`) / 86400000);

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export function records(p: Readonly<PlaySaveV1>, dateKey: string): Records {
  const b = p.b ?? {};
  const total = Math.max(0, Math.floor(num(b.steps) ?? 0));
  const today = num(b['steps-day']) === bayDayNumber(dateKey) ? Math.max(0, Math.floor(num(b['steps-today']) ?? 0)) : 0;
  const bests: RecordRow[] = [];
  for (const r of BEST_ROWS) {
    const v = num(b[r.key]);
    if (v === undefined || v <= 0) continue;
    const s = r.unit === 'seconds' ? v.toFixed(1) : String(Math.round(v));
    bests.push({ key: r.key, name: r.name, value: r.unit === 'seconds' ? { zh: `最快 ${s} 秒`, en: `best ${s} s` } : { zh: `最高 ${s} 分`, en: `best ${s}` } });
  }
  return { stepsToday: today, stepsTotal: Math.max(total, today), bests };
}
