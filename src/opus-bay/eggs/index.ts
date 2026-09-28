import { lazy } from 'react';
import * as THREE from 'three';
import { registerHintSource } from '../economy/hints';
import { registerRewardIds } from '../economy/ledger';
import { registerSceneSystem } from '../game/systemsRegistry';
import { registerOverlay } from '../ui/slots';
import { cookiesHost } from './cookies';
import { nortonHost, phoneHost } from './downtown';
import { activeHosts, type EggHost, flock, isFound, liveHosts, props, reveal, startHosts } from './hosts';
import { crissyHost, foghornHost, octagonHost, otterHost, waveOrganHost } from './marina';
import { parrotsHost } from './north';
import { registerEggWarmup } from './props';
import { EGG_IDS, eggById } from './registry';
import { makeEggScene } from './scene';
import { registerEggSounds } from './sounds';
import { alcatrazHost, laughingLadyHost, seaLionsHost } from './wharf';

/**
 * Wave 5 · lane D — the 24 real San Francisco easter eggs (小发现), their hosts, fact cards and rumours.
 *
 * game/w5Features.ts loads this module lazily in city mode only and calls `init()` once (after the economy, so lane E's
 * ledger already listens for our `reward`s). `init()` starts everything and returns the function that undoes it. Every
 * other module of this folder stays behind this one (no static import of it from a module GameRoot loads).
 *
 * What init wires:
 *   the egg id list with the ledger (registerRewardIds('egg', EGG_IDS): bit i of play.g.egg) and the compass
 *   (registerHintSource('egg', …): the unfound eggs that have a host)
 *   the sounds (audio/hooks), the overlays (ui/slots: egg-card, egg-note, egg-operator)
 *   the prop pool and the flock (one scene system, warmed), the hosts (one frame system, the prompts)
 *
 * The public API for other lanes (import from your own lazy chunk): eggs/registry.ts (ids, riddles, rumours, spots).
 */

// the cards load with their stylesheet on first show (the overlay render point wraps them in Suspense): the init chunk stays
// small and loads in node too (the contracts test starts every feature)
const FactCard = lazy(() => import('./FactCard').then(m => ({ default: m.FactCard })));
const NoteCard = lazy(() => import('./FactCard').then(m => ({ default: m.NoteCard })));
const OperatorBubble = lazy(() => import('./FactCard').then(m => ({ default: m.OperatorBubble })));

/** The hosts built so far (W5-D3: eggs 1–12). */
export function makeHosts(): EggHost[] {
  return [
    parrotsHost(), seaLionsHost(), laughingLadyHost(), phoneHost(), cookiesHost(), nortonHost(),
    waveOrganHost(), crissyHost(), otterHost(), octagonHost(), alcatrazHost(), foghornHost(),
  ];
}

export function init(): () => void {
  const offs: (() => void)[] = [];
  const add = (off: () => void) => { offs.push(off); };
  add(registerRewardIds('egg', EGG_IDS));
  add(registerEggSounds());
  add(registerOverlay({ id: 'egg-card', Component: FactCard }));
  add(registerOverlay({ id: 'egg-note', Component: NoteCard }));
  add(registerOverlay({ id: 'egg-operator', Component: OperatorBubble }));

  const root = new THREE.Group();
  root.name = 'ob-eggs';
  root.add(props.mesh, flock.group);
  add(registerEggWarmup(props, flock));
  add(registerSceneSystem('eggs', makeEggScene(root)));

  // the cards' chunk a little after start (the first find should not wait for it)
  const prefetch = setTimeout(() => { void import('./FactCard').catch(() => {}); }, 4000);
  add(() => clearTimeout(prefetch));

  const hosts = makeHosts();
  add(startHosts(hosts));
  add(registerHintSource('egg', () => hosts.filter(h => !isFound(h.id)).map(h => ({ id: h.id, ...eggById(h.id)!.at }))));

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
        flock: () => flock.active,
      },
    };
  }
  return () => {
    for (const off of offs.splice(0).reverse()) { try { off(); } catch { /* keep tearing down */ } }
    root.remove(props.mesh, flock.group);
  };
}
