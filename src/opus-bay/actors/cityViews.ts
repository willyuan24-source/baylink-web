import { SF_LANDMARK_INFO } from '../data/sf/landmarks';
import { GGB } from '../world/sf/landmarks/golden-gate-bridge';
import { oceanBeachFireRings } from '../world/sf/landmarks/ocean-beach-fire-rings';
import { sfLandmarkAnchor } from '../world/sf/landmarks/context';
import { landmarkToWorld, sfLandmark } from '../world/sf/landmarks/index';
import type { HeroPoint, ZoneView } from './camera';
import { registerDeck, type Deck } from './deckSteer';
import { registerNoVault } from './feet';
import { PLAYER_HEIGHT } from './dims';

/**
 * City-mode camera data (lane E2, wave 3, E2-6), loaded with a dynamic import by actors/camera.ts only in city mode:
 * the landmark library stays out of GameRoot's main graph (P7).
 *
 * - `cityHeroPoints()`: what the follow camera never looks at the player through, beyond the district's three — the
 *   Golden Gate Bridge's two towers and Sutro Tower (Salesforce comes from DISTRICT, camera.ts adds it).
 * - `cityZoneViews(ground)`: one preferred view per landmark at its arrival spot (the spot `?at=lm-…`, fast travel and
 *   带我去 end on), built from D2's photo pose (data/sf/landmarks `photo`): the camera stands behind the player on the
 *   line to the photo target, low (the photo's elevation) and a little farther back and looking up for a tall subject,
 *   so City Hall's dome, the Palace rotunda or the Lombard hairpins are in frame when you arrive (CS-10).
 * - wave 5 (W5-F6): the Golden Gate Bridge's deck (`ggbDeck`) for the feet and the follow camera (actors/deckSteer),
 *   registered when this module loads (city mode only), so the landmark library stays out of the main graph.
 */

/** zone radius (u) around a landmark's arrival spot (the district zones use 10; a city arrival area is larger) */
export const CITY_ZONE_R = 12;

export function cityHeroPoints(): HeroPoint[] {
  const out: HeroPoint[] = [];
  const ggb = sfLandmark('golden-gate-bridge');
  if (ggb) for (const x of [-GGB.TOWER, GGB.TOWER]) { const p = landmarkToWorld(ggb, { x, z: 0 }); out.push({ id: `ggb-tower-${x < 0 ? 's' : 'n'}`, x: p.x, z: p.z, r: 5 }); }
  const sutro = sfLandmark('sutro-tower');
  if (sutro) out.push({ id: 'sutro-tower', x: sutro.x, z: sutro.z, r: 7 });
  return out;
}

/**
 * W5-F6: the walk between the Golden Gate Bridge's railings — the deck from its south end on the Presidio bluff to its
 * north end, the rails' inner faces 2.62 u off the axis (the landmark's railings stand at ±2.65, 0.16 thick; the road
 * and sidewalks reach ±2.65). On it the camera may look through the two towers' portals.
 */
