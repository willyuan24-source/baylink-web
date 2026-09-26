// Building style families, roofs and palettes (plan §2.3, gta-visuals §3.2 pools in the Opus Bay palette).
import type { SfPalette, SfRoof, SfStyle } from '../../../src/opus-bay/world/sf/format';
import { hash01 } from './geom';

interface Pool { bodies: string[]; trims: string[]; roofs: string[] }

/** High chroma only for Victorian, Sunset and Mission; downtown stays neutral. */
const POOLS: Record<SfStyle, Pool> = {
  victorian: { bodies: ['#f2c9b1', '#cfe0d0', '#f4e2a8', '#c9d6e8', '#e8c6cf', '#d9c8e6', '#b9d3cf'], trims: ['#fbf6ec'], roofs: ['#d07a55', '#b8674a', '#8c9aa6', '#c47252'] },
  edwardian: { bodies: ['#efe4d0', '#e6d6bd', '#dfe3dc', '#e9d5c9'], trims: ['#fbf6ec'], roofs: ['#8c9aa6', '#9a8f86', '#b8674a'] },
  sunset: { bodies: ['#cfe6d8', '#f6d7c3', '#cfe0ee', '#f4e7b8', '#f1d0d6', '#efe7da'], trims: ['#f7f0e2'], roofs: ['#d07a55', '#c9714f', '#b8674a'] },
  marina: { bodies: ['#f3ead8', '#f1dcc8', '#e9e1d3'], trims: ['#fbf6ec'], roofs: ['#c46a4a'] },
  chinatown: { bodies: ['#ece2cf', '#e6d0b8'], trims: ['#b8463c', '#2f7d5a'], roofs: ['#a39a8c'] },
  brick: { bodies: ['#b56e55', '#a8644c', '#9b5b47', '#c08463'], trims: ['#dcc6a8'], roofs: ['#8f8578'] },
  deco: { bodies: ['#efe6d6', '#e6dccb', '#e9e2d4'], trims: ['#d9cdb8'], roofs: ['#b5ad9f'] },
  office: { bodies: ['#e8dcc4', '#d3dccb', '#ecc9b4', '#cdd5dc', '#e2cfae'], trims: ['#d9d4c7'], roofs: ['#b9b2a6'] },
  tower: { bodies: ['#d9d4c7', '#cdd5dc', '#e2dccf', '#c9d0d6'], trims: ['#f0ece4'], roofs: ['#a9a49b'] },
  industrial: { bodies: ['#d6ccb8', '#c9c2b2', '#b9b8ad', '#d8c7a8'], trims: ['#a99f8e'], roofs: ['#9aa3a4'] },
  civic: { bodies: ['#efe6d6', '#e8dcc4', '#e6d9c2'], trims: ['#fbf6ec'], roofs: ['#8c9aa6', '#b8674a'] },
  pier: { bodies: ['#e9e0cf'], trims: ['#7f9c8f'], roofs: ['#a7b3aa'] },
  residential: { bodies: ['#efe4d0', '#e6d6bd', '#f3e9d7', '#e1d9cc', '#ecdcc6', '#e0d3bf', '#f0e0cc'], trims: ['#fbf6ec'], roofs: ['#d07a55', '#8c9aa6', '#b5ad9f'] },
};
/** Mission / Bernal / Potrero add warm accents to the Victorian pool. */
const MISSION_EXTRA = ['#f0b15a', '#e57b5e'];

export const PALETTES: SfPalette[] = [];
const FAMILY_ENTRIES = new Map<SfStyle, number[]>();
const MISSION_ENTRIES: number[] = [];
for (const [family, p] of Object.entries(POOLS) as [SfStyle, Pool][]) {
  const ids: number[] = [];
  p.bodies.forEach((wall, i) => { ids.push(PALETTES.length); PALETTES.push({ family, wall, trim: p.trims[i % p.trims.length], roof: p.roofs[i % p.roofs.length] }); });
  FAMILY_ENTRIES.set(family, ids);
}
for (const [i, wall] of MISSION_EXTRA.entries()) { MISSION_ENTRIES.push(PALETTES.length); PALETTES.push({ family: 'victorian', wall, trim: '#fbf6ec', roof: POOLS.victorian.roofs[i] }); }

export function pickPalette(style: SfStyle, seed: number, warmZone: boolean): number {
  let ids = FAMILY_ENTRIES.get(style)!;
  if (style === 'victorian' && warmZone) ids = ids.concat(MISSION_ENTRIES);
  return ids[Math.floor(hash01(seed, 17) * ids.length) % ids.length];
}

// ---------------------------------------------------------------------------
// Neighbourhood families (DataSF nhood names)
// ---------------------------------------------------------------------------

