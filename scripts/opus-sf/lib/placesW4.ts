// Wave 4 · the places.json delta as pure functions (lane P, W4-P3), used by scripts/opus-sf/places-sidecar.ts and the
// node tests. At the integration phase `poiKindW4` joins lib/places.ts `poiKind` (and SfPlaceKind absorbs the wave-4
// kinds); `stableMerge` stays: chunks reference places.json rows by INDEX (PlaceRefSet), so a rebuild must keep every
// published row at its index and only append.
import type { SfPlace, SfPlaceKindAll, SfPlaceKindW4 } from '../../../src/opus-bay/world/sf/format';

/** A places.json row that may carry a wave-4 kind. */
export type PlaceRowW4 = Omit<SfPlace, 'kind'> & { kind: SfPlaceKindAll };

/** The wave-4 OSM rules (plan §4.1): amenity=university|college → campus, shop=mall → shopping, tourism=zoo → zoo. */
export function poiKindW4(t: Readonly<Record<string, string>>): SfPlaceKindW4 | null {
  if (t.amenity === 'university' || t.amenity === 'college') return 'campus';
  if (t.shop === 'mall') return 'shopping';
  if (t.tourism === 'zoo') return 'zoo';
  return null;
}

const STOP = new Set(['the', 'of', 'and', 'at', 'san', 'francisco', 'sf', 'campus', 'main']);
/** Significant lower-case words of a name ("City College of San Francisco (CCSF) Ocean Campus" → city college ccsf ocean). */
export const nameWords = (s: string): string[] => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '')
  .split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w));

/** Every word of the shorter name (≥ 2 words) is in the longer one: the same institution / place. */
export function sameName(a: string, b: string): boolean {
  const wa = nameWords(a), wb = nameWords(b);
  const [s, l] = wa.length <= wb.length ? [wa, new Set(wb)] : [wb, new Set(wa)];
  return s.length >= 2 && s.every(w => l.has(w));
}

export interface ExtraRef { id: string; name: { en: string }; osm?: readonly string[] }

/**
 * The OSM features the wave-4 rules may ADD as new rows (reviewed 2026-09-27). OSM's campus / mall tags in SF are
 * partly stale (the San Francisco Art Institute closed in 2022, UCSF left Laurel Heights in 2023, University of
 * Phoenix closed its SF centre in 2012, Cogswell College left SF in 1985, CCSF's Southeast centre closed in 2023), so a
 * candidate is added only when it is listed here with the check that keeps it; every other candidate is reported
 * (places-diff.json `skipped`) for a later review. Kind upgrades of rows already in places.json need no review.
 */
export const W4_OSM_ADDS: Readonly<Record<string, string>> = {
  'way/301548804': 'Golden Gate University, 536 Mission St (operating: ggu.edu)',
  'way/35115837': 'California Institute of Integral Studies, 1453 Mission St (operating: ciis.edu)',
  'way/25759123': 'University of the Pacific Arthur A. Dugoni School of Dentistry, 155 Fifth St (operating: dental.pacific.edu)',
  'way/256029744': 'CCSF Downtown Center, 88 Fourth St (ccsf.edu locations, 2026)',
  'way/391084391': 'CCSF Mission Center, 1125 Valencia St (ccsf.edu locations, 2026)',
  'way/388134069': 'CCSF Evans Center, 1400 Evans Ave (ccsf.edu locations, 2026)',
  'way/392375234': 'CCSF Chinatown / North Beach Center, 808 Kearny St (ccsf.edu locations, 2026)',
};

/**
 * zh names of the reviewed additions (review fix): OSM has no Chinese name for them, and a row without one shows its long
 * English name in the zh UI ("City College of San Francisco (CCSF) Evans Center" in the 大学 search).
 */
export const W4_OSM_ZH: Readonly<Record<string, string>> = {
  'way/301548804': '金门大学',
  'way/35115837': '加州整合学院',
  'way/25759123': '太平洋大学杜戈尼牙医学院',
  'way/256029744': '旧金山城市学院 · 市中心校区',
  'way/391084391': '旧金山城市学院 · 教会区校区',
  'way/388134069': '旧金山城市学院 · Evans 校区',
  'way/392375234': '旧金山城市学院 · 华埠/北岸校区',
};

/**
 * Why an OSM candidate row is not added (null = add it): it is not on the reviewed list, it is an extra row's own OSM
 * feature, it names the same place as an extra row (runtime rows win: they carry the verified card), or an earlier
 * candidate has the same name.
 */
export function candidateSkip(
  c: { key: string; name: string }, extras: readonly ExtraRef[], kept: readonly { name: string }[], allow: Readonly<Record<string, string>> | null = W4_OSM_ADDS,
): string | null {
  if (allow && !allow[c.key]) return 'not on the reviewed list (W4_OSM_ADDS)';
  for (const e of extras) {
    if (e.osm?.includes(c.key)) return `is extra ${e.id}`;
    if (sameName(c.name, e.name.en)) return `same name as extra ${e.id}`;
  }
  const dup = kept.find(k => nameWords(k.name).join(' ') === nameWords(c.name).join(' '));
  return dup ? `same name as ${dup.name}` : null;
}

export interface MergeDiff {
  /** ids appended after the published rows */
  added: string[];
  /** published rows whose kind changed */
  kindChanges: { id: string; from: string; to: string }[];
  /** published rows the rebuild does not produce (kept verbatim) */
  lost: string[];
  /** rows the plain rebuild produces that are not published (not added: a full build decides those) */
  rebuildOnly: string[];
  /** published rows whose rebuilt geometry differs (the published values are kept) */
  drift: { id: string; field: string; published: unknown; rebuilt: unknown }[];
}

const GEOMETRY = ['x', 'z', 'y', 'zone', 'graphNode'] as const;

/**
 * Stable merge (pure): every published row stays at its index with its published geometry, source and flags; only
 * `kind` is taken from the rebuild (`kindOf`); `additions` are appended in the given order (ids must be new).
 */
export function stableMerge(
  published: readonly SfPlace[], rebuilt: readonly PlaceRowW4[], additions: readonly PlaceRowW4[],
  kindOf: (row: PlaceRowW4) => SfPlaceKindAll = r => r.kind,
): { places: PlaceRowW4[]; diff: MergeDiff } {
  const byId = new Map(rebuilt.map(r => [r.id, r]));
  const pubIds = new Set(published.map(p => p.id));
  const diff: MergeDiff = { added: [], kindChanges: [], lost: [], rebuildOnly: rebuilt.filter(r => !pubIds.has(r.id)).map(r => r.id), drift: [] };
  const places: PlaceRowW4[] = [];
  for (const p of published) {
    const r = byId.get(p.id);
    const row: PlaceRowW4 = { ...p };
    if (!r) { diff.lost.push(p.id); places.push(row); continue; }
    const kind = kindOf(r);
    if (kind !== p.kind) { diff.kindChanges.push({ id: p.id, from: p.kind, to: kind }); row.kind = kind; }
    for (const f of GEOMETRY) {
      const a = p[f], b = r[f];
      if (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) > 0.011 : a !== b) diff.drift.push({ id: p.id, field: f, published: a, rebuilt: b });
    }
    places.push(row);
  }
  for (const a of additions) {
    if (pubIds.has(a.id) || places.some(p => p.id === a.id)) throw new Error(`stableMerge: addition ${a.id} is not new`);
    places.push(a);
    diff.added.push(a.id);
  }
  return { places, diff };
}
