import type { Bilingual } from '../core/types';
import type { TimeOfDay } from '../core/store';
import { bayNow, bayParts } from '../game/bayNow';
import { SF_SUN, realSunBand, solarAt, sunDay, type SunDay } from '../game/qa';

/**
 * Wave 5 · lane R (W5-R1) · San Francisco's real sun, for every lane (plan §4.3 hook `sunBandAt`).
 *
 *   sunBandAt(date)     the time-of-day band the real sun gives `date` (what city mode's sky shows under Settings › 自动)
 *   sunTimes(date)      the Bay day of `date`: civil dawn, sunrise, the afternoon 6° mark, sunset, civil dusk (Dates)
 *   sunPosition(date)   elevation and azimuth (degrees; azimuth clockwise from true north) — D's sundial, V's light
 *   bayHm(date)         'HH:mm' on the Bay clock
 *   sunsetLine(date)    BAYBAY's once-a-day line: 今天旧金山日落 18:57，找个坡坐下来看吧。
 *
 * The maths lives in game/qa.ts (the main graph needs it for store.timeOfDay); this module is the lanes' door to it.
 * Source and check: NOAA's solar calculator equations, compared with the US Naval Observatory on 2026-09-28 (within 1 min).
 */

export type { SunDay };

const RAD = Math.PI / 180;

/** The real-sun band of an instant (default: now on the Bay clock). */
export function sunBandAt(date: Date = bayNow()): TimeOfDay {
  return realSunBand(date);
}

export interface SunTimes { dateKey: string; dawn: Date; sunrise: Date; golden: Date; sunset: Date; dusk: Date }

/** The sun of the Bay day `date` falls on. */
export function sunTimes(date: Date = bayNow()): SunTimes {
  const s = sunDay(bayParts(date).dateKey);
  return { dateKey: s.dateKey, dawn: new Date(s.dawn), sunrise: new Date(s.sunrise), golden: new Date(s.golden), sunset: new Date(s.sunset), dusk: new Date(s.dusk) };
}

/** The sun's elevation (degrees above the horizon, no refraction) and azimuth (degrees clockwise from true north). */
export function sunPosition(date: Date = bayNow(), at: { lat: number; lng: number } = SF_SUN): { elevation: number; azimuth: number } {
  const ms = date.getTime();
  const { decl, eqt } = solarAt(ms);
  const d = new Date(ms);
  const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  const tst = (((utcMin + eqt + 4 * at.lng) % 1440) + 1440) % 1440;
  const ha = (tst / 4 - 180) * RAD;
  const lat = at.lat * RAD;
  const cosZ = Math.min(1, Math.max(-1, Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha)));
  const zen = Math.acos(cosZ);
  const elevation = 90 - zen / RAD;
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) / RAD + 180;
  return { elevation, azimuth: ((az % 360) + 360) % 360 };
}

const pad = (n: number) => String(n).padStart(2, '0');
/** 'HH:mm' on the Bay clock. */
export function bayHm(date: Date): string {
  const p = bayParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** BAYBAY's sunset line for the Bay day of `date` (≤ 45 zh characters). */
export function sunsetLine(date: Date = bayNow()): Bilingual {
  const t = bayHm(sunTimes(date).sunset);
  return { zh: `今天旧金山日落 ${t}，找个坡坐下来看吧。`, en: `Sunset in San Francisco today is at ${t} — find a hill and sit for it.` };
}
