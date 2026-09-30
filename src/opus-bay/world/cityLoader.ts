import type * as CityMode from './sf/cityMode';
import { importRetry } from '../game/importRetry';

/**
 * The city chunk (lane C2, HC-1 / HC-2): everything only city mode runs (the streamer, its pools and workers, sites,
 * city water, sfTerrain, the hero stand-ins, the ?debug breakdown) lives behind `world/sf/cityMode.ts`, which only
 * this module imports, dynamically. District mode never fetches it; in city mode GameRoot starts the fetch as soon
 * as its own chunk runs and WorldScene suspends until it is in (World's constructor needs CityWater).
 *
 * Main-graph code must not import `world/sf/stream` (or any other city module) statically, or the city code moves
 * back into GameRoot: read the running streamer with `cityStreamerLazy()` instead (tests/opus-bay-sf-bundle.test.ts).
 */
export type CityModule = typeof CityMode;

let mod: CityModule | null = null;
let loading: Promise<CityModule> | null = null;
let failed: Error | null = null;

/** Fetch the city chunk once (a failed fetch can be retried by calling again). */
export function loadCity(): Promise<CityModule> {
  loading ??= importRetry(() => import('./sf/cityMode')).then(
    m => { mod = m; failed = null; return m; },
    (e: unknown) => { loading = null; failed = e instanceof Error ? e : new Error(String(e)); throw failed; },
  );
  return loading;
}

/** The city module once loaded, else null (district mode, or still fetching). */
export function cityModule(): CityModule | null { return mod; }

/** For a render that needs the city module: throws the load promise (Suspense) or the load error (error boundary). */
export function suspendForCity(): CityModule {
  if (mod) return mod;
  if (failed) { const e = failed; failed = null; throw e; }
  throw loadCity();
}

/** The running city streamer without importing the city chunk (null in district mode or before enableCity). */
export function cityStreamerLazy(): ReturnType<CityModule['cityStreamer']> {
  return mod ? mod.cityStreamer() : null;
}
