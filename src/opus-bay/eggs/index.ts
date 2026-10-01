import { lazy } from 'react';
import * as THREE from 'three';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { onSaveCleared } from '../data/save';
import { registerHintSource } from '../economy/hints';
import { bayNow } from '../game/bayNow';
import { registerRewardIds } from '../economy/ledger';
import { registerRumourSource } from '../game/rumours';
import { registerSceneSystem } from '../game/systemsRegistry';
import { registerOverlay } from '../ui/slots';
import { cookiesHost } from './cookies';
import { nortonHost, phoneHost } from './downtown';
import { forgetEggMemory } from './gates';
import { activeHosts, type EggHost, flock, forgetPaidEggs, isFound, liveHosts, props, resetEggHosts, reveal, startHosts } from './hosts';
import { crissyHost, foghornHost, octagonHost, otterHost, waveOrganHost } from './marina';
import { castroHost, hydrantHost, karlHost } from './mission';
import { parrotsHost } from './north';
import { dahliaHost, tiledStepsHost } from './park';
import { altaHost, humpbackHost, trailHost } from './presidio';
import { registerEggWarmup } from './props';
import { batch2Hosts } from './batch2';
import { SOUND_IDS } from './citySounds';
import { forgetHeard, heard, soundFound, soundHosts } from './listen';
import { PEBBLE_IDS } from './pebbleSpots';
import { pebbleCount, pebbleHintSpots, pebblesHost, pickPebble, showNextTrick } from './pebbles';
import { ALL_EGG_IDS } from './registry';
import { eggHintSpots, eggRumour } from './rumourSource';
import { makeEggScene } from './scene';
import { registerEggSounds } from './sounds';
import { heronsHost, sundialHost } from './south';
import { alcatrazHost, laughingLadyHost, seaLionsHost } from './wharf';
import { chinaBeachHost, labyrinthHost } from './west';
import { importRetry } from '../game/importRetry';

/**
 * Wave 5 · lane D — the 24 real San Francisco easter eggs (小发现), their hosts, fact cards and rumours.
 *
 * game/w5Features.ts loads this module lazily in city mode only and calls `init()` once (after the economy, so lane E's
 * ledger already listens for our `reward`s). `init()` starts everything and returns the function that undoes it. Every
 * other module of this folder stays behind this one (no static import of it from a module GameRoot loads).
 *
 * What init wires:
 *   the egg id list with the ledger (registerRewardIds('egg', ALL_EGG_IDS): bit i of play.g.egg), the compass
 *   (registerHintSource('egg', …): every spot where an unfound egg can happen today) and the rumours (lane C's
 *   registerRumourSource: BAYBAY's 听说… about an unfound egg of the zone; eggs/rumourSource.ts)
 *   the sounds (audio/hooks), the overlays (ui/slots: egg-card, egg-note, egg-operator)
 *   the prop pool and the flock (one scene system, warmed), the hosts (one frame system, the prompts)
 *
 * The public API for other lanes (import from your own lazy chunk): eggs/registry.ts (ids, riddles, rumours, spots).
 */

// the cards load with their stylesheet on first show (the overlay render point wraps them in Suspense): the init chunk stays
// small and loads in node too (the contracts test starts every feature)
const FactCard = lazy(() => importRetry(() => import('./FactCard')).then(m => ({ default: m.FactCard })));
const NoteCard = lazy(() => importRetry(() => import('./FactCard')).then(m => ({ default: m.NoteCard })));
const OperatorBubble = lazy(() => importRetry(() => import('./FactCard')).then(m => ({ default: m.OperatorBubble })));
const ListenRing = lazy(() => importRetry(() => import('./FactCard')).then(m => ({ default: m.ListenRing })));

/** One host per egg, in the registry's order (W5-D3: eggs 1–12; W5-D4: eggs 13–24; W5-D6: eggs 25–33), then 城市之声 and the pebbles (W5-D6). */
export function makeHosts(): EggHost[] {
  return [
    parrotsHost(), seaLionsHost(), laughingLadyHost(), phoneHost(), cookiesHost(), nortonHost(),
    waveOrganHost(), crissyHost(), otterHost(), octagonHost(), alcatrazHost(), foghornHost(),
    humpbackHost(), labyrinthHost(), chinaBeachHost(), dahliaHost(), tiledStepsHost(), karlHost(),
    sundialHost(), hydrantHost(), castroHost(), heronsHost(), trailHost(), altaHost(),
    ...batch2Hosts(),
    // W5-D6: 城市之声 (the listening and one 听一听 prompt per sound), BAYBAY's pebbles
    ...soundHosts(),
    pebblesHost(),
  ];
}

