import type { Bilingual } from '../../core/types';
import type { PlacesFile, SfPlace, SfPlaceKind } from '../../world/sf/format';
import { POIS } from '../pois';
import { importRetry } from '../../game/importRetry';

/**
 * San Francisco places for the map, discovery, search and fast travel (lane G1, plan §5.9 / G1-1).
 *
 * `public/opus-bay/sf/v1/places.json` (1,027 named places) is fetched once on idle after the far city (HC-5), then:
 * - hero places (inside the hand-made waterfront) that are the same thing as a district POI (≤ 25 u and a shared name
 *   word, or the same id) link to it (`poi`), so 详情 opens the POI's own card and nothing is listed twice;
 * - each of the 24 modelled SF landmarks (world/sf/landmarks) takes the place with one of its OSM ids, else the nearest
 *   curated place ≤ 40 u, else a synthetic place of its own; its arrival is the landmark's walkable anchor
 *   (`sfLandmarkAnchor`, landmarkToWorld of data/sf/landmarks `arrival`);
 * - `walkable` = the place is on the walking graph (graphNode ≥ 0) or in the hero (the 37 others are on islands or
 *   off the network: no 带我去 there);
 * - a 64 u bucket grid answers `placesNear`; `searchPlaces` matches zh and en.
 *
 * The pure builder (buildPlaceIndex) takes its inputs as arguments, so node tests run it on the published file; the
 * loader imports the landmark registry lazily (it is city-only code with its recipes).
 *
 * Wave 4 (lane P): the loader builds from data/sf/extraPlaces.ts `applyW4Places(file)` — the 47 attraction rows
 * (universities, Stonestown, churches …) and the islands' landing places, the name fixes (map name = card name), the
 * re-anchors, the wave-4 kinds (campus / shopping / zoo / religious) and each row's arrival (its attraction's), with the
 * duplicate curated Sutro Baths dot hidden. A row's own arrival wins over the landmark anchor.
 */

export interface CityPlace {
  id: string;
  name: Bilingual;
  kind: SfPlaceKind;
  x: number;
  z: number;
  y: number;
  /** DataSF neighbourhood id (far.zones) or null */
  zone: string | null;
  curated: boolean;
  hero: boolean;
  /** on the walking graph or in the hero: 带我去 is offered */
  walkable: boolean;
  /** SF landmark registry id when this place is one of the 24 modelled landmarks */
  landmark?: string;
  /** district POI id when a hero place is the same thing as a hand-made POI */
  poi?: string;
  /** where travel ends: the landmark's walkable anchor, else the place anchor (snapped to walkable ground at arrival) */
  arrival: { x: number; z: number; heading?: number };
  plannerId?: string;
  guideSlug?: string;
  sourceUrl: string;
  verifiedAt: string;
  /** made from the landmark registry (no places.json row matched) */
  synthetic?: boolean;
  /** a transit station (data/sf/stationPlaces.ts): the map draws it as a station, not as a place dot */
  station?: boolean;
}

export interface LandmarkInput {
  id: string;
  name: Bilingual;
  x: number;
  z: number;
  /** 'way/123', 'relation/4', 'node/5' */
  osm: readonly string[];
  anchor: { x: number; z: number; heading: number } | null;
  plannerId?: string;
  guideSlug?: string;
  sourceUrl: string;
  verifiedAt: string;
}

export interface PoiInput { id: string; name: Bilingual; x: number; z: number }

/** hero place ↔ district POI merge distance (u) */
export const POI_MERGE_R = 25;
/** landmark ↔ nearest curated place (u) when no OSM id matches */
export const LANDMARK_MATCH_R = 40;
const BUCKET = 64;

const STOP_WORDS = new Set(['the', 'and', 'of', 'at', 'san', 'francisco', 'sf']);
const words = (s: string) => s.toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter(w => w && !STOP_WORDS.has(w));
/** the POI's name (all its words, in order) is part of the place's name: "Levi's Plaza" ⊆ "Levi's Plaza", not "PIER 39 carousel" ⊆ "Pier 39" */
const poiNameIn = (poi: Bilingual, place: Bilingual) => { const a = words(poi.en).join(' '), b = ` ${words(place.en).join(' ')} `; return !!a && b.includes(` ${a} `); };

const bucketKey = (bx: number, bz: number) => (bx + 512) * 4096 + (bz + 512);

