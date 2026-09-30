import { restoreFleet } from '../actors/moveApi';
import { game } from '../core/store';
import { project } from '../core/geo';
import type { Vec2 } from '../core/types';
import { readSave, resumeSpot, takeResumeRequest } from '../data/save';
import { cityStreamerLazy } from '../world/cityLoader';
import { arrivalSpot, bumpTravelEpoch, placePlayer } from './fastTravel';
import { canStand } from '../core/terrain';
import { beginPlaying, noteInteractHandled, startGame } from './flow';
import type { AtSpec } from './qa';

/**
 * 继续上次的位置 and city spots from the URL (lane G1, G1-10 / G1-12).
 *
 * startOrResume(): the title's Start. With a pending resume request (W5-N6: the title's primary 继续旅程 whenever a
 * city spot is saved; data/save.ts requestResume) and a saved city spot, the arrival cinematic is skipped: the player
 * waits at the saved spot until the city is on screen there (streamer whenReady, ≤ 8 s — CS-14), is placed back on
 * that very spot (`resumePlace`: standable, else the arrival rule), the bike / car come back (moveApi.restoreFleet) and
 * play starts as a local ('local' start: BAYBAY's welcome back). Anything else is exactly the old startGame().
 *
 * goToCitySpot(): the same wait-and-place for `?at=` place / landmark / ll: / xz: targets in city mode.
 */

const READY_MAX_MS = 8000;

/** Wait for the running streamer (it starts a moment after the world mounts), then for the city around p. */
export async function cityReadyAt(p: Vec2, r = 150, maxMs = READY_MAX_MS): Promise<boolean> {
  const t0 = performance.now();
  while (!cityStreamerLazy()?.manifest && performance.now() - t0 < maxMs) await new Promise(res => setTimeout(res, 100));
  const s = cityStreamerLazy();
  if (!s) return false;
  const left = Math.max(500, maxMs - (performance.now() - t0));
  return Promise.race([s.whenReady(p, r).then(() => true), new Promise<boolean>(res => setTimeout(() => res(false), left))]);
}

export function startOrResume(): void {
  const want = takeResumeRequest();
  const s = game.get();
  const spot = want && s.worldMode === 'city' ? resumeSpot('city') : null;
  if (!spot || s.phase !== 'title') { startGame(); return; }
  noteInteractHandled();
  game.set({ phase: 'arrival' });
  void resumeAt(spot);
}

async function resumeAt(spot: { x: number; z: number; heading: number }) {
  bumpTravelEpoch();
  placePlayer(spot, spot.heading);
  await cityReadyAt(spot);
  placePlayer(resumePlace(spot), spot.heading);
  const fleet = readSave()?.vehicles;
  if (fleet) restoreFleet(fleet);
  // (W5-N6) BAYBAY's welcome back is the greeting (flow's local start; lane C's onWelcome 'returning'): no toast on top
  // (W6-K2: nor the discovery batch of the spot the player stood on last time)
  // (W7-P1: discovery is its own chunk, in since the Overlay's boot)
  await import('./discovery').then(m => { m.quietNextDiscovery(); }, () => { /* offline: no discovery */ });
  beginPlaying('local');
}

/**
 * W5-N6 · where a resume puts the player (the city is streamed there): the saved spot itself when it is standable (it
 * was when the sampler saved it: the player comes back exactly where they stood), else the arrival rule (an open area
 * within 30 u, then the nearest walkable spot). Pure over its terrain lookups (tests).
 */
export function resumePlace(spot: Vec2, stand: (x: number, z: number) => boolean = canStand, fallback: (p: Vec2) => Vec2 = arrivalSpot): Vec2 {
  return stand(spot.x, spot.z) ? { x: spot.x, z: spot.z } : fallback(spot);
}

/** Resolve a parsed ?at= target to a world spot in city mode (null: unknown). */
export async function resolveCityAt(spec: AtSpec): Promise<{ x: number; z: number; heading?: number } | null> {
  if (spec.kind === 'xz') return { x: spec.x, z: spec.z };
  if (spec.kind === 'll') return project(spec.lat, spec.lng);
  if (spec.kind !== 'id') return null;
  const lmId = spec.id.startsWith('lm-') ? spec.id.slice(3) : spec.id;
  const { sfLandmarkAnchor } = await import('../world/sf/landmarks/context');
  const lm = sfLandmarkAnchor(lmId);
  if (lm) return lm;
  const ix = await (await import('../data/sf/places')).loadPlaces(); // (W7-P1: the place index is a lazy chunk)
  const p = ix?.get(spec.id) ?? ix?.landmark(lmId);
  return p ? { ...p.arrival } : null;
}

/** ?at= in city mode: wait for the city there, then place the player on the arrival spot (and again when play starts). */
export async function goToCitySpot(spec: AtSpec): Promise<boolean> {
  const at = await resolveCityAt(spec);
  if (!at) return false;
  bumpTravelEpoch();
  placePlayer(at, at.heading);
  await cityReadyAt(at);
  const spot = arrivalSpot(at);
  placePlayer(spot, at.heading);
  // the start flow can re-place the player (arrival cinematic): once more when play begins
  if (game.get().phase !== 'playing') {
    const off = game.subscribe(() => {
      if (game.get().phase !== 'playing') return;
      off();
      setTimeout(() => placePlayer(spot, at.heading), 50);
    });
  }
  return true;
}