export function init(): () => void {
  const offs: (() => void)[] = [];
  const add = (off: () => void) => { offs.push(off); };
  add(registerRewardIds('egg', ALL_EGG_IDS));
  add(registerRewardIds('sound', SOUND_IDS));
  add(registerRewardIds('pebble', PEBBLE_IDS));
  // (the found memo reads the ledger by these ids: read it afresh now they are registered)
  forgetPaidEggs();
  add(registerEggSounds());
  add(registerOverlay({ id: 'egg-card', Component: FactCard }));
  add(registerOverlay({ id: 'egg-note', Component: NoteCard }));
  add(registerOverlay({ id: 'egg-operator', Component: OperatorBubble }));
  add(registerOverlay({ id: 'egg-listen', Component: ListenRing }));

  const root = new THREE.Group();
  root.name = 'ob-eggs';
  root.add(props.mesh, flock.group);
  add(registerEggWarmup(props, flock));
  add(registerSceneSystem('eggs', makeEggScene(root)));

  // the cards' chunk a little after start (the first find should not wait for it)
  const prefetch = setTimeout(() => { void importRetry(() => import('./FactCard')).catch(() => {}); }, 4000);
  add(() => clearTimeout(prefetch));

  const hosts = makeHosts();
  add(startHosts(hosts));
  // (review) Settings → reset progress clears the save without reloading the city: lane D forgets the old save too (the
  // eggs, sounds and pebbles found this session, the pebbles picked up, the 1776 marks, today's phone and cookies)
  add(onSaveCleared(() => { forgetEggMemory(); forgetHeard(); resetEggHosts(); }));
  // W5-D5: the compass (lane E) points at the nearest spot of an unfound egg that can happen today; BAYBAY's 听说… (lane C)
  add(registerHintSource('egg', () => eggHintSpots(isFound)));
  add(registerHintSource('pebble', pebbleHintSpots));
  add(registerRumourSource(ctx => eggRumour(ctx, isFound)));

  if (typeof window !== 'undefined' && (import.meta.env?.DEV || import.meta.env?.VITE_OPUS_QA === '1')) {
    // DEV / QA: __opusBay.d — play an egg's moment now (gates ignored), what is found / awake / drawn
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = {
      ...(w.__opusBay ?? {}),
      d: {
        qa: (id: string) => { const h = liveHosts().find(x => x.id === id); if (!h?.qa) return false; h.qa(); return true; },
        reveal: (id: string) => reveal(id),
        found: (id: string) => isFound(id),
        hosts: () => liveHosts().map(h => h.id),
        active: activeHosts,
        props: () => props.visibleKeys(),
        /** the pool's mesh as drawn now (QA: is it in the scene, where are its vertices) */
        pool: () => {
          const pos = props.mesh.geometry.getAttribute('position');
          return { visible: props.mesh.visible, inScene: !!props.mesh.parent, vertices: pos.count, sphere: props.mesh.geometry.boundingSphere, specs: props.visibleKeys().map(k => [k, props.get(k)]) };
        },
        flock: () => flock.active,
        // W5-D5: the rumour lane C would get here now, and the compass's list
        rumour: () => eggRumour({ x: runtime.player.x, z: runtime.player.z, zone: game.get().area, now: bayNow(), told: new Set() }, isFound),
        hints: () => eggHintSpots(isFound),
        // W5-D6: 城市之声 — heard?, collect one now (as its moment would)
        soundFound,
        heard,
        // W5-D6: BAYBAY's pebbles — how many, put one in the pouch now, show her next trick
        pebbles: pebbleCount,
        pick: pickPebble,
        trick: showNextTrick,
      },
    };
  }
  return () => {
    for (const off of offs.splice(0).reverse()) { try { off(); } catch { /* keep tearing down */ } }
    root.remove(props.mesh, flock.group);
  };
}
