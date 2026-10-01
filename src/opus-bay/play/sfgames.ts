import { createElement, lazy, Suspense } from 'react';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import { registerInteractables, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { openOverlays, registerOverlay, type OverlayProps } from '../ui/slots';
import { currentActivity } from './kit';
import { CLAW_LINES, CLAW_NAME, CRAB_LINES, CRAB_NAME, DOUGH_LINES, DOUGH_NAME, FORTUNE_NAME } from './sfgamesLines';
import { INVITE_R, nearPlayer, PREFETCH_R, zoneInvite, zonePrefetch } from './zones';
import { importRetry } from '../game/importRetry';

/**
 * Wave 7 · lane M · the San Francisco mini-games' zones (one small chunk play/zones3.ts loads at init, city mode only):
 * the prompts where each game stands, BAYBAY's one invite there (the zones' own rate limit), each game's chunk fetched
 * within PREFETCH_R, and the games' panels as lazy overlays. Nothing is drawn in the 3D world by this module.
 *
 *   claw.ts + ClawPanel.tsx        the Musée Mécanique's claw machine (Pier 45), fortune.ts + FortunePanel.tsx its
 *                                  fortune-teller automaton
 *   crab.ts + CrabPanel.tsx        crabbing off Pier 7 with a hoop net (measure, and let them go)
 *   dough.ts + DoughPanel.tsx      shaping a sourdough loaf at the Wharf's bakery (knead, shape, score, bake)
 *   sfgamesProps.ts                the toy props at each game (one instanced mesh, mounted near)
 */

export interface GameSpot { x: number; z: number; r: number }

/**
 * The Musée Mécanique (attractions row `musee-mecanique`, its trip end −205.9, 73.9, by the crab-wheel sign at Jefferson
 * and Taylor): 抓娃娃 and 算一卦 on the pavement in front, each on standable ground with its own reach (Laughing Sal's
 * door, lane D's egg at −214.7, 71.3 r 3, and the Wharf's card at −198.5, 76.6 r 4 keep theirs).
 */
export const CLAW_SPOT: GameSpot = { x: -202.8, z: 71.8, r: 1.8 };
export const FORTUNE_SPOT: GameSpot = { x: -199.4, z: 70.8, r: 1.6 };
/**
 * Pier 7 (the district's `pier7`, a public fishing pier): 捞螃蟹 at the east rail about 16 u out (the pier's own frame
 * u 16, v −1.4), clear of the 甩一竿 fishing at its end (POI `pier7`, 20 u away) and of the benches.
 */
export const CRAB_SPOT: GameSpot = { x: 73.6, z: -24.3, r: 1.6 };
/**
 * The Wharf's sourdough bakery (attractions row `boudin-bakery` at −196.2, 65.4 — no bakery is named in the game): 捏酸面包
 * on the pavement on its east side, by a toy bakery table against its wall.
 */
export const DOUGH_SPOT: GameSpot = { x: -193.4, z: 66.4, r: 1.6 };

const ClawPanel = lazy(() => importRetry(() => import('./ClawPanel')));
const CrabPanel = lazy(() => importRetry(() => import('./CrabPanel')));
const CrabSlot = () => createElement(Suspense, { fallback: null }, createElement(CrabPanel));
const DoughPanel = lazy(() => importRetry(() => import('./DoughPanel')));
const DoughSlot = () => createElement(Suspense, { fallback: null }, createElement(DoughPanel));
const ClawSlot = () => createElement(Suspense, { fallback: null }, createElement(ClawPanel));
const FortunePanel = lazy(() => importRetry(() => import('./FortunePanel')));
const FortuneSlot = (p: OverlayProps) => createElement(Suspense, { fallback: null }, createElement(FortunePanel, p));

const CLAW_VERB: Bilingual = { zh: '抓娃娃', en: 'Try the claw' };
const FORTUNE_VERB: Bilingual = { zh: '算一卦', en: 'Get a fortune' };
const CRAB_VERB: Bilingual = { zh: '捞螃蟹', en: 'Go crabbing' };
const DOUGH_VERB: Bilingual = { zh: '捏酸面包', en: 'Shape a sourdough' };

export const clawIt: Interactable = {
  id: 'play:claw', source: 'activity', action: 'info', verb: CLAW_VERB, name: CLAW_NAME,
  x: CLAW_SPOT.x, z: CLAW_SPOT.z, radius: CLAW_SPOT.r,
  act: () => { void importRetry(() => import('./claw')).then(m => { m.startClaw(); }); },
};
export const fortuneIt: Interactable = {
  id: 'play:fortune', source: 'activity', action: 'info', verb: FORTUNE_VERB, name: FORTUNE_NAME,
  x: FORTUNE_SPOT.x, z: FORTUNE_SPOT.z, radius: FORTUNE_SPOT.r,
  act: () => { void importRetry(() => import('./fortune')).then(m => { m.tellFortune(); }); },
};

export const crabIt: Interactable = {
  id: 'play:crab', source: 'activity', action: 'info', verb: CRAB_VERB, name: CRAB_NAME,
  x: CRAB_SPOT.x, z: CRAB_SPOT.z, radius: CRAB_SPOT.r,
  act: () => { void importRetry(() => import('./crab')).then(m => { m.startCrab(); }); },
};

export const doughIt: Interactable = {
  id: 'play:sourdough', source: 'activity', action: 'info', verb: DOUGH_VERB, name: DOUGH_NAME,
  x: DOUGH_SPOT.x, z: DOUGH_SPOT.z, radius: DOUGH_SPOT.r,
  act: () => { void importRetry(() => import('./dough')).then(m => { m.startDough(); }); },
};

/** Every prompt of the mini-games (tests: each on standable ground, clear of the other prompts). */
export const sfGameIts = (): Interactable[] => [clawIt, fortuneIt, crabIt, doughIt];
/** Where the games' toy props stand (play/sfgamesProps.ts mounts them near: PROPS_NEAR 90 u, PROPS_FAR 110 u). */
const PROP_AT: readonly GameSpot[] = [CLAW_SPOT, CRAB_SPOT, DOUGH_SPOT];

export function initSfGames(): () => void {
  const offs: (() => void)[] = [];
  offs.push(registerOverlay({ id: 'play-claw', Component: ClawSlot }));
  offs.push(registerOverlay({ id: 'play-fortune', Component: FortuneSlot }));
  offs.push(registerOverlay({ id: 'play-crab', Component: CrabSlot }));
  offs.push(registerOverlay({ id: 'play-dough', Component: DoughSlot }));
  offs.push(registerInteractables('m-play-sfgames', sfGameIts));
  let acc = 0, propsOn = false, gone = false;
  // a game played this visit is not offered again by BAYBAY (her invite right after its card sounded odd)
  const played = new Set<string>();
  const invite = (id: string, line: Bilingual) => { if (!currentActivity() && !played.has(id)) zoneInvite(id, line); };
  offs.push(() => { gone = true; if (propsOn) { propsOn = false; void importRetry(() => import('./sfgamesProps')).then(m => { m.setPropsNear(false); }); } });
  offs.push(registerFrameSystem('m-play-sfgames', dt => {
    // while a game runs its prompts step aside (nothing to press twice; the E prompt would sit under the panel)
    const running = currentActivity();
    if (running) played.add(running.spec.id);
    const busy = !!running || openOverlays().some(o => o.id === 'play-fortune');
    clawIt.radius = busy ? 0 : CLAW_SPOT.r;
    fortuneIt.radius = busy ? 0 : FORTUNE_SPOT.r;
    crabIt.radius = busy ? 0 : CRAB_SPOT.r;
    doughIt.radius = busy ? 0 : DOUGH_SPOT.r;
    if ((acc += dt) < 0.25) return;
    acc = 0;
    if (game.get().worldMode !== 'city') return;
    // the props: mounted near a game, gone far from all (their own small chunk)
    const dProp = Math.min(...PROP_AT.map(s => Math.hypot(runtime.player.x - s.x, runtime.player.z - s.z)));
    if (dProp < 90 && !propsOn) { propsOn = true; void importRetry(() => import('./sfgamesProps')).then(m => { if (propsOn && !gone) m.setPropsNear(true); }); }
    else if (dProp > 110 && propsOn) { propsOn = false; void importRetry(() => import('./sfgamesProps')).then(m => { m.setPropsNear(false); }); }
    // the Musée: the claw and the fortune chunks near Pier 45, BAYBAY's invite at the door
    if (nearPlayer(CLAW_SPOT.x, CLAW_SPOT.z, PREFETCH_R)) {
      zonePrefetch('claw', () => Promise.all([importRetry(() => import('./claw')), importRetry(() => import('./ClawPanel'))]));
      zonePrefetch('fortune', () => Promise.all([importRetry(() => import('./fortune')), importRetry(() => import('./FortunePanel'))]));
      if (nearPlayer(CLAW_SPOT.x, CLAW_SPOT.z, INVITE_R)) invite('claw', CLAW_LINES.invite);
    }
    // the bakery: the sourdough chunk on Jefferson St, BAYBAY's invite at the table
    if (nearPlayer(DOUGH_SPOT.x, DOUGH_SPOT.z, PREFETCH_R)) {
      zonePrefetch('sourdough', () => Promise.all([importRetry(() => import('./dough')), importRetry(() => import('./DoughPanel'))]));
      if (nearPlayer(DOUGH_SPOT.x, DOUGH_SPOT.z, INVITE_R)) invite('sourdough', DOUGH_LINES.invite);
    }
    // Pier 7: the crabbing chunk on the pier, BAYBAY's invite at the rail
    if (nearPlayer(CRAB_SPOT.x, CRAB_SPOT.z, PREFETCH_R)) {
      zonePrefetch('crab', () => Promise.all([importRetry(() => import('./crab')), importRetry(() => import('./CrabPanel'))]));
      if (nearPlayer(CRAB_SPOT.x, CRAB_SPOT.z, INVITE_R)) invite('crab', CRAB_LINES.invite);
    }
  }));
  // DEV / QA: __opusBay.sfgames (the games' own module instances)
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = { ...(w.__opusBay ?? {}), sfgames: { claw: () => import('./claw'), crab: () => import('./crab'), dough: () => import('./dough'), fortune: () => import('./fortune'), kit: () => import('./kit'), props: () => import('./sfgamesProps') } };
  }
  return () => { for (const off of offs.splice(0).reverse()) { try { off(); } catch { /* gone */ } } };
}
