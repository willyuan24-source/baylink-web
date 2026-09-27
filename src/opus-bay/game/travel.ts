import { RUN_SPEED, WALK_SPEED } from '../actors/controller';
import type { Bilingual, PoiDef, Vec2 } from '../core/types';
import { distanceKm } from '../data/catalog';
import { POIS } from '../data/pois';
import { unproject } from '../data/district';
import { unproject as unprojectCity } from '../core/geo';

/**
 * F8 · honest travel times. The little map is compressed, so metres on it mean nothing: show how long the walk
 * takes in the game, and — for real places — how long it is in the real city (lat/lng of the two places).
 */

/** Player walking speed in the game (G1-13: the controller's own constant, not a copy). */
const GAME_WALK = WALK_SPEED;
/** Streets are not straight lines: real walking distance ≈ 1.25 × the crow-flies distance. */
const STREET_FACTOR = 1.25;

/** Seconds as the labels say them: whole seconds up to 20 (at least 2), then to the nearest 5. */
const roundSeconds = (s: number) => (s > 20 ? Math.round(s / 5) * 5 : Math.max(2, Math.round(s)));

/** Seconds of in-game walking for a world distance: "约 8 秒". */
export function gameSeconds(worldDist: number): number {
  return roundSeconds(worldDist / GAME_WALK);
}

/** "约 8 秒" / "约 1 分钟" (zh + en) for a number of seconds in the game. */
export function secondsLabel(seconds: number): Bilingual {
  const s = roundSeconds(seconds);
  if (s < 60) return { zh: `约 ${s} 秒`, en: `~${s}s` };
  const m = Math.round(s / 60);
  return { zh: `约 ${m} 分钟`, en: `~${m} min` };
}

/** "约 8 秒" / "约 1 分钟" (zh + en) of walking a world distance. */
export function gameTimeLabel(worldDist: number): Bilingual {
  return secondsLabel(worldDist / GAME_WALK);
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
  const real = kmLabel(distanceKm(unprojectCity(from), unprojectCity(to)) * STREET_FACTOR);
  return { zh: `游戏里${game.zh} · 现实约 ${real.zh}`, en: `${game.en} in the game · ${real.en} for real` };
}

/** Real metres (zh / en) for a km figure: "850 米" / "1.2 公里". */
function kmLabel(km: number): Bilingual {
  return km < 1
    ? { zh: `${Math.round(km * 100) * 10} 米`, en: `${Math.round(km * 100) * 10} m` }
    : { zh: `${km.toFixed(1)} 公里`, en: `${km.toFixed(1)} km` };
}

// ---------------------------------------------------------------------------
// G1-8 · 带我去 on the city map: the route's own length and the time the auto-walk really takes
// ---------------------------------------------------------------------------

/** The auto-walk (actors/controller A11) runs while more than this is left, and walks the rest. */
export const AUTO_RUN_LEFT = 30;
/** …easing into the run over this long (speed = walk + (run − walk)·k², k 0 → 1). */
const AUTO_RUN_EASE_S = 0.8;

/**
 * Seconds the 带我去 auto-walk takes over a route of `length` u: it eases into a run (RUN_SPEED) while more than 30 u
 * are left, then walks the last 30 u (WALK_SPEED). Corners and the route fetch add a moment; the label rounds anyway.
 */
export function autoWalkSeconds(length: number): number {
  if (!(length > 0)) return 0;
  if (length <= AUTO_RUN_LEFT) return length / WALK_SPEED;
  const run = length - AUTO_RUN_LEFT;
  // the ease-in covers 0.8 s × the mean of walk + (run − walk)·k² (k² averages 1/3)
  const easeD = AUTO_RUN_EASE_S * (WALK_SPEED + (RUN_SPEED - WALK_SPEED) / 3);
  const runS = run <= easeD ? (run / easeD) * AUTO_RUN_EASE_S : AUTO_RUN_EASE_S + (run - easeD) / RUN_SPEED;
  return runS + AUTO_RUN_LEFT / WALK_SPEED;
}

/** Length in world units and real kilometres (each leg through the city frame's inverse projection) of a polyline. */
export function routeMeasure(points: readonly Vec2[]): { length: number; km: number } {
  let length = 0, km = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    length += Math.hypot(b.x - a.x, b.z - a.z);
    km += distanceKm(unprojectCity(a), unprojectCity(b));
  }
  return { length, km };
}

/**
 * The honest label of a walking route on the city map (带我去): the time the auto-walk takes over the route's own
 * length, and the real distance along it — not the crow-flies estimate × 1.25 of cityTravelLabel.
 */
export function routeTravelLabel(points: readonly Vec2[]): Bilingual {
  const { length, km } = routeMeasure(points);
  if (length < 4) return { zh: '就在这', en: 'right here' };
  const time = secondsLabel(autoWalkSeconds(length)), real = kmLabel(km);
  return { zh: `沿路走${time.zh} · 现实约 ${real.zh}`, en: `${time.en} on foot · ${real.en} for real` };
}

/**
 * What is left of a route for someone at `pos`: the polyline from pos's closest point on it (the earliest segment on a
 * tie) to the end, and its length. A route you have walked past shrinks as you go; far off it, it starts where it
 * comes nearest. Pure.
 */
export function routeAhead(points: readonly Vec2[], pos: Vec2): { points: Vec2[]; length: number; off: number } {
  if (points.length < 2) return { points: points.map(p => ({ x: p.x, z: p.z })), length: 0, off: points.length ? Math.hypot(points[0].x - pos.x, points[0].z - pos.z) : 0 };
  let best = 0, bestD = Infinity, bestT = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.min(1, Math.max(0, ((pos.x - a.x) * dx + (pos.z - a.z) * dz) / L2)) : 0;
    const d = Math.hypot(a.x + dx * t - pos.x, a.z + dz * t - pos.z);
    if (d < bestD - 1e-9) { bestD = d; best = i; bestT = t; }
  }
  const a = points[best], b = points[best + 1];
  const out: Vec2[] = [{ x: a.x + (b.x - a.x) * bestT, z: a.z + (b.z - a.z) * bestT }];
  for (let i = best + 1; i < points.length; i++) out.push({ x: points[i].x, z: points[i].z });
  let length = 0;
  for (let i = 1; i < out.length; i++) length += Math.hypot(out[i].x - out[i - 1].x, out[i].z - out[i - 1].z);
  return { points: out, length, off: bestD };
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
