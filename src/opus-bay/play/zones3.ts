import { createElement, lazy, Suspense } from 'react';
import { onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import type { Bilingual } from '../core/types';
import { transitData } from '../data/transit';
import { bayNow } from '../game/bayNow';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerInteractables, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { turntableNear } from '../game/transit';
import { game } from '../core/store';
import { fireRingSeason } from '../realsf/seasons';
import { registerOverlay, type OverlayProps } from '../ui/slots';
import { fireRingsLit, oceanBeachFireRings } from '../world/sf/landmarks/ocean-beach-fire-rings';
import { CREST_KEY, CREST_SPOTS, crestAt } from './crestSpots';
import { bestOf } from './kit';
import { INVITE_GAP, INVITE_R, nearPlayer, PREFETCH_R, zoneInvite, zonePrefetch } from './zones';

/**
 * Wave 5 · lane A · part c (W5-A9, the should list): the zones of the should activities, one small chunk play/zones.ts
 * loads at init (city mode only) — the prompts, BAYBAY's invites and each activity's chunk fetched within PREFETCH_R:
 *
 *   marshmallow.ts   Ocean Beach's burning fire rings: 烤棉花糖 (几点能生火？ outside the NPS season and hours)
 *   heave.ts         the cable-car turntables: 嘿咻，推！ while a car turns near the player (lane T's turntableNear)
 *   crests.ts        the 12 crest hops (crestSpots.ts): the pennants near one, a car / bike crest hop there counts it
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

// --- the cable-car turntables (W5-A9 heave-ho) ---------------------------------------------------------------------

export const HEAVE_ID = 'heave';
export const HEAVE_NAME: Bilingual = { zh: '嘿咻推转盘', en: 'Heave-ho turntable' };
export const HEAVE_INVITE_LINE: Bilingual = { zh: '车要掉头啦！跟着我喊：嘿——咻！', en: 'The car’s turning! Shout with me: heave — ho!' };
/** Lane T's own 帮忙推 prompt reaches 12 u: this one reaches a hair further, so it takes the focus while a car turns. */
export const HEAVE_PROMPT_R = 12.5;
const FAR = 1e7;

/** 嘿咻，推！ at the turntable turning near the player (lane T's turntableNear), parked far away otherwise. */
export const heaveIt: Interactable = {
  id: 'play:heave', source: 'activity', action: 'info', verb: { zh: '嘿咻，推！', en: 'Heave-ho!' }, name: HEAVE_NAME,
  x: FAR, z: FAR, radius: HEAVE_PROMPT_R,
  act: () => { const id = heaveIt.refId; if (id) void import('./heave').then(m => { m.heavePush(id); }); },
};
/** The prompt follows the turn near the player (4 Hz); true while one is on offer. */
export function placeHeave(tt: { id: string; x: number; z: number } | null): boolean {
  const on = !!tt && nearPlayer(tt.x, tt.z, HEAVE_PROMPT_R - 0.5);
  heaveIt.x = on ? tt!.x : FAR; heaveIt.z = on ? tt!.z : FAR; heaveIt.refId = on ? tt!.id : undefined;
  return on;
}

// --- the crest hops (W5-A9) ------------------------------------------------------------------------------------------

export const SNAP_OVERLAY = 'play-snap';
export const CREST_HINT: Bilingual = { zh: '前面坡顶插着小旗，开快点冲过去能飞起来！', en: 'Pennants on the crest ahead — go fast and we’ll fly!' };
const CrestSnap = lazy(() => import('./CrestSnap'));
const SnapSlot = ({ props, close }: OverlayProps) => createElement(Suspense, { fallback: null }, createElement(CrestSnap, { props, close }));
/** A crest near the player for the pennants (u) and for BAYBAY's hint while riding (u). */
export const CREST_NEAR = 160, CREST_HINT_R = 60;


export function initZones3(): () => void {
  const offs: (() => void)[] = [];
  offs.push(registerInteractables('a-play-zones3', () => [...fireIts, heaveIt]));
  offs.push(registerOverlay({ id: SNAP_OVERLAY, Component: SnapSlot }));
  // a crest hop (lane F's vehicle:hop) at one of the 12 crests
  offs.push(onEvent(ev => {
    if (ev.type !== 'vehicle:hop' || !ev.crest) return;
    const i = crestAt(runtime.player.x, runtime.player.z);
    if (i >= 0) void import('./crests').then(m => { m.crestHop(i); });
  }));
  let crestsOn = false, crestHintAt = -Infinity;
  offs.push(() => { if (crestsOn) void import('./crests').then(m => { m.setCrestsNear(false); }); });
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
    // the turntables: the prompt follows a turn near the player; the heave-ho fetched near one; BAYBAY's invite as it starts
    const tt = turntableNear();
    if ((transitData()?.turntables ?? []).some(t => nearPlayer(t.x, t.z, PREFETCH_R))) zonePrefetch('heave', () => import('./heave'));
    if (placeHeave(tt)) zoneInvite('heave', HEAVE_INVITE_LINE);
    // the crests: the pennants while one is near (the crests chunk), BAYBAY's hint riding toward one not hopped yet
    const near = CREST_SPOTS.some(s => nearPlayer(s.x, s.z, CREST_NEAR));
    if (near !== crestsOn) { crestsOn = near; void import('./crests').then(m => { m.setCrestsNear(crestsOn); }); }
    const riding = runtime.move.mode === 'bike' || runtime.move.mode === 'car', hopped = bestOf(CREST_KEY) ?? 0;
    if (riding && runtime.time - crestHintAt > INVITE_GAP && !flow.get().bubble && CREST_SPOTS.some((s, i) => !((hopped >> i) & 1) && nearPlayer(s.x, s.z, CREST_HINT_R))) {
      crestHintAt = runtime.time;
      bubble(CREST_HINT, 3400);
    }
  }));
  return () => { for (const off of offs.splice(0).reverse()) { try { off(); } catch { /* gone */ } } };
}