/** Search normalisation: lower case, no spaces / punctuation (zh keeps its characters). */
export const normalizeQuery = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[\s·.,'’()\-_/&]+/g, '');

export class PlaceIndex {
  readonly list: readonly CityPlace[];
  readonly byId = new Map<string, CityPlace>();
  private readonly byLandmarkId = new Map<string, CityPlace>();
  private readonly grid = new Map<number, CityPlace[]>();
  private readonly keys: { p: CityPlace; zh: string; en: string }[];

  constructor(list: CityPlace[]) {
    this.list = list;
    for (const p of list) {
      this.byId.set(p.id, p);
      if (p.landmark) this.byLandmarkId.set(p.landmark, p);
      const k = bucketKey(Math.floor(p.x / BUCKET), Math.floor(p.z / BUCKET));
      const cell = this.grid.get(k);
      if (cell) cell.push(p); else this.grid.set(k, [p]);
    }
    this.keys = list.map(p => ({ p, zh: normalizeQuery(p.name.zh), en: normalizeQuery(p.name.en) }));
  }

  get(id: string): CityPlace | undefined { return this.byId.get(id); }
  /** the place standing for SF landmark `id` */
  landmark(id: string): CityPlace | undefined { return this.byLandmarkId.get(id); }

  /** Places whose anchor is within r of (x, z), nearest first. */
  near(x: number, z: number, r: number): CityPlace[] {
    const out: { p: CityPlace; d: number }[] = [];
    const b0x = Math.floor((x - r) / BUCKET), b1x = Math.floor((x + r) / BUCKET);
    const b0z = Math.floor((z - r) / BUCKET), b1z = Math.floor((z + r) / BUCKET);
    for (let bx = b0x; bx <= b1x; bx++) {
      for (let bz = b0z; bz <= b1z; bz++) {
        for (const p of this.grid.get(bucketKey(bx, bz)) ?? []) {
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < r) out.push({ p, d });
        }
      }
    }
    return out.sort((a, b) => a.d - b.d).map(o => o.p);
  }

  /** zh / en search: prefix beats word start beats substring; landmarks and curated places first on ties. */
  search(query: string, limit = 20): CityPlace[] {
    const q = normalizeQuery(query);
    if (!q) return [];
    const raw = query.toLowerCase().trim();
    const scored: { p: CityPlace; s: number }[] = [];
    for (const { p, zh, en } of this.keys) {
      let s = Infinity;
      if (zh.startsWith(q) || en.startsWith(q)) s = 0;
      else if (p.name.en.toLowerCase().split(/[\s·/(-]+/).some(w => w.startsWith(raw))) s = 0.5;
      else if (zh.includes(q) || en.includes(q)) s = 1.5;
      if (s === Infinity) continue;
      s += p.landmark ? -0.8 : p.curated ? -0.6 : 0;
      scored.push({ p, s: s + Math.min(0.2, p.name.en.length / 400) });
    }
    return scored.sort((a, b) => a.s - b.s).slice(0, limit).map(o => o.p);
  }
}

/**
 * A places.json row, or a wave-4 row (data/sf/extraPlaces.ts `applyW4Places`): `arrival` = where travel ends when it is
 * not the anchor (the attraction's arrival, a re-anchor, an extra row's measured spot).
 */
export type PlaceRow = SfPlace & {
  arrival?: { x: number; z: number; heading?: number };
  /** overrides "on the walking graph or in the hero" (stations: on their street by construction) */
  walkable?: boolean;
  /** a transit station row (data/sf/stationPlaces.ts) */
  station?: boolean;
};

/**
 * The pure builder (see the header). Wave 4 (lane P, integration): a row's own `arrival` wins over the landmark anchor
 * (every landmark row carries its attraction's arrival: the anchor for 23 of them, the Golden Gate Welcome Center for
 * the bridge), else the landmark anchor, else the anchor.
 */
export function buildPlaceIndex(file: { places: readonly PlaceRow[] }, landmarks: readonly LandmarkInput[], pois: readonly PoiInput[] = []): PlaceIndex {
  const list: CityPlace[] = [];
  const osmOf = new Map<string, CityPlace[]>();
  const ownArrival = new Set<CityPlace>();
  for (const src of file.places) {
    if (!src?.id || !src.name || !Number.isFinite(src.x) || !Number.isFinite(src.z)) continue;
    const arr = src.arrival && Number.isFinite(src.arrival.x) && Number.isFinite(src.arrival.z) ? src.arrival : null;
    const p: CityPlace = {
      id: src.id, name: src.name, kind: src.kind, x: src.x, z: src.z, y: src.y ?? 0, zone: src.zone ?? null,
      curated: !!src.curated, hero: !!src.hero, walkable: src.walkable ?? (src.graphNode >= 0 || !!src.hero),
      arrival: arr ? { ...arr } : { x: src.x, z: src.z }, sourceUrl: src.sourceUrl, verifiedAt: src.verifiedAt,
      ...(src.plannerId ? { plannerId: src.plannerId } : {}), ...(src.guideSlug ? { guideSlug: src.guideSlug } : {}),
      ...(src.station ? { station: true } : {}),
    };
    if (arr) ownArrival.add(p);
    if (p.hero) {
      let best: PoiInput | undefined, bestD = Infinity;
      for (const poi of pois) {
        const d = Math.hypot(poi.x - p.x, poi.z - p.z);
        if (d > POI_MERGE_R) continue;
        if (poi.id === p.id) { best = poi; break; }
        if (d < bestD && poiNameIn(poi.name, p.name)) { best = poi; bestD = d; }
      }
      if (best) p.poi = best.id;
    }
    list.push(p);
    if (src.osmType && src.osmId != null) {
      const k = `${src.osmType}/${src.osmId}`;
      const arr = osmOf.get(k);
      if (arr) arr.push(p); else osmOf.set(k, [p]);
    }
  }
  const byId = new Map(list.map(p => [p.id, p]));
  for (const lm of landmarks) {
    const taken = (p: CityPlace) => !!p.landmark;
    // 1) one of the landmark's OSM ids (the curated row first), 2) the same id, 3) the nearest curated place ≤ 40 u
    let hit = lm.osm.flatMap(k => osmOf.get(k) ?? []).filter(p => !taken(p)).sort((a, b) => Number(b.curated) - Number(a.curated))[0];
    if (!hit) { const same = byId.get(lm.id); if (same && !taken(same)) hit = same; }
    if (!hit) {
      let bestD = LANDMARK_MATCH_R;
      for (const p of list) {
        if (!p.curated || taken(p)) continue;
        const d = Math.hypot(p.x - lm.x, p.z - lm.z);
        if (d <= bestD) { bestD = d; hit = p; }
      }
    }
    if (!hit) {
      hit = {
        id: byId.has(lm.id) ? `lm-${lm.id}` : lm.id, name: lm.name, kind: 'landmark', x: lm.x, z: lm.z, y: 0, zone: null,
        curated: true, hero: false, walkable: true, arrival: { x: lm.x, z: lm.z }, sourceUrl: lm.sourceUrl, verifiedAt: lm.verifiedAt,
        synthetic: true,
      };
      list.push(hit);
      byId.set(hit.id, hit);
    }
    hit.landmark = lm.id;
    if (lm.anchor) { if (!ownArrival.has(hit)) hit.arrival = { ...lm.anchor }; hit.walkable = true; }
    hit.plannerId ??= lm.plannerId;
    hit.guideSlug ??= lm.guideSlug;
  }
  return new PlaceIndex(list);
}

/** The district POIs as merge inputs. */
export const poiInputs = (): PoiInput[] => POIS.map(p => ({ id: p.id, name: p.name, x: p.position.x, z: p.position.z }));

// ---------------------------------------------------------------------------
// Runtime: load on idle, listeners
// ---------------------------------------------------------------------------

let INDEX: PlaceIndex | null = null;
let loading: Promise<PlaceIndex | null> | null = null;
const listeners = new Set<(ix: PlaceIndex) => void>();

export function placeIndex(): PlaceIndex | null { return INDEX; }
export function setPlaceIndex(ix: PlaceIndex | null) {
  INDEX = ix;
  if (ix) for (const fn of listeners) fn(ix);
}
/** Called once the places are in (at once when they already are). Returns the unsubscribe. */
export function onPlaces(fn: (ix: PlaceIndex) => void): () => void {
  listeners.add(fn);
  if (INDEX) fn(INDEX);
  return () => { listeners.delete(fn); };
}

export const placeById = (id: string) => INDEX?.get(id);
export const placesNear = (x: number, z: number, r: number) => INDEX?.near(x, z, r) ?? [];
export const searchPlaces = (q: string, limit?: number) => INDEX?.search(q, limit) ?? [];

/** The landmark registry as builder inputs (city-only code, imported on demand). */
async function landmarkInputs(): Promise<LandmarkInput[]> {
  const [{ SF_LANDMARKS }, { sfLandmarkAnchor }, { sfLandmarkInfo }] = await Promise.all([
    importRetry(() => import('../../world/sf/landmarks/index')), importRetry(() => import('../../world/sf/landmarks/context')), importRetry(() => import('./landmarks')),
  ]);
  return landmarkInputsFrom(SF_LANDMARKS, sfLandmarkInfo, sfLandmarkAnchor);
}

type LmInfo = { name: Bilingual; osm: string[]; plannerPlaceId?: string; guideSlug?: string; realInfo: { sourceUrl: string; verifiedAt: string } };
/**
 * Registry + info + anchors → builder inputs (shared with the tests). Only the modelled landmarks of waves 1–3 become
 * place-index landmarks: a wave-4 site record (lane L, `w4` metadata: Stonestown, SF State, the park sites …) is drawn
 * like a landmark, but its place row stays the attraction's row — the card, the arrival and the map badge come from
 * lane C's cards and lane P's attractions (a `landmark` row would ask for a G2 landmark card and hide lane C's).
 */
export function landmarkInputsFrom(
  registry: readonly { id: string; x: number; z: number; w4?: unknown }[], info: (id: string) => LmInfo | undefined,
  anchor: (id: string) => { x: number; z: number; heading: number } | null,
): LandmarkInput[] {
  const out: LandmarkInput[] = [];
  for (const l of registry) {
    if (l.w4) continue;
    const i = info(l.id);
    if (!i) continue;
    out.push({
      id: l.id, name: i.name, x: l.x, z: l.z, osm: i.osm, anchor: anchor(l.id), sourceUrl: i.realInfo.sourceUrl, verifiedAt: i.realInfo.verifiedAt,
      ...(i.plannerPlaceId ? { plannerId: i.plannerPlaceId } : {}), ...(i.guideSlug ? { guideSlug: i.guideSlug } : {}),
    });
  }
  return out;
}

/**
 * Fetch and build once (a failure can be retried by calling again). Wave 4: the published rows go through
 * data/sf/extraPlaces.ts `applyW4Places` (the 47 attraction rows, the islands' landing places, name fixes, re-anchors,
 * wave-4 kinds, arrivals, the hidden duplicate), imported on demand with the attraction list (not in GameRoot's graph).
 */
export function loadPlaces(root = '/opus-bay/sf'): Promise<PlaceIndex | null> {
  if (INDEX) return Promise.resolve(INDEX);
  loading ??= (async () => {
    try {
      const cur = (await (await fetch(`${root}/current.json`)).json()) as { version: string };
      const res = await fetch(`${root}/${cur.version}/places.json`);
      if (!res.ok) throw new Error(`places.json: HTTP ${res.status}`);
      const [file, lms, { applyW4Places }] = await Promise.all([res.json() as Promise<PlacesFile>, landmarkInputs(), importRetry(() => import('./extraPlaces'))]);
      const rows: PlaceRow[] = applyW4Places(file);
      // the stations join the index (search, discovery at 12 u, fly once discovered); the places never wait on them
      const stations = await importRetry(() => import('./stationPlaces')).then(m => m.loadStationRows(new Set(rows.map(r => r.id)), file.verifiedAt)).catch(() => [] as PlaceRow[]);
      const ix = buildPlaceIndex({ places: [...rows, ...stations] }, lms, poiInputs());
      setPlaceIndex(ix);
      return ix;
    } catch (error) {
      if (import.meta.env?.DEV) console.warn('[opus-bay places]', error);
      loading = null;
      return null;
    }
  })();
  return loading;
}

/** HC-5: load when the page is idle (the far city and first chunks go first). */
export function loadPlacesOnIdle(delayMs = 1500) {
  if (INDEX || loading || typeof window === 'undefined') return;
  const go = () => { void loadPlaces(); };
  const ric = (window as unknown as { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  window.setTimeout(() => (ric ? ric(go, { timeout: 4000 }) : go()), delayMs);
}
