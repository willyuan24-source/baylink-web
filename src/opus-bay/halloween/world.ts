import * as THREE from 'three';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { bayNow, bayParts } from '../game/bayNow';
import { cinemaActive } from '../game/cinema';
import { travelActive } from '../game/fastTravel';
import { bubble, dialogueOpen } from '../game/flow';
import { flow } from '../game/flowStore';
import { BAYBAY_ID } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { createDayMemory, RealLineScheduler, type OfferedLine } from '../realsf/lines';
import { cityStreamerLazy } from '../world/cityLoader';
import { U } from '../world/materials';
import { getWorld } from '../world/world';
import { createHunt, huntList, pickPumpkin, pumpkinsFound, pumpkinTotal } from './hunt';
import { createMuertos, visitMuertos } from './muertos';
import { halloweenPhase, type HalloweenPhase } from './season';
import { BAT_COLONIES, createDress, nearestStoop } from './worldDress';
import { createHaloPool } from './worldHalos';
import { createHaunt } from './worldHaunt';
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
  const group = new THREE.Group();
  group.name = 'halloween-world';
  group.add(dress.group, hunt.group, muertos.group, haunt.group, pool.mesh);
  let offSystem: (() => void) | null = null;
  const attach = () => {
    if (offSystem || !cityStreamerLazy()) return;
    offSystem = getWorld().addSystem({ name: 'halloween-world', group });
  };

  let phase: HalloweenPhase = halloweenPhase();
  emit({ type: 'halloween', what: 'phase', id: phase });
  let wants = phaseWants(phase);
  dress.want(wants);

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
    pool.set('dress', dress.halos());
    pool.set('hunt', wants.hunt ? hunt.halos() : [], 2);
    pool.set('muertos', wants.muertos ? muertos.halos() : [], 1);
    pool.set('haunt', wants.bats ? haunt.halos() : [], 1);
    if (!offSystem || phase === 'off') return;

    // BAYBAY's lines: at most one on offer wins, once a Bay day each
    offered.length = 0;
    const night = U.uNight.value;
    const street = !!nearestStoop(p.x, p.z, STREET_NEAR);
    const m = wants.muertos ? muertos.near(p.x, p.z) : null;
    if (m) offer(m === 'muertosProcession' ? 'muertos-procession' : 'muertos-hello', m);
    if (wants.hunt && hunt.nearUnfound(p.x, p.z, 30)) offer('hunt-hint', night > 0.5 ? 'huntNight' : 'huntSniff');
    if (wants.bats && dress.stats().bats && BAT_COLONIES.some(c => Math.hypot(c.x - p.x, c.z - p.z) < 70)) offer('bats', 'bats');
    if (wants.figures && dress.nearFigure(p.x, p.z, 10)) offer('ghosts', 'ghosts');
    if (street && phase === 'night' && night > 0.5) offer('big-night', 'bigNight');
    if (street && night > 0.6) offer('night-glow', 'nightGlow');
    if (street && night < 0.3 && phase === 'season') offer('season-hello', 'seasonHello');
    if (!offered.length) return;
    const s = game.get(), f = flow.get();
    const line = sched.step(performance.now() / 1000, bayParts(now).dateKey, {
      silent: s.phase !== 'playing' || s.paused || s.mode === 'onboarding' || dialogueOpen() || cinemaActive() || !!f.cinematic || travelActive()
        || s.move.mode === 'travel' || s.photoMode || !!f.postcardReward || !!f.postcardFly || !!f.fishing || s.panel.kind !== null,
      bubble: !!f.bubble,
      quiet: performance.now() < f.quietUntil,
    }, offered);
    if (line) bubble(line.text, 4600, BAYBAY_ID, 'bark');
  }, 5);

  let offQa = () => {};
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = {
      ...(w.__opusBay ?? {}),
      halloween: {
        phase: () => phase,
        stats: () => ({ phase, dress: dress.stats(), hunt: hunt.stats(), muertos: muertos.stats(), haunt: haunt.shown(), halos: pool.count(), attached: !!offSystem }),
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
    dress.dispose();
    hunt.dispose();
    muertos.dispose();
    haunt.dispose();
    pool.dispose();
  };
}
