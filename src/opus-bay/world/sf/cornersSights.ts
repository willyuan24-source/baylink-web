import { runtime } from '../../core/runtime';
import { game } from '../../core/store';
import type { Bilingual, Vec2 } from '../../core/types';
import type { WorldSystem } from '../world';
import { CT_GATE, ctPoint } from './cornersChinatown';
import { importRetry } from '../../game/importRetry';

/**
 * Wave 8 · lane W1 · BAYBAY's sight lines at this lane's new models (W8-W1, city mode only): one fixed line, once per
 * session, when the player first walks into a small circle in front of the sight — the pagoda towers seen from Grant Ave
 * north of the Dragon Gate, Old St. Mary's tower door, the O'Brien's stern from the Pier 35 promenade. Each is said
 * through BAYBAY's pacer (game/cityContent.ts baybayLine: it waits for the line she is saying, drops this one after
 * TTL s rather than say it late, never repeats it within minutes), so an arrival bark is never talked over. Fixed zh + en
 * texts (no template: lane X voices them by exact text, data/sf/voiceW8.ts). The circles stand away from the
 * attractions' own trip ends, so a trip's arrival bark and a sight line do not meet at one spot.
 *
 * W8-W1-review: only on foot, on a bike or sitting (W1-P2: not from the pelican high over Grant Ave, a car or transit;
 * lane W2's westPlayer rule); a line BAYBAY's pacer refuses is not spent (offered again on the next poll inside); the
 * O'Brien's circle sits on the apron east of her trip end and speaks only while the player faces the ship (W1-P3: the
 * walk west from the Embarcadero used to hear "this Liberty ship" with Pier 39 on screen and the ship behind).
 *
 * Facts (checked on the web 2026-09-30): Sing Fat on the south-west corner of Grant & California, Sing Chong on the
 * north-west (https://en.wikipedia.org/wiki/Look_Tin_Eli). The roof colours (W8-C, checked 2026-10-01): Sing Chong's
 * "green, multi-tiered pagoda-style roof" (a photo caption in The Epoch Times, 13 Jul 2026,
 * https://cmsapi.theepochtimes.com/bright/defining-chinatown-architecture-and-cultural-identity-after-destruction-6055349);
 * Sing Fat's yellow roofs: NO source found — that article gives Sing Fat's palette only as "red, green, and yellow", and
 * Wikipedia, theclio.com/entry/186932, virtourist.com and the Commons file descriptions name no roof colour. The voiced
 * line keeps its text tonight (an edit would unvoice it); wave 9: source Sing Fat's roof colour or re-record the line.
 * The fire after the 1906 quake "melted the church bells and marble altar", the walls and tower survived
 * (https://en.wikipedia.org/wiki/Old_St._Mary%27s_Cathedral); the O'Brien returned to Normandy in 1994 for the 50th
 * anniversary of D-Day (https://en.wikipedia.org/wiki/SS_Jeremiah_O%27Brien).
 */

export interface SightLine extends Bilingual {
  /** line id (lane X's voice table) */
  id: string;
  /** the circle (world) the player walks into */
  x: number; z: number; r: number;
  source: string;
  /** said only while the player's heading points at this spot (within FACE_MAX) */
  face?: Vec2;
}

/** a `face` line waits until the player's heading is within this of the spot (rad) */
export const FACE_MAX = (70 * Math.PI) / 180;
/** The player at (x, z) with this heading faces `face` (within FACE_MAX). */
export function facing(x: number, z: number, heading: number, face: Vec2): boolean {
  let d = Math.abs(Math.atan2(face.x - x, face.z - z) - heading) % (Math.PI * 2);
  d = Math.min(d, Math.PI * 2 - d);
  return d <= FACE_MAX;
}
/** BAYBAY's sight lines are for a player on foot, on a bike or sitting (not gliding, driving, on transit, travelling). */
export function sightMode(): boolean {
  const m = game.get().move.mode;
  return m === 'foot' || m === 'bike' || m === 'sit';
}

