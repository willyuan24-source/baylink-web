import type { Bilingual } from '../core/types';

/**
 * Wave 6 · lane G (W6-G2) · the trick-or-treat streets: real San Francisco blocks known for trick-or-treating, where
 * the decorated doors stand (halloween/treatDoors.ts, placed by scripts/opus-sf/halloween-doors.mts). Pure data.
 *
 * Sources (checked 2026-09-29):
 *   REALTOR  https://www.rebeccarealtor.com/blog/best-neighborhoods-for-trick-or-treating-in-san-francisco-2025/ — the
 *            blocks and 2025's street closures: Belvedere St 17th → Parnassus (4–10 pm), Chenery St Elk → Diamond
 *            (4–9:30 pm), Fair Oaks St 21st → 26th (5–8:30 pm), Jordan Ave Geary → California (4–10 pm), Hearst Ave Edna →
 *            Congo (4–8 pm), Sea Cliff Ave and El Camino del Mar (no closure, a popular destination)
 *   MOMMY    https://mommypoppins.com/san-francisco-bay-area-kids/best-places-to-trick-or-treat-on-halloween-in-san-francisco
 *            — Belvedere St "One of the most well-known Halloween party spots"; Sea Cliff "Attracting several hundred
 *            trick-or-treaters each year"
 */
export const TREAT_SOURCES = {
  realtor: { url: 'https://www.rebeccarealtor.com/blog/best-neighborhoods-for-trick-or-treating-in-san-francisco-2025/', verifiedAt: '2026-09-29' },
  mommy: { url: 'https://mommypoppins.com/san-francisco-bay-area-kids/best-places-to-trick-or-treat-on-halloween-in-san-francisco', verifiedAt: '2026-09-29' },
} as const;

export type TreatStreetId = 'belvedere' | 'chenery' | 'fair-oaks' | 'jordan' | 'sea-cliff' | 'hearst';

export interface TreatStreet {
  id: TreatStreetId;
  /** the street's name in the published city (OSM) */
  osm: string;
  /** the block's cross streets (OSM names), when the source names them */
  from?: string;
  to?: string;
  name: Bilingual;
  /** the neighbourhood */
  area: Bilingual;
  /** BAYBAY's line the first time near it (halloween/lines.ts id) */
  line: string;
  source: keyof typeof TREAT_SOURCES;
}

export const TREAT_STREETS: readonly TreatStreet[] = [
  { id: 'belvedere', osm: 'Belvedere Street', from: '17th Street', to: 'Parnassus Avenue', name: { zh: '贝尔维德街', en: 'Belvedere St' }, area: { zh: '科尔谷', en: 'Cole Valley' }, line: 'w6g-street-belvedere', source: 'realtor' },
  { id: 'chenery', osm: 'Chenery Street', from: 'Elk Street', to: 'Diamond Street', name: { zh: 'Chenery 街', en: 'Chenery St' }, area: { zh: '格伦公园', en: 'Glen Park' }, line: 'w6g-street-chenery', source: 'realtor' },
  { id: 'fair-oaks', osm: 'Fair Oaks Street', from: '21st Street', to: '26th Street', name: { zh: 'Fair Oaks 街', en: 'Fair Oaks St' }, area: { zh: '诺伊谷', en: 'Noe Valley' }, line: 'w6g-street-fair-oaks', source: 'realtor' },
  { id: 'jordan', osm: 'Jordan Avenue', from: 'Geary Boulevard', to: 'California Street', name: { zh: 'Jordan 大道', en: 'Jordan Ave' }, area: { zh: '乔丹公园', en: 'Jordan Park' }, line: 'w6g-street-jordan', source: 'realtor' },
  { id: 'sea-cliff', osm: 'Sea Cliff Avenue', name: { zh: '海崖大道', en: 'Sea Cliff Ave' }, area: { zh: '海崖区', en: 'Sea Cliff' }, line: 'w6g-street-sea-cliff', source: 'mommy' },
  { id: 'hearst', osm: 'Hearst Avenue', from: 'Edna Street', to: 'Congo Street', name: { zh: 'Hearst 大道', en: 'Hearst Ave' }, area: { zh: '阳光谷', en: 'Sunnyside' }, line: 'w6g-street-hearst', source: 'realtor' },
];

/** doors per street (6 × 10 = the 60 `door:n` ids of halloween/rewards.ts) */
export const DOORS_PER_STREET = 10;
/** where the player knocks: this far out from the wall (u) */
export const KNOCK_OUT = 0.9;