export const GGB_DECK_HALF = 2.62;
export function ggbDeck(): Deck | null {
  const l = sfLandmark('golden-gate-bridge');
  if (!l) return null;
  const a = landmarkToWorld(l, { x: GGB.END_S, z: 0 }), b = landmarkToWorld(l, { x: GGB.END_N, z: 0 });
  return {
    id: 'golden-gate-bridge', x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), length: Math.hypot(b.x - a.x, b.z - a.z),
    half: GGB_DECK_HALF, y: GGB.DECK, relax: ['ggb-tower-s', 'ggb-tower-n'],
  };
}
registerDeck('golden-gate-bridge', ggbDeck());
// W5-F5 (plan D22, the wildlife and safety tone): nobody hops over the Ocean Beach fire rings — they burn in season
{
  const ex = oceanBeachFireRings.exclude;
  if (ex && 'poly' in ex) registerNoVault('ocean-beach-fire-rings', [ex.poly]);
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** the follow camera's focus above the ground (camera.ts FOCUS_Y) and its vertical field of view on a desktop (deg) */
const FOCUS = 0.77 * PLAYER_HEIGHT;
const FOV = 42;

/**
 * The zone's pitch / distance / look-up for a subject whose photo target is `rise` u above the player's ground and `d`
 * u beyond them (its top `top` u up, or NaN), as the follow rig would place the camera (camera.ts: target = focus +
 * 0.13·dist + lookUp, camera `dist` back at `pitch`) on a desktop lens (the tightest): the player's chest at 55–78 % of
 * the frame height and the feet in it, the photo target above the middle, the top inside the frame, as close as that
 * allows, near the photo's own elevation. Pure (tests).
 */
export function zoneFrame(rise: number, d: number, elevation: number, top = NaN): { pitch: number; dist: number; lookUp: number } {
  const t = Math.tan((FOV / 2) * Math.PI / 180), want = clamp(elevation, 0.08, 0.3);
  const screenY = (hx: number, y: number, camX: number, camY: number, p: number) => 0.5 - 0.5 * Math.tan(Math.atan2(y - camY, hx - camX) + p) / t;
  let best = { pitch: want, dist: 15, lookUp: 0 }, bestScore = Infinity;
  for (const pitch of [want, 0.08, 0.14, 0.2, 0.26, 0.32]) {
    for (let dist = 15; dist <= 24.01; dist += 1.5) {
      for (let lookUp = -1.5; lookUp <= 5.01; lookUp += 0.25) {
        const ty = FOCUS + 0.13 * dist + lookUp;
        const camX = -Math.cos(pitch) * dist, camY = ty + Math.sin(pitch) * dist;
        const yp = screenY(0, FOCUS, camX, camY, pitch), yf = screenY(0, 0, camX, camY, pitch), ys = screenY(d, rise, camX, camY, pitch);
        const yt = Number.isFinite(top) ? screenY(d, top, camX, camY, pitch) : 0.5;
        const miss = Math.max(0, 0.55 - yp) + Math.max(0, yp - 0.78) + Math.max(0, yf - 0.9) + Math.max(0, 0.1 - ys) + Math.max(0, ys - 0.5) + Math.max(0, 0.05 - yt);
        const score = miss * 20 + (dist - 15) * 0.03 + Math.abs(pitch - want) * 0.8 + Math.abs(lookUp) * 0.02;
        if (score < bestScore) { bestScore = score; best = { pitch, dist, lookUp }; }
      }
    }
  }
  return best;
}

/**
 * (part b, verify-visual F6) Landmarks you arrive at under a structure: the usual 15–24 u framing put the camera inside
 * it. Fort Point's apron lies under the Golden Gate Bridge's south approach arch; at 15 u the camera stood in the arch's
 * pier and looked down through a dithered hole. A close, low camera stays under the deck with the fort's face in view.
 */
const LOW_FRAMES: Readonly<Record<string, { dist: number; pitch: number }>> = {
  'fort-point': { dist: 9, pitch: 0.1 },
};

/**
 * The zone view for one landmark. Null when it has no arrival / photo pose, for an overlook (the view from there is the
 * subject: the openness field handles it) and for a tower you arrive at the foot of (Sutro: nothing frames 49 u from
 * 7 u away; the hero point keeps the camera from looking through its legs). Its framing (`frame`) is solved again from
 * the ground heights when the camera enters it (camera.ts), once the chunks there are in.
 */
export function landmarkZoneView(id: string, ground: (x: number, z: number) => number): ZoneView | null {
  const l = sfLandmark(id), info = SF_LANDMARK_INFO.find(i => i.id === id), at = sfLandmarkAnchor(id);
  if (!l || !info || !at || info.height.rule === 'overlook') return null;
  const [tx, ty, tz] = info.photo.target;
  const t = landmarkToWorld(l, { x: tx, z: tz });
  const d = Math.hypot(t.x - at.x, t.z - at.z);
  const baseOf = (g: (x: number, z: number) => number) => (typeof l.base === 'number' ? l.base : g(l.x, l.z));
  const riseOf = (g: (x: number, z: number) => number) => baseOf(g) + ty - g(at.x, at.z);
  // (a structure's top: 90 % of its modelled height; terrain-rule landmarks have no top to keep in frame)
  const topOf = (g: (x: number, z: number) => number) => (info.height.rule === 'terrainY' ? NaN : baseOf(g) + info.height.u * 0.9 - g(at.x, at.z));
  if (d < 3 || d < riseOf(ground) * 0.5) return null;
  // the camera behind the player on the line to the subject, leaning (≤ 0.35 rad) toward the photo's side when the
  // arrival is on that side (the subject stays near the middle of the frame)
  const b = info.photo.bearing + l.yaw;
  const toPhoto = Math.atan2(Math.sin(b), Math.cos(b)), behind = Math.atan2(at.x - t.x, at.z - t.z);
  const off = wrap(toPhoto - behind);
  const lean = Math.abs(off) < 1.2 ? clamp(off * 0.5, -0.35, 0.35) : 0;
  // (axis / lean: camera.ts shrinks the lean on a narrow portrait view, where a 0.35 rad lean
  // puts the subject past the frame's edge: E2-review, the Golden Gate Bridge and Mission Dolores at 375 × 667)
  const v: ZoneView = { anchor: `lm-${id}`, x: at.x, z: at.z, yaw: behind + lean, axis: behind, lean, r: CITY_ZONE_R, near: 0.7, subject: info.name.en };
  const low = LOW_FRAMES[id];
  v.frame = g => {
    const f = zoneFrame(riseOf(g), d, info.photo.elevation, topOf(g));
    v.pitch = f.pitch; v.dist = f.dist; v.lookUp = f.lookUp;
    if (low) { v.dist = Math.min(v.dist, low.dist); v.pitch = Math.min(v.pitch, low.pitch); }
  };
  v.frame(ground);
  return v;
}

export function cityZoneViews(ground: (x: number, z: number) => number): ZoneView[] {
  const out: ZoneView[] = [];
  for (const info of SF_LANDMARK_INFO) { const v = landmarkZoneView(info.id, ground); if (v) out.push(v); }
  return out;
}