/** Grant Ave frame (along, across) → world (the Dragon Gate's frame) */
function grantWorld(along: number, across: number): Vec2 {
  const p = ctPoint(along, across), c = Math.cos(CT_GATE.yaw), s = Math.sin(CT_GATE.yaw);
  return { x: +(CT_GATE.x + p.x * c + p.z * s).toFixed(2), z: +(CT_GATE.z - p.x * s + p.z * c).toFixed(2) };
}

export const W8_W1_LINES: readonly SightLine[] = [
  {
    id: 'w8w1-pagodas-ahead', ...grantWorld(13, 0), r: 3.5,
    zh: '往上看！路口那两座宝塔楼，黄顶的是 Sing Fat，绿顶的是 Sing Chong。',
    en: 'Look up the street! At the corner, the yellow roofs are Sing Fat and the green ones Sing Chong.',
    // (W8-C) Sing Chong's green roof is sourced (2026-10-01); Sing Fat's yellow roofs are not (the header): wave 9
    source: 'https://en.wikipedia.org/wiki/Look_Tin_Eli ; https://cmsapi.theepochtimes.com/bright/defining-chinatown-architecture-and-cultural-identity-after-destruction-6055349 (Sing Chong green roof, checked 2026-10-01; Sing Fat yellow: unsourced)',
  },
  {
    id: 'w8w1-st-marys-bells', ...grantWorld(27.9, 3.3), r: 2.2,
    zh: '1906 年的大火把教堂里的钟都烧化了，砖墙和钟楼却挺了过来。',
    en: 'The 1906 fire melted the church bells, but the brick walls and the clock tower held.',
    source: 'https://en.wikipedia.org/wiki/Old_St._Mary%27s_Cathedral',
  },
  {
    // the apron east of her trip end (data/sf/attractions ARRIVAL_OVERRIDES: (-126, -10)), where the walk from the
    // Embarcadero heads west and rounds Pier 35's shed with the hull ahead; `face` = world/sf/wharfShips OBRIEN_MID (the
    // test keeps them equal)
    id: 'w8w1-obrien-normandy', x: -120, z: -8.5, r: 3, face: { x: -131.56, z: -19.42 },
    zh: '这艘自由轮 1994 年还自己开回诺曼底，参加了登陆 50 周年纪念！',
    en: 'In 1994 this Liberty ship steamed back to Normandy for D-Day\'s 50th anniversary!',
    source: 'https://en.wikipedia.org/wiki/SS_Jeremiah_O%27Brien',
  },
];

/** a line is dropped rather than said this late (s) */
export const SIGHT_TTL = 15;
const POLL = 0.4;

/** The sight a point stands in (null when none). */
export function sightAt(x: number, z: number): SightLine | null {
  for (const l of W8_W1_LINES) if ((x - l.x) ** 2 + (z - l.z) ** 2 <= l.r * l.r) return l;
  return null;
}

/** City mode: the sight lines as a world system (world/sf/cityWorld.ts adds it). `say` stands in for BAYBAY in tests. */
export function attachSights(say?: (text: Bilingual) => boolean | void): WorldSystem {
  const said = new Set<string>();
  let wait = 0, disposed = false;
  // a refused line (the pacer's queue would not take it) is not spent: the next poll inside the circle offers it again
  const speak = (id: string, text: Bilingual) => {
    if (say) { if (say(text) === false) said.delete(id); return; }
    void importRetry(() => import('../../game/cityContent')).then(m => {
      if (!disposed && !m.baybayLine(text, { ttl: SIGHT_TTL })) said.delete(id);
    }, () => { said.delete(id); });
  };
  return {
    name: 'w1-sights',
    update(dt) {
      wait -= dt;
      if (wait > 0) return;
      wait = POLL;
      const p = runtime.player, l = sightAt(p.x, p.z);
      if (!l || said.has(l.id) || !sightMode() || (l.face && !facing(p.x, p.z, p.heading, l.face))) return;
      said.add(l.id);
      speak(l.id, { zh: l.zh, en: l.en });
    },
    dispose() { disposed = true; },
  };
}
