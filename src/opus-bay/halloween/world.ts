import * as THREE from 'three';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { bayNow, bayParts } from '../game/bayNow';
import { baybayHeld } from '../game/baybayHold';
import { cinemaActive } from '../game/cinema';
import { travelActive } from '../game/fastTravel';
import { bubble, dialogueOpen } from '../game/flow';
import { flow } from '../game/flowStore';
import { BAYBAY_ID } from '../game/interactables';
import { bayTimeOfDay } from '../game/qa';
import { registerFrameSystem } from '../game/systemsRegistry';
import { createDayMemory, RealLineScheduler, type OfferedLine } from '../realsf/lines';
import { cityStreamerLazy } from '../world/cityLoader';
import { U } from '../world/materials';
import { getWorld } from '../world/world';
import { createHunt, huntList, pickPumpkin, pumpkinsFound, pumpkinTotal } from './hunt';
import { createHuntGuide, HUNT_RADAR, WISP_LINE_NEAR } from './huntGuide';
import { createMuertos, visitMuertos } from './muertos';
import { halloweenPhase, type HalloweenPhase } from './season';
import { BAT_COLONIES, createDress, nearestStoop } from './worldDress';
import { createHaloPool } from './worldHalos';
import { createHaunt } from './worldHaunt';
import { createFestival } from './worldFestival';
import { createVenuePatches, VENUE_LINE_NEAR } from './worldVenues';
import { lineText, type WorldLineKey } from './worldLines';

/**
 * Wave 6 · lane H · the Halloween season in the world (halloween/season.ts decides the phase; nothing here reads a date
 * of its own):
 *
 *   'season' (1–30 Oct)   the stoops dressed (worldDress.ts), trick-or-treaters on the sidewalks, bats at dusk, the hunt,
 *                         the haunted glow over the Sutro Baths ruins (worldHaunt.ts)
 *   'night'  (31 Oct)     the same, and BAYBAY's big-night line
 *   'muertos' (1–2 Nov)   the stoops keep their pumpkins (no costumes, no bats), the hunt goes on, and the Mission
 *                         keeps Día de los Muertos (muertos.ts: papel picado, marigolds, altars, the procession's start)
 *   'off'                 nothing is built
 *
 * One world system (`halloween-world`: the stoops, the hunt's lanterns, the bats, the halo pool) and one frame system.
 * BAYBAY's lines (halloween/worldLines.ts) go through lane R's once-a-Bay-day scheduler (realsf/lines.ts) with its own
 * memory key, held by the same gates as the city's lines. `{ type: 'halloween', what: 'phase' }` is emitted at the start
 * and when the phase changes (lane G listens; G does not emit it).
 *
 * DEV / QA: `__opusBay.halloween` (stats, the pool, pickPumpkin, huntList).
 */

export const HALLOWEEN_MEMORY_KEY = 'opus-bay:halloween:v1';
/** a stoop within this (u) counts as "the dressed street" for BAYBAY's lines */
const STREET_NEAR = 22;
/**
 * (W7-H1) The Halloween dusk: while the season runs (any phase but 'off') Karl's golden-hour colour leans this much toward
 * pumpkin orange (world/sf/fog.ts KarlState.setGoldenTint — fog.ts never reads the calendar: this feature pushes it).
 * (W8-H) `haze`: and at golden hour that colour lies thinly over the whole city, not only inside Karl's bank (the west):
 * the camera's own ground counts as `haze` under the bank (uKarlCam's floor) — downtown gets a soft apricot dusk that
 * deepens with distance (W7: the tint showed only where the bank is).
 */
export const DUSK_TINT = { color: '#f2a65a', amount: 0.35, haze: 0.35 } as const;

/** The golden-hour tint the phase wants (null: none). */
export const duskTintFor = (phase: HalloweenPhase): typeof DUSK_TINT | null => (phase === 'off' ? null : DUSK_TINT);

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    if (typeof location !== 'undefined' && /[?&]save=off(?:&|$)/.test(location.search)) return null;
    if (typeof localStorage === 'undefined') return null;
    return { getItem: () => localStorage.getItem(HALLOWEEN_MEMORY_KEY), setItem: (_k, v) => localStorage.setItem(HALLOWEEN_MEMORY_KEY, v) };
  } catch { return null; }
}

