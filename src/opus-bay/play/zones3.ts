import { Disc, Volleyball } from 'lucide-react';
import { createElement, lazy, Suspense } from 'react';
import { onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { canStand, heightAt, surfaceAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { DISTRICT } from '../data/district';
import { transitData } from '../data/transit';
import { bayNow } from '../game/bayNow';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { interactables, registerInteractables, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { turntableNear } from '../game/transit';
import { game } from '../core/store';
import { fireRingSeason } from '../realsf/seasons';
import { registerAskItem, registerOverlay, type OverlayProps } from '../ui/slots';
import { fireRingsLit, oceanBeachFireRings } from '../world/sf/landmarks/ocean-beach-fire-rings';
import { CREST_KEY, CREST_SPOTS, crestAt } from './crestSpots';
import { CROOKED, crookedTop } from './crookedCourses';
import { seatedNow } from './index';
import { bestOf, currentActivity } from './kit';
import { INVITE_GAP, INVITE_R, nearPlayer, PREFETCH_R, zoneInvite, zonePrefetch } from './zones';

/**
 * Wave 5 · lane A · part c (W5-A9, the should list): the zones of the should activities, one small chunk play/zones.ts
 * loads at init (city mode only) — the prompts, BAYBAY's invites and each activity's chunk fetched within PREFETCH_R:
 *
 *   marshmallow.ts   Ocean Beach's burning fire rings: 烤棉花糖 (几点能生火？ outside the NPS season and hours)
 *   heave.ts         the cable-car turntables: 嘿咻，推！ while a car turns near the player (lane T's turntableNear)
 *   crests.ts        the 12 crest hops (crestSpots.ts): the pennants near one, a car / bike crest hop there counts it
 *   sealions.ts      PIER 39's K-Dock: 数海狮 at the rail
 *   frisbee.ts       问 BAYBAY → 玩飞盘 on a lawn or a beach
 *   ball.ts          问 BAYBAY → 玩沙滩球 on the sand
 *   sled.ts          滑草 offered standing on a lawn steeper than 1 in 4
 *   crooked.ts       riding into the top of Lombard's or Vermont's crooked block: the gentle descent
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
/** A boarding prompt (a transit stop's, not lane T's 帮忙推) the player stands in reach of. */
export function boardingInReach(): boolean {
  for (const it of interactables()) {
    if (it.source === 'transit' && !it.id.startsWith('transit-push-') && nearPlayer(it.x, it.z, it.radius)) return true;
  }
  return false;
}
/** The prompt follows the turn near the player (4 Hz); true while one is on offer. */
export function placeHeave(tt: { id: string; x: number; z: number } | null): boolean {
  // (W6-K1, lane A's review) never over a boarding prompt: in reach of a stop's 坐叮当车 (the queue at Powell & Market
  // stands beside the turntable) the tap boards; the heave-ho is offered round it, not on top of it
  const on = !!tt && nearPlayer(tt.x, tt.z, HEAVE_PROMPT_R - 0.5) && !boardingInReach();
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


// --- the sea lions at PIER 39's K-Dock (W5-A9) ----------------------------------------------------------------------

export const LION_ID = 'sealions';
export const LION_NAME: Bilingual = { zh: '数海狮', en: 'Counting sea lions' };
export const LION_INVITE_LINE: Bilingual = { zh: '看，K 码头上好多海狮！数数有几只？', en: 'Look at all the sea lions on K-Dock! Shall we count them?' };
export const BADGE_OVERLAY = 'play-lion-badges';
export const LION_PROMPT_R = 2.6;
/** The rail over K-Dock (the district's `sea-lion-viewpoint` anchor, the same place in the city). */
export const LION_VIEW = DISTRICT.anchors['sea-lion-viewpoint'] ?? { x: -198.7, z: 3.8 };
/** 数海狮 stands 6 u along the rail from it (south-west): the viewpoint itself is the photo spot (给海狮拍照, radius 4), which
 * won the prompt there; 6 u out, each prompt has its own ground (checked in the game, 2026-09-28). */
export const LION_SPOT = { x: +(LION_VIEW.x - 4.24).toFixed(2), z: +(LION_VIEW.z - 4.24).toFixed(2) };
export const lionIt: Interactable = {
  id: 'play:sealions', source: 'activity', action: 'info', verb: { zh: '数海狮', en: 'Count the sea lions' }, name: { zh: 'K 码头', en: 'K-Dock' },
  x: LION_SPOT.x, z: LION_SPOT.z, radius: LION_PROMPT_R,
  act: () => { void import('./sealions').then(m => { m.startSeaLions(); }); },
};
const SeaLionBadges = lazy(() => import('./SeaLionBadges'));
const BadgeSlot = () => createElement(Suspense, { fallback: null }, createElement(SeaLionBadges));

// --- frisbee with BAYBAY (W5-A9): 问 BAYBAY → 玩飞盘 on a lawn or a beach ---------------------------------------------

export const FRISBEE_ID = 'frisbee';
export const FRISBEE_NAME: Bilingual = { zh: '和 BAYBAY 玩飞盘', en: 'Frisbee with BAYBAY' };
/** Grass, sand or earth under you and room to throw (the ask item shows only there). */
export function frisbeeHere(): boolean {
  const p = runtime.player, s = surfaceAt(p.x, p.z);
  return (s === 'grass' || s === 'sand' || s === 'dirt') && runtime.move.mode === 'foot';
}

// --- beach-ball keepy-uppy (W5-A9): 问 BAYBAY → 玩沙滩球 on the sand -------------------------------------------------

export const BALL_ID = 'beachball';
export const BALL_NAME: Bilingual = { zh: '颠沙滩球', en: 'Beach-ball rally' };
export const ballHere = (): boolean => surfaceAt(runtime.player.x, runtime.player.z) === 'sand' && runtime.move.mode === 'foot';

// --- the cardboard sled on steep grass (W5-A9): 滑草 follows you on a lawn steeper than 1 in 4 ----------------------

export const SLED_ID = 'sled';
export const SLED_NAME: Bilingual = { zh: '纸板滑草', en: 'Cardboard grass slide' };
export const SLED_PROMPT_R = 1.3;
/** Toy gravity along the slope, the cardboard's rub (sitting / leaning back), steering, the top speed, the rub off grass. */
export const SLED = { g: 9, mu: 0.19, muLean: 0.11, steer: 3.2, minGrade: 0.25, maxS: 12, offGrass: 4 } as const;
export const SLEDDABLE: ReadonlySet<string> = new Set(['grass', 'dirt']);
/** The slope under (x, z): its steepness (tan) and the way down (unit). */
export function slopeAt(x: number, z: number): { grade: number; dx: number; dz: number } {
  const e = 0.6;
  const gx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), gz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  const grade = Math.hypot(gx, gz);
  return { grade, dx: grade > 1e-6 ? -gx / grade : 0, dz: grade > 1e-6 ? -gz / grade : 0 };
}
/** A slide offered here runs at least this far (u: the ● medal), else 滑草 is not offered. */
export const SLED_RUN = 6;
/**
 * A slide can start at (x, z): grass or earth, steep enough, and a run of SLED_RUN u down the fall line — every 0.5 u on
 * grass and standable (a lamp post, a bench, a path in the way stops the cardboard), and the slope's pull beats the
 * sitting rub all the way (the sled's own energy: v² += 2·g·(grade − μ)·ds from the start push). (Review 2026-09-28: with
 * only two points checked, half of the offers on Dolores Park and most on Buena Vista slid under 6 u into a 再试试 card.)
 */
export function sledOffer(x: number, z: number): boolean {
  const s = surfaceAt(x, z);
  if (!s || !SLEDDABLE.has(s)) return false;
  let sl = slopeAt(x, z);
  if (sl.grade < SLED.minGrade) return false;
  // the sled's own motion (play/sled.ts sledStep, sitting, no steer) in ≤ 0.5 u steps: the pull down the slope less the rub
  let vx = sl.dx * 0.8, vz = sl.dz * 0.8;
  for (let d = 0; d < SLED_RUN;) {
    const sp = Math.hypot(vx, vz);
    if (sp < 0.25) return false;
    const dt = Math.min(0.1, 0.5 / sp), k = SLED.g * SLED.mu / sp;
    vx += (SLED.g * sl.grade * sl.dx - k * vx) * dt; vz += (SLED.g * sl.grade * sl.dz - k * vz) * dt;
    x += vx * dt; z += vz * dt; d += Math.hypot(vx, vz) * dt;
    if (!canStand(x, z, 0.35) || !SLEDDABLE.has(surfaceAt(x, z) ?? '')) return false;
    sl = slopeAt(x, z);
  }
  return true;
}
export const sledIt: Interactable = {
  id: 'play:sled', source: 'activity', action: 'info', verb: { zh: '滑草', en: 'Slide down' }, name: { zh: '坐纸板滑下去', en: 'On a sheet of cardboard' },
  x: 1e7, z: 1e7, radius: SLED_PROMPT_R,
  act: () => { void import('./sled').then(m => { m.startSled(); }); },
};

/** On foot, the crooked blocks' ends (u): people walk the side steps, whose ends are 3–4 u off the lane's (Lombard: the
 * game's own path follower from the top stopped 3.4 u from the lane's bottom, 2026-09-28). */
export const CROOKED_END_R = 5;

export function initZones3(): () => void {
  const offs: (() => void)[] = [];
  offs.push(registerInteractables('a-play-zones3', () => [...fireIts, heaveIt, lionIt, sledIt]));
  offs.push(registerOverlay({ id: BADGE_OVERLAY, Component: BadgeSlot }));
  offs.push(registerAskItem({ id: 'play-ball', order: -4, label: { zh: '玩沙滩球', en: 'Beach ball' }, icon: Volleyball, visible: ballHere, onSelect: () => { void import('./ball').then(m => { m.startBall(); }); } }));
  offs.push(registerAskItem({ id: 'play-frisbee', order: -5, label: { zh: '玩飞盘', en: 'Play frisbee' }, icon: Disc, visible: frisbeeHere, onSelect: () => { void import('./frisbee').then(m => { m.startFrisbee(); }); } }));
  offs.push(registerOverlay({ id: SNAP_OVERLAY, Component: SnapSlot }));
  // W7-M (lane M): the San Francisco mini-games' zones (play/sfgames.ts, its own chunk: the Musée's claw machine…)
  let offSf: (() => void) | null = null, sfGone = false;
  void import('./sfgames').then(m => { if (!sfGone) offSf = m.initSfGames(); }).catch(() => { /* the games stay away */ });
  offs.push(() => { sfGone = true; offSf?.(); });
  // a crest hop (lane F's vehicle:hop) at one of the 12 crests
  offs.push(onEvent(ev => {
    if (ev.type !== 'vehicle:hop' || !ev.crest) return;
    const i = crestAt(runtime.player.x, runtime.player.z);
    if (i >= 0) void import('./crests').then(m => { m.crestHop(i); });
  }));
  let crestsOn = false, crestHintAt = -Infinity;
  const walkFrom = new Map<string, number>();
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
    // the sea lions: fetched near the rail, BAYBAY's invite there
    if (nearPlayer(LION_VIEW.x, LION_VIEW.z, PREFETCH_R)) zonePrefetch('sealions', () => import('./sealions'));
    if (nearPlayer(LION_SPOT.x, LION_SPOT.z, INVITE_R + 1)) zoneInvite('sealions', LION_INVITE_LINE);
    // the grass slide: offered where you stand on a steep lawn (on foot, playing, nothing else running)
    {
      const p = runtime.player;
      // never over another prompt (a view spot on a steep lawn keeps its 坐下看风景), never over a seat (review 2026-09-28:
      // seated at Dolores Park's view spot, whose prompt goes while you sit there, the E prompt turned into 滑草)
      const on = runtime.move.mode === 'foot' && !p.moving && !currentActivity() && !seatedNow() && sledOffer(p.x, p.z)
        && !interactables().some(it => it !== sledIt && it.source !== 'baybay' && it.id !== 'play:sit' && Math.hypot(p.x - it.x, p.z - it.z) < it.radius + 0.5);
      sledIt.x = on ? p.x : 1e7; sledIt.z = on ? p.z : 1e7;
      if (on) zonePrefetch('sled', () => import('./sled'));
    }
    // the crooked blocks: a rider coming into the top, going down, starts the gentle descent; on foot, top → bottom, the facts
    for (const c of CROOKED) {
      const t = crookedTop(c), b = c.line[c.line.length - 1];
      if (runtime.move.mode === 'foot' && nearPlayer(t.x, t.z, CROOKED_END_R)) walkFrom.set(c.id, runtime.time);
      if (runtime.move.mode === 'foot' && nearPlayer(b.x, b.z, CROOKED_END_R) && runtime.time - (walkFrom.get(c.id) ?? -1e9) < 120) { walkFrom.delete(c.id); void import('./crooked').then(m => { m.walkedDown(c.id); }); }
    }
    if (runtime.vehicle.occupied && !currentActivity()) for (const c of CROOKED) {
      const t = crookedTop(c), n = c.line[Math.min(3, c.line.length - 1)], v = runtime.vehicle;
      if (Math.hypot(v.x - t.x, v.z - t.z) < PREFETCH_R) zonePrefetch('crooked', () => import('./crooked'));
      const dx = n.x - t.x, dz = n.z - t.z, L = Math.hypot(dx, dz) || 1;
      if (Math.hypot(v.x - t.x, v.z - t.z) < 3 && (Math.sin(v.heading) * dx + Math.cos(v.heading) * dz) / L > 0.3) void import('./crooked').then(m => { m.startDescent(c.id); });
    }
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
