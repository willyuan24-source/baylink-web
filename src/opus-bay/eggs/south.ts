import { runtime } from '../core/runtime';
import { project } from '../core/geo';
import { heightAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { bayNow } from '../game/bayNow';
import type { Shot } from '../game/cinema';
import { bayHm, sunPosition } from '../realsf/sun';
import { type EggHost, beat, fx, glance, hostClock, props, reveal, say, sound } from './hosts';
import { eggById } from './registry';

/**
 * Wave 5 · lane D (W5-D4) · the south and the Bayview: egg 19 (the Ingleside sundial's shadow follows San Francisco's
 * REAL sun: lane R's sunPosition; none at real night, when BAYBAY yawns) and egg 22 (Heron's Head Park from the
 * pelican: a two-second look straight down, the outline lights up, marsh birds call).
 */

// --- the compass of the city frame (core/geo: the map is turned 46°) -----------------------------------------------

const unit = (a: { x: number; z: number }, b: { x: number; z: number }) => { const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz); return { x: dx / l, z: dz / l }; };
const O = project(37.72, -122.47);
/** True north and east as unit vectors of the city frame (east: north turned a right angle, on the side the map puts east). */
export const NORTH = unit(O, project(37.73, -122.47));
export const EAST = (() => {
  const e = unit(O, project(37.72, -122.46));
  const a = { x: NORTH.z, z: -NORTH.x };
  return a.x * e.x + a.z * e.z > 0 ? a : { x: -a.x, z: -a.z };
})();

/** The world direction (unit x, z) of a compass azimuth (degrees clockwise from true north). */
export function azimuthDir(az: number): { x: number; z: number } {
  const a = (az * Math.PI) / 180;
  return { x: Math.sin(a) * EAST.x + Math.cos(a) * NORTH.x, z: Math.sin(a) * EAST.z + Math.cos(a) * NORTH.z };
}
/** The compass azimuth (degrees 0 … 360) of a world direction. */
export function dirAzimuth(d: { x: number; z: number }): number {
  const e = d.x * EAST.x + d.z * EAST.z, n = d.x * NORTH.x + d.z * NORTH.z;
  return ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360;
}
const DIRS_ZH = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
const DIRS_EN = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const compassWord = (az: number): Bilingual => { const i = Math.round((((az % 360) + 360) % 360) / 45) % 8; return { zh: DIRS_ZH[i], en: DIRS_EN[i] }; };

// --- egg 19 · the sundial that tells real time ---------------------------------------------------------------------------

const DIAL_EGG = 'ingleside-sundial-real-time';
/** The dial's centre (world/sf/landmarks/ingleside-terraces-sundial.ts, OSM node 6691138540). */
export const DIAL = { x: 276.27, z: 1443.65 } as const;
/** the dial's face: a point on it clear of the gnomon, to read its height */
const FACE = { x: DIAL.x - EAST.x * 0.8, z: DIAL.z - EAST.z * 0.8 };

/**
 * The gnomon's shadow now: its heading (the prop's local +z) pointing away from the real sun (azimuth + 180°) and its
 * length on the dial (longer when the sun is low; the dial is 1.5 u across), or null when the sun is down.
 */
export function sundialShadow(date: Date = bayNow()): { heading: number; size: number; azimuth: number; sunAz: number } | null {
  const sun = sunPosition(date);
  if (sun.elevation <= 0.5) return null;
  const azimuth = (sun.azimuth + 180) % 360;
  const d = azimuthDir(azimuth);
  const size = Math.max(0.45, Math.min(1.4, 0.9 / Math.tan((sun.elevation * Math.PI) / 180)));
  return { heading: Math.atan2(d.x, d.z), size: +size.toFixed(2), azimuth, sunAz: sun.azimuth };
}

export const NIGHT_LINE: Bilingual = { zh: '天黑了，日晷没有影子……它也睡啦，白天再来吧。', en: 'It’s dark — no shadow on the dial… it’s asleep too. Come back by day.' };
/** "It is 15:04 in San Francisco; the shadow points north-east." */
export function sundialNowLine(date: Date = bayNow()): Bilingual | null {
  const s = sundialShadow(date);
  if (!s) return null;
  const w = compassWord(s.azimuth);
  return { zh: `现在旧金山是 ${bayHm(date)}，影子指向${w.zh}。`, en: `It’s ${bayHm(date)} in San Francisco — the shadow points ${w.en}.` };
}

