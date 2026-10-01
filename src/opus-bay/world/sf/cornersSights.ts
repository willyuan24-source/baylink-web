import { runtime } from '../../core/runtime';
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
 * Facts (checked on the web 2026-09-30): Sing Fat on the south-west corner of Grant & California, Sing Chong on the
 * north-west (https://en.wikipedia.org/wiki/Look_Tin_Eli; the colours: the Wikimedia Commons photos of the two towers);
 * the fire after the 1906 quake "melted the church bells and marble altar", the walls and tower survived
 * (https://en.wikipedia.org/wiki/Old_St._Mary%27s_Cathedral); the O'Brien returned to Normandy in 1994 for the 50th
 * anniversary of D-Day (https://en.wikipedia.org/wiki/SS_Jeremiah_O%27Brien).
 */

export interface SightLine extends Bilingual {
  /** line id (lane X's voice table) */
  id: string;
  /** the circle (world) the player walks into */
  x: number; z: number; r: number;
  source: string;
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
    source: 'https://en.wikipedia.org/wiki/Look_Tin_Eli',
  },
  {
    id: 'w8w1-st-marys-bells', ...grantWorld(27.9, 3.3), r: 2.2,
    zh: '1906 年的大火把教堂里的钟都烧化了，砖墙和钟楼却挺了过来。',
    en: 'The 1906 fire melted the church bells, but the brick walls and the clock tower held.',
    source: 'https://en.wikipedia.org/wiki/Old_St._Mary%27s_Cathedral',
  },
  {
    id: 'w8w1-obrien-normandy', x: -126.5, z: -9.0, r: 4.5,
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
export function attachSights(say?: (text: Bilingual) => void): WorldSystem {
  const said = new Set<string>();
  let wait = 0, disposed = false;
  const speak = say ?? ((text: Bilingual) => {
    void importRetry(() => import('../../game/cityContent')).then(m => { if (!disposed) m.baybayLine(text, { ttl: SIGHT_TTL }); }, () => {});
  });
  return {
    name: 'w1-sights',
    update(dt) {
      wait -= dt;
      if (wait > 0) return;
      wait = POLL;
      const p = runtime.player, l = sightAt(p.x, p.z);
      if (!l || said.has(l.id)) return;
      said.add(l.id);
      speak({ zh: l.zh, en: l.en });
    },
    dispose() { disposed = true; },
  };
}