const VICTORIAN_Z = new Set(['Western Addition', 'Haight Ashbury', 'Mission', 'Noe Valley', 'Castro/Upper Market', 'Hayes Valley', 'Japantown', 'Glen Park', 'Bernal Heights', 'Potrero Hill', 'Pacific Heights']);
const EDWARDIAN_Z = new Set(['Inner Richmond', 'Presidio Heights', 'Lone Mountain/USF', 'Inner Sunset', 'Excelsior', 'Portola', 'Outer Mission', 'Visitacion Valley', 'West of Twin Peaks', 'Twin Peaks', 'Treasure Island']);
const SUNSET_Z = new Set(['Sunset/Parkside', 'Outer Richmond', 'Oceanview/Merced/Ingleside', 'Lakeshore']);
const MARINA_Z = new Set(['Marina', 'Seacliff']);
const DECO_Z = new Set(['Nob Hill', 'Russian Hill', 'North Beach', 'Tenderloin']);
const BRICK_Z = new Set(['South of Market', 'Mission Bay', 'Bayview Hunters Point', 'Financial District/South Beach']);
const PARK_Z = new Set(['Golden Gate Park', 'Presidio', 'Lincoln Park', 'McLaren Park']);
/** downtown wedge: flat roofs everywhere */
const DOWNTOWN_Z = new Set(['Financial District/South Beach', 'South of Market', 'Chinatown', 'Tenderloin', 'Mission Bay']);
export const WARM_Z = new Set(['Mission', 'Bernal Heights', 'Potrero Hill']);

export type UseClass = 'house' | 'flat' | 'commercial' | 'civic';

export function styleFor(o: { zone: string | null; heightM: number; areaM2: number; use: UseClass; onPier: boolean; residentialTag: boolean }): SfStyle {
  const z = o.zone ?? '';
  if (o.onPier) return 'pier';
  if (o.heightM >= 60) return 'tower';
  if (o.use === 'civic') return 'civic';
  if (o.heightM >= 25) return o.residentialTag || DECO_Z.has(z) ? 'deco' : 'office';
  // big low boxes read as warehouses / sheds (most SF footprints are tagged plain building=yes)
  const bigBox = o.heightM < 25 && o.use !== 'flat' && !o.residentialTag;
  if (bigBox && (o.use === 'commercial' ? o.areaM2 > 1000 : o.areaM2 > 1500)) return BRICK_Z.has(z) ? 'brick' : 'industrial';
  if (bigBox && BRICK_Z.has(z) && z !== 'Financial District/South Beach' && o.areaM2 > 400) return 'brick';
  if (z === 'Chinatown') return 'chinatown';
  if (MARINA_Z.has(z)) return 'marina';
  if (DECO_Z.has(z)) return o.use === 'house' && o.heightM < 10 && o.areaM2 < 250 ? 'victorian' : 'deco';
  if (BRICK_Z.has(z)) return z === 'Financial District/South Beach' && o.heightM >= 15 ? 'office' : o.use === 'commercial' ? 'brick' : 'residential';
  if (PARK_Z.has(z)) return 'civic';
  if (VICTORIAN_Z.has(z)) return o.areaM2 < 250 && o.heightM >= 6 && o.heightM <= 12.5 ? 'victorian' : 'edwardian';
  if (EDWARDIAN_Z.has(z)) return o.use === 'flat' ? 'residential' : 'edwardian';
  if (SUNSET_Z.has(z)) return o.use === 'commercial' ? 'residential' : 'sunset';
  return 'residential';
}

export function roofFor(o: { style: SfStyle; heightM: number; use: UseClass; zone: string | null; roofTag: string; seed: number; church: boolean }): SfRoof {
  const t = o.roofTag;
  if (t === 'gabled' || t === 'saltbox' || t === 'gambrel') return 'gable';
  if (t === 'hipped' || t === 'pyramidal' || t === 'half-hipped' || t === 'side_hipped') return 'hip';
  if (t === 'flat' || t === 'skillion' || t === 'dome' || t === 'onion') return 'flat';
  if (o.church) return 'gable';
  if (o.heightM >= 15 || o.use === 'commercial' || DOWNTOWN_Z.has(o.zone ?? '')) return 'flat';
  const r = hash01(o.seed, 29);
  switch (o.style) {
    case 'victorian': return 'gable';
    case 'edwardian': return r < 0.65 ? 'gable' : 'hip';
    case 'sunset': return r < 0.5 ? 'gable' : r < 0.8 ? 'hip' : 'flat';
    case 'marina': return r < 0.7 ? 'hip' : 'flat';
    case 'residential': return r < 0.6 ? 'gable' : 'flat';
    case 'civic': return o.heightM < 10 ? (r < 0.5 ? 'gable' : 'hip') : 'flat';
    default: return 'flat';
  }
}