export function sundialHost(): EggHost {
  const egg = eggById(DIAL_EGG)!;
  let nextShadow = 0;
  const key = `egg:${DIAL_EGG}:shadow`;
  const update = () => {
    const s = sundialShadow();
    props.set(key, s ? { kind: 'shadow', x: DIAL.x, z: DIAL.z, heading: +s.heading.toFixed(3), size: s.size, y: +heightAt(FACE.x, FACE.z).toFixed(3) } : null);
  };
  const look = () => {
    update();
    const now = bayNow();
    const line = sundialNowLine(now);
    if (!line) {
      const g = runtime.guide;
      sound('egg:yawn', { x: g.x, z: g.z }, { near: 5, far: 30 });
      say(NIGHT_LINE);
      return;
    }
    // from just south of the dial, looking down on its face and the shadow
    const y = heightAt(FACE.x, FACE.z);
    const shots: Shot[] = [{ position: [DIAL.x - NORTH.x * 3.2 + EAST.x * 1.2, y + 4.4, DIAL.z - NORTH.z * 3.2 + EAST.z * 1.2], target: [DIAL.x, y, DIAL.z], duration: 1.2, hold: 2 }];
    const after = () => { reveal(DIAL_EGG, { lines: [egg.lines[0], line, egg.lines[1]], repeatLine: true, cardDelay: 2 }); };
    if (!beat(shots, after)) after();
  };
  return {
    id: DIAL_EGG,
    range: 60,
    enter: () => { nextShadow = 0; },
    update: ctx => { if (ctx.t >= nextShadow) { nextShadow = ctx.t + 20; update(); } },
    interactables: () => [{
      id: `egg:${DIAL_EGG}`, source: 'find', action: 'info', verb: { zh: '看看日晷', en: 'Read the sundial' }, name: egg.name,
      x: egg.at.x, z: egg.at.z, radius: 3.2, act: look,
    }],
    dispose: () => props.set(key, null),
    qa: look,
  };
}

// --- egg 22 · Heron's Head from above --------------------------------------------------------------------------------------

const HERONS = 'herons-head-from-above';
/** The park's outline (OSM way 28671926, 20 points along it): the heron's head and its long bill to the north-east. */
export const HERONS_OUTLINE: readonly (readonly [number, number])[] = [
  [909.8, 481.2], [921.3, 471.2], [936.2, 465.9], [952.5, 462.3], [950.4, 454.7], [955.8, 453.3], [967, 448.5], [973.3, 432.6], [981.9, 418.5], [991.1, 404.1],
  [982.2, 411.4], [970.6, 424], [959.7, 437.2], [946.3, 447.9], [930.3, 447.8], [916.4, 448], [899.5, 451.1], [890.9, 459.6], [903.2, 462.3], [915.2, 467.7],
];
export const HERONS_MID = (() => { let x = 0, z = 0; for (const [a, b] of HERONS_OUTLINE) { x += a; z += b; } return { x: x / HERONS_OUTLINE.length, z: z / HERONS_OUTLINE.length }; })();
/** over the park: the glide within this distance (u) of its middle, at least this high above the ground (u) */
export const OVER = { r: 70, height: 10 } as const;
const HERONS_GAP = 40;

export function heronsHost(): EggHost {
  let last = -Infinity;
  const glow = () => {
    for (const [x, z] of HERONS_OUTLINE) fx('rings', x, heightAt(x, z) + 0.4, z, { count: 2, scale: 1.8, color: '#aef0ff' });
    sound('egg:marsh', HERONS_MID, { near: 30, far: 240 });
  };
  const over = (t: number) => {
    last = t;
    // straight down on the park for two seconds, the pelican flying on underneath
    glance({ position: [HERONS_MID.x - NORTH.x * 18, 115, HERONS_MID.z - NORTH.z * 18], target: [HERONS_MID.x, 0, HERONS_MID.z], duration: 0.9 }, 2.4);
    glow();
    setTimeout(glow, 900);
    reveal(HERONS, { repeatLine: true, cardDelay: 2.8 });
  };
  return {
    id: HERONS,
    range: 200,
    update: ctx => {
      const g = runtime.glide;
      if (!g.active || ctx.t - last < HERONS_GAP || ctx.busy) return;
      if (Math.hypot(g.x - HERONS_MID.x, g.z - HERONS_MID.z) > OVER.r || g.height < OVER.height) return;
      over(ctx.t);
    },
    qa: () => { over(hostClock()); },
  };
}
