import { unprojectCity } from '../core/geo';

/** Wave 5 · lane E · W5-E6: the 寻宝罗盘 badge's maths (economy/CompassBadge.tsx): the arrow's angle and the real distance. */

/** The arrow's screen angle (radians clockwise from up) for a target at bearing `b` seen by a camera at yaw `yaw`. */
export function screenAngle(px: number, pz: number, tx: number, tz: number, yaw: number): number {
  const b = Math.atan2(tx - px, tz - pz);
  // the follow camera sits at player + (sin yaw, cos yaw) · d looking back at the player: forward is yaw + π
  return Math.PI + yaw - b;
}

/**
 * `a` moved by whole turns to be the nearest to `prev` (W5-E-review: the badge's CSS transition turned the arrow the
 * long way round, a full spin, each time the target crossed behind you and atan2 jumped by 2π).
 */
export const nearestTurn = (prev: number, a: number): number => prev + Math.atan2(Math.sin(a - prev), Math.cos(a - prev));

const R = 6371000, RAD = Math.PI / 180;
/** Metres between two city points (their real latitude / longitude). */
export function realMetres(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const p = unprojectCity(a), q = unprojectCity(b);
  const dLat = (q.lat - p.lat) * RAD, dLng = (q.lng - p.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * RAD) * Math.cos(q.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 80 米 · 350 米 · 1.2 公里 (≤ 6 characters). */
export function distanceText(m: number, zh: boolean): string {
  if (!Number.isFinite(m)) return '';
  if (m < 1000) { const r = Math.max(10, Math.round(m / 10) * 10); return zh ? `${r}米` : `${r}m`; }
  const km = Math.round(m / 100) / 10;
  return zh ? `${km}公里` : `${km}km`;
}
