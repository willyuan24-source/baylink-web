import type { Bilingual, PoiDef, Vec2 } from '../core/types';
import { distanceKm } from '../data/catalog';
import { POIS } from '../data/pois';
import { unproject } from '../data/district';
import { unproject as unprojectCity } from '../core/geo';

/**
 * F8 · honest travel times. The little map is compressed, so metres on it mean nothing: show how long the walk
 * takes in the game, and — for real places — how long it is in the real city (lat/lng of the two places).
 */

/** Player walking speed in the game (actors/controller.ts WALK_SPEED). */
const GAME_WALK = 4.2;
/** Streets are not straight lines: real walking distance ≈ 1.25 × the crow-flies distance. */
const STREET_FACTOR = 1.25;

/** Seconds of in-game walking for a world distance: "约 8 秒". */
export function gameSeconds(worldDist: number): number {
  const s = worldDist / GAME_WALK;
  return s > 20 ? Math.round(s / 5) * 5 : Math.max(2, Math.round(s));
}

/** "约 8 秒" / "约 1 分钟" (zh + en). */
export function gameTimeLabel(worldDist: number): Bilingual {
  const s = gameSeconds(worldDist);
  if (s < 60) return { zh: `约 ${s} 秒`, en: `~${s}s` };
  const m = Math.round(s / 60);
  return { zh: `约 ${m} 分钟`, en: `~${m} min` };
}

/** The real place nearest to a point in the world (for "real walking from here"). */
export function nearestRealPoi(p: Vec2): PoiDef | undefined {
  let best: PoiDef | undefined, bestD = Infinity;
  for (const poi of POIS) {
    if (!poi.realInfo) continue;
    const d = Math.hypot(poi.position.x - p.x, poi.position.z - p.z);
    if (d < bestD) { bestD = d; best = poi; }
  }
  return best;
}

/** Real walking distance / time between two real places, or null when either has no coordinates. */
export function realWalk(from: PoiDef | undefined, to: PoiDef | undefined): { km: number; minutes: number } | null {
  if (!from?.realInfo || !to?.realInfo) return null;
  const km = distanceKm(from.realInfo, to.realInfo) * STREET_FACTOR;
  return { km, minutes: Math.max(1, Math.round((km * 1000) / 80)) };
}

/** "游戏里约 1 分钟 · 现实步行约 30 分钟 / 2.5 公里" — the real part only for real places. */
export function travelLabel(from: Vec2, to: PoiDef): Bilingual {
  const game = gameTimeLabel(Math.hypot(to.position.x - from.x, to.position.z - from.z));
  // where you are, in the real city (the district's inverse projection; waterfront spots are approximate)
  const here = unproject(from);
  const real = to.realInfo ? (() => { const km = distanceKm(here, to.realInfo!) * STREET_FACTOR; return { km, minutes: Math.max(1, Math.round((km * 1000) / 80)) }; })() : null;
  if (Math.hypot(to.position.x - from.x, to.position.z - from.z) < 4) return { zh: '就在这', en: 'right here' };
  if (!real || real.km < 0.05) return { zh: `游戏里${game.zh}`, en: `${game.en} in the game` };
  const km = real.km < 1 ? `${Math.round(real.km * 1000 / 10) * 10} 米` : `${real.km.toFixed(1)} 公里`;
  const kmEn = real.km < 1 ? `${Math.round(real.km * 1000 / 10) * 10} m` : `${real.km.toFixed(1)} km`;
  return {
    zh: `游戏里${game.zh} · 现实步行约 ${real.minutes} 分钟 / ${km}`,
    en: `${game.en} in the game · ~${real.minutes} min / ${kmEn} on foot for real`,
  };
}

// ---------------------------------------------------------------------------
// City places (lane G1, G1-6 / G1-7): the map's 飞过去 / 带我去 / 开车去
// ---------------------------------------------------------------------------

/** How far the player may be from a rideable for 骑车去 / 开车去 (plan §6.7). */
export const RIDEABLE_R = 60;

/** "游戏里约 1 分钟 · 现实约 2.5 公里" for a city place (the city frame's own inverse projection). */
export function cityTravelLabel(from: Vec2, to: Vec2): Bilingual {
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  if (d < 4) return { zh: '就在这', en: 'right here' };
  const game = gameTimeLabel(d);
  const km = distanceKm(unprojectCity(from), unprojectCity(to)) * STREET_FACTOR;
  const kmZh = km < 1 ? `${Math.round(km * 100) * 10} 米` : `${km.toFixed(1)} 公里`;
  const kmEn = km < 1 ? `${Math.round(km * 100) * 10} m` : `${km.toFixed(1)} km`;
  return { zh: `游戏里${game.zh} · 现实约 ${kmZh}`, en: `${game.en} in the game · ${kmEn} for real` };
}

/** The nearest bike / toy car within RIDEABLE_R of p (its interactable), or null. */
export function rideableNear(p: Vec2, list: readonly { id: string; source: string; x: number; z: number }[]): { id: string; x: number; z: number } | null {
  let best: { id: string; x: number; z: number } | null = null, bestD = RIDEABLE_R;
  for (const it of list) {
    if (it.source !== 'vehicle') continue;
    const d = Math.hypot(it.x - p.x, it.z - p.z);
    if (d <= bestD) { bestD = d; best = it; }
  }
  return best;
}
