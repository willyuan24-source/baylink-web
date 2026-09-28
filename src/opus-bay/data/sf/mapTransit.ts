import type { TransitLine } from '../../world/sf/format';

/**
 * Wave 4 · lane T's three lines (the sightseeing loop, N Judah, M Ocean View) for the city map and the station places
 * (lane P, integration). Lane T publishes them into transit.json (its integration step 1; in the early phase they are
 * in transit-w4.json, with the placed stop props): this reads them from the published file itself — the browser has it
 * cached, loadTransit fetched the same URL — so the map and the place index do not wait on lane T's runtime registry and
 * work with either file. No React, no world code: data/sf/places.ts loads it lazily with the place index.
 */

export interface MapW4 {
  lines: readonly TransitLine[];
  /** where each loop / Metro stop's pole or kiosk stands (the file's `props`), by stop id */
  props: Readonly<Record<string, readonly [number, number]>>;
}

const EMPTY: MapW4 = { lines: [], props: {} };
let W4: MapW4 | null = null;
let loading: Promise<MapW4> | null = null;

type FileLike = { lines?: readonly { kind: string }[]; props?: Record<string, readonly [number, number]> } | null;

/** The wave-4 part of a transit file (its bus / light-rail lines and props). */
export function w4Of(file: FileLike): MapW4 {
  if (!file?.lines) return EMPTY;
  return { lines: file.lines.filter(l => l.kind === 'bus' || l.kind === 'light-rail') as unknown as TransitLine[], props: file.props ?? {} };
}

/** Fetch once: transit.json's wave-4 lines, else transit-w4.json's; the empty set on failure (retried on the next call). */
export function loadMapW4(root = '/opus-bay/sf'): Promise<MapW4> {
  if (W4) return Promise.resolve(W4);
  loading ??= (async () => {
    try {
      const cur = (await (await fetch(`${root}/current.json`)).json()) as { version: string };
      const base = `${root}/${cur.version}`;
      const manifest = (await (await fetch(`${base}/manifest.json`)).json()) as { transit?: string };
      const main = await fetch(`${base}/${manifest.transit ?? 'transit.json'}`);
      let w4 = main.ok ? w4Of((await main.json()) as FileLike) : EMPTY;
      if (!w4.lines.length) {
        const early = await fetch(`${base}/transit-w4.json`);
        if (early.ok) w4 = w4Of((await early.json()) as FileLike);
      }
      W4 = w4;
      return w4;
    } catch (error) {
      if (import.meta.env?.DEV) console.warn('[opus-bay map lines]', error);
      loading = null;
      return EMPTY;
    }
  })();
  return loading;
}

/** The loaded wave-4 lines (null until loadMapW4 resolves). */
export const mapW4 = (): MapW4 | null => W4;
/** Tests / QA: install (or clear) the wave-4 lines directly. */
export function setMapW4(w: MapW4 | null) { W4 = w; loading = null; }
