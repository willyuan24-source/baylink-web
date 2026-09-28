import type { Bilingual } from '../core/types';
import { bayNow } from '../game/bayNow';
import { bubble } from '../game/flow';
import { registerInteractables, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { game } from '../core/store';
import { fireRingSeason } from '../realsf/seasons';
import { fireRingsLit, oceanBeachFireRings } from '../world/sf/landmarks/ocean-beach-fire-rings';
import { INVITE_R, nearPlayer, PREFETCH_R, zoneInvite, zonePrefetch } from './zones';

/**
 * Wave 5 · lane A · part c (W5-A9, the should list): the zones of the should activities, one small chunk play/zones.ts
 * loads at init (city mode only) — the prompts, BAYBAY's invites and each activity's chunk fetched within PREFETCH_R:
 *
 *   marshmallow.ts   Ocean Beach's burning fire rings: 烤棉花糖 (几点能生火？ outside the NPS season and hours)
 */

// --- the Ocean Beach fire rings (W5-A9 marshmallow) ------------------------------------------------------------------

export const FIRE_ID = 'marshmallow';
export const FIRE_NAME: Bilingual = { zh: '烤棉花糖', en: 'Toasting marshmallows' };
export const FIRE_INVITE_LINE: Bilingual = { zh: '篝火烧着呢！一起烤个棉花糖？', en: 'The fire’s going! Toast a marshmallow?' };
/** Outside the NPS program (1 March – 31 October; 06:00 – 21:30 Bay time: realsf/seasons.ts, lane R). */
export const FIRE_SEASON_LINE: Bilingual = { zh: '海滩篝火季是 3 月到 10 月底，春天再来烤棉花糖！', en: 'Beach fires run March to October: come back in spring!' };
export const FIRE_HOURS_LINE: Bilingual = { zh: '海滩篝火只能早上 6 点到晚上 9 点半生哦！', en: 'Beach fires are only allowed 6 am to 9:30 pm!' };
export const FIRE_PROMPT_R = 2.2;
const TOAST_VERB: Bilingual = { zh: '烤棉花糖', en: 'Toast a marshmallow' };
const WHEN_VERB: Bilingual = { zh: '几点能生火？', en: 'When are fires allowed?' };

export interface FireRing {
  /** the ring's index along the beach (lane L's site: every other one burns) */
  k: number;
  x: number;
  z: number;
  /** unit vector from the ring toward the promenade (the site's local +x) */
  ix: number;
  iz: number;
  /** along the beach toward Lincoln Way (the site's local +z) */
  ax: number;
  az: number;
}

/** The rings lane L's site lights (odd k: a toy flame burns in every other one in the program's hours), in world x, z. */
export const FIRE_RINGS: readonly FireRing[] = (() => {
  const s = oceanBeachFireRings, c = Math.cos(s.yaw), n = Math.sin(s.yaw);
  return (s.walk?.blockers ?? []).flatMap((b, k) => (k % 2 && 'x' in b ? [{
    k, x: +(s.x + b.x * c + b.z * n).toFixed(2), z: +(s.z - b.x * n + b.z * c).toFixed(2), ix: c, iz: -n, ax: n, az: c,
  }] : []));
})();
export const fireRingByK = (k: number): FireRing | undefined => FIRE_RINGS.find(r => r.k === k);

/** Fires may burn now (the site's cached isFireRingLit), and the line BAYBAY says when they may not. */
export const fireLit = (): boolean => fireRingsLit();
export const fireClosedLine = (date: Date = bayNow()): Bilingual => (fireRingSeason(date) ? FIRE_HOURS_LINE : FIRE_SEASON_LINE);

/** 烤棉花糖 at every burning ring (几点能生火？ outside the program's season and hours). */
export const fireIts: Interactable[] = FIRE_RINGS.map(r => ({
  id: `play:fire:${r.k}`, source: 'activity', action: 'info', verb: TOAST_VERB, name: { zh: '篝火圈', en: 'Fire ring' },
  x: r.x, z: r.z, radius: FIRE_PROMPT_R,
  act: () => {
    if (!fireLit()) { bubble(fireClosedLine(), 4200); return; }
    void import('./marshmallow').then(m => { m.startMarshmallow(r.k); });
  },
}));


export function initZones3(): () => void {
  const offs: (() => void)[] = [];
  offs.push(registerInteractables('a-play-zones3', () => [...fireIts]));
  let acc = 0;
  offs.push(registerFrameSystem('a-play-zones3', dt => {
    if ((acc += dt) < 0.25) return;
    acc = 0;
    if (game.get().worldMode !== 'city') return;
    // the fire rings: the verb follows the NPS season and hours; the marshmallow fetched near the row; BAYBAY's invite
    const lit = fireLit();
    for (const it of fireIts) it.verb = lit ? TOAST_VERB : WHEN_VERB;
    if (lit && FIRE_RINGS.some(r => nearPlayer(r.x, r.z, PREFETCH_R))) {
      zonePrefetch('marshmallow', () => import('./marshmallow'));
      if (FIRE_RINGS.some(r => nearPlayer(r.x, r.z, INVITE_R))) zoneInvite('fire', FIRE_INVITE_LINE);
    }
  }));
  return () => { for (const off of offs.splice(0).reverse()) { try { off(); } catch { /* gone */ } } };
}