/** The dressing a phase wants. */
export function phaseWants(phase: HalloweenPhase): { stoops: boolean; figures: boolean; bats: boolean; hunt: boolean; muertos: boolean } {
  const on = phase !== 'off';
  const halloween = phase === 'season' || phase === 'night';
  return { stoops: on, figures: halloween, bats: halloween, hunt: on, muertos: phase === 'muertos' };
}

export function initHalloweenWorld(): () => void {
  const pool = createHaloPool();
  const dress = createDress();
  const hunt = createHunt();
  const muertos = createMuertos();
  const haunt = createHaunt();
  const venues = createVenuePatches();
  // W8-H: the Chinatown Halloween Festival on Waverly Place (31 Oct 2026, 11:00–15:00; halloween/worldFestival.ts)
  const festival = createFestival();
  const group = new THREE.Group();
  group.name = 'halloween-world';
  group.add(dress.group, hunt.group, muertos.group, haunt.group, venues.group, festival.group, pool.mesh);
  let offSystem: (() => void) | null = null;
  const attach = () => {
    if (offSystem || !cityStreamerLazy()) return;
    offSystem = getWorld().addSystem({ name: 'halloween-world', group });
  };

  let phase: HalloweenPhase = halloweenPhase();
  emit({ type: 'halloween', what: 'phase', id: phase });
  let wants = phaseWants(phase);
  dress.want(wants);
  // the pumpkin dusk: the first push into a world's Karl is instant (at load), a later phase change slides with Karl
  const karl = () => { try { return getWorld().env.karl; } catch { return null; } };
  let tinted: object | null = null;
  const pushTint = () => {
    const k = karl();
    if (!k) return;
    const t = duskTintFor(phase);
    k.setGoldenTint(t?.color ?? null, t?.amount ?? 0, tinted !== k, t?.haze ?? 0);
    tinted = k;
  };
  pushTint();
  const guide = createHuntGuide();

  const sched = new RealLineScheduler(createDayMemory(memoryStorage()));
  const offered: OfferedLine[] = [];
  const offer = (key: string, k: WorldLineKey) => offered.push({ key, text: lineText(k) });

  let clock = 0, acc = 1;
  const offFrame = registerFrameSystem('w6-halloween-world', dt => {
    clock += dt;
    const p = runtime.player;
    if (offSystem) {
      dress.step(dt, clock, p.x, p.z);
      hunt.step(dt, p.x, p.y, p.z, wants.hunt);
      muertos.step(dt, p.x, p.y, p.z, wants.muertos);
      haunt.step(dt, clock, p.x, p.z, wants.bats);
      pool.step();
    }
    if ((acc += dt) < 0.5) return;
    acc = 0;
    attach();
    const now = bayNow();
    const next = halloweenPhase(now);
    if (next !== phase) {
      phase = next;
      wants = phaseWants(phase);
      dress.want(wants);
      emit({ type: 'halloween', what: 'phase', id: phase });
    }
    // (W8-I, W8I-P-3 / D-5) Halloween night is the promo night: a first visit then follows the Bay clock (the lit stoops,
    // the bats, the night sky), not F11's golden hour — BAYBAY said 今晚是万圣节 and then 金色时刻 in sunlight
    if (phase === 'night' && flow.get().goldenFirstVisit && bayTimeOfDay(now) === 'night') flow.set({ goldenFirstVisit: false, timeOffer: null });
    pushTint();
    pool.set('dress', dress.halos());
    pool.set('hunt', wants.hunt ? hunt.halos() : [], 2);
    pool.set('muertos', wants.muertos ? muertos.halos() : [], 1);
    pool.set('haunt', wants.bats ? haunt.halos() : [], 1);
    // W7-H7: the pumpkin patches at the season's pumpkin events (the catalog's windows, lane S's kits)
    venues.step(p.x, p.z, !!offSystem && (phase === 'season' || phase === 'night'), now);
    pool.set('venues', venues.halos(), 1);
    // W8-H: the festival's kit on its day and hours, near Waverly Place (any season phase but 'off': it is 31 October)
    festival.step(p.x, p.z, !!offSystem && phase !== 'off', now);
    if (!offSystem || phase === 'off') return;

    const s = game.get(), f = flow.get();
    const gates = {
      silent: s.phase !== 'playing' || s.paused || s.mode === 'onboarding' || dialogueOpen() || cinemaActive() || !!f.cinematic || travelActive()
        || s.move.mode === 'travel' || s.photoMode || !!f.postcardReward || !!f.postcardFly || !!f.fishing || s.panel.kind !== null
        || baybayHeld(), // W8-K1 (lane K, surgical): a play panel, an egg card, the Halloween postcard… (game/baybayHold.ts)
      bubble: !!f.bubble,
      quiet: performance.now() < f.quietUntil,
    };
    // W7-H8: which way the nearest unfound lantern is (once a lantern a session, a gap between them): not once a day
    const near = wants.hunt ? hunt.nearUnfound(p.x, p.z, HUNT_RADAR) : null;
    const sniff = guide.step(performance.now() / 1000, p.x, p.z, runtime.camera.yaw, near, !gates.silent && !gates.bubble && !gates.quiet);
    if (sniff) { bubble(lineText(sniff), 4200, BAYBAY_ID, 'bark'); return; }

    // BAYBAY's lines: at most one on offer wins, once a Bay day each
    offered.length = 0;
    const night = U.uNight.value;
    const street = !!nearestStoop(p.x, p.z, STREET_NEAR);
    if (wants.muertos) for (const m of muertos.near(p.x, p.z, now)) offer(m.key, m.line);
    if (venues.near(p.x, p.z, VENUE_LINE_NEAR)) offer('venue-pumpkins', 'venuePumpkins');
    // W8-H: the Chinatown festival — the contest line by the stage, the lantern line in the alley
    const fest = festival.near(p.x, p.z);
    if (fest === 'contest') offer('chinatown-contest', 'chinatownContest');
    if (fest) offer('chinatown-lanterns', 'chinatownLanterns');
    if (near && Math.hypot(near.x - p.x, near.z - p.z) < WISP_LINE_NEAR) offer('hunt-wisp', 'huntWisp');
    if (wants.hunt && hunt.nearUnfound(p.x, p.z, 30)) offer('hunt-hint', night > 0.5 ? 'huntNight' : 'huntSniff');
    if (wants.bats && dress.stats().bats && BAT_COLONIES.some(c => Math.hypot(c.x - p.x, c.z - p.z) < 70)) offer('bats', 'bats');
    if (wants.figures && dress.nearFigure(p.x, p.z, 10)) offer('ghosts', 'ghosts');
    if (street && phase === 'night' && night > 0.5) offer('big-night', 'bigNight');
    if (street && night > 0.6) offer('night-glow', 'nightGlow');
    if (street && night < 0.3 && phase === 'season') offer('season-hello', 'seasonHello');
    // W7-H1: the pumpkin-coloured dusk (the season's golden hour, outdoors in the city)
    if ((phase === 'season' || phase === 'night') && karl()?.tod === 'golden' && night < 0.3) offer('dusk', 'dusk');
    if (!offered.length) return;
    const line = sched.step(performance.now() / 1000, bayParts(now).dateKey, gates, offered);
    if (line) bubble(line.text, 4600, BAYBAY_ID, 'bark');
  }, 5);

  let offQa = () => {};
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = {
      ...(w.__opusBay ?? {}),
      halloween: {
        phase: () => phase,
        stats: () => ({ phase, dress: dress.stats(), hunt: hunt.stats(), muertos: muertos.stats(), haunt: haunt.shown(), venues: venues.stats(), festival: festival.stats(), halos: pool.count(), attached: !!offSystem }),
        pickPumpkin, huntList, pumpkinsFound, pumpkinTotal, visitMuertos,
      },
    };
    offQa = () => { if (w.__opusBay) delete w.__opusBay.halloween; };
  }

  return () => {
    offFrame();
    offQa();
    offSystem?.();
    offSystem = null;
    karl()?.setGoldenTint(null, 0, true);
    dress.dispose();
    hunt.dispose();
    muertos.dispose();
    haunt.dispose();
    venues.dispose();
    festival.dispose();
    pool.dispose();
  };
}
