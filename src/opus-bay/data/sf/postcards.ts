import type { PostcardDef } from '../../core/types';
import { POSTCARD_ART, SF_POSTCARD_ART_IDS, type SfPostcardArtId } from '../assets';
import { CITY_DATA } from './cityData';
import type { SfCard } from './postcardCards';
import { W4_POSTCARD_IDS, W4_POSTCARDS, type W4PostcardId } from './w4Postcards';

/**
 * The 16 whole-San-Francisco postcards (lane G2, plan G2-2; art shipped in data/assets SF_POSTCARD_ART_IDS; wave 4, W4-C9:
 * lane V's four for the new areas, data/sf/w4Postcards.ts W4_POSTCARDS, art in POSTCARD_ART_ALL_IDS). City mode shows
 * the district's 8 plus these 16 (data/postcards.ts `byMode`), 24 in all.
 *
 * - Every fact is one of lane D2's verified landmark facts (data/sf/landmarks.ts, checked 2026-09-26) about the card's
 *   subject or the landmark it stands beside; `sourceUrl` is that fact's source. No new claims (no web access in the
 *   cloud session to verify fresh ones).
 * - Spots are believable places near the subject (a hilltop, a lagoon path, a sidewalk corner, the alley itself), on
 *   standable ground in the main walking network and ≥ 6.5 u from any landmark card, so the two E prompts never
 *   compete (tests/opus-bay-sf-content.test.ts loads the published city to check).
 * - Hints (zh ≤ 45) say where to look without giving the spot away.
 */

export const SF_POSTCARDS_VERIFIED_AT = '2026-09-26';

// W5-V3 (lane V): the 12 cards' texts come with the city's data chunk (data/sf/postcardCards.ts; city mode and node
// only); district mode never reads the city tables below (data/postcards.ts `byMode`)
const CARDS = CITY_DATA?.SF_POSTCARD_CARDS;

/** Every city postcard id: the 12 of wave 3, then lane V's four (wave 4). */
export const CITY_POSTCARD_IDS = [...SF_POSTCARD_ART_IDS, ...W4_POSTCARD_IDS] as const;
export type CityPostcardId = SfPostcardArtId | W4PostcardId;

/** Lane V's four (W4-C9): verified on the web 2026-09-27 (data/sf/w4Postcards.ts), spots checked against the wave-4 sites. */
const W4_CARDS = Object.fromEntries(W4_POSTCARD_IDS.map(id => {
  const c = W4_POSTCARDS[id];
  return [id, { title: c.title, fact: c.fact, hint: c.hint, sourceUrl: c.sourceUrl, position: c.position, near: c.near }];
})) as Record<W4PostcardId, SfCard>;
const ALL: Record<CityPostcardId, SfCard> | null = CARDS ? { ...CARDS, ...W4_CARDS } : null;

/** The 16 city cards in the art order, as PostcardDefs (ids = the art ids). */
export const CITY_POSTCARDS: PostcardDef[] = !ALL ? [] : CITY_POSTCARD_IDS.map(id => {
  const card = ALL[id];
  return { id, title: card.title, fact: card.fact, hint: card.hint, sourceUrl: card.sourceUrl, position: { ...card.position }, image: POSTCARD_ART[id].small };
});

/** City card → the card it belongs to (the suffix of its POI id: a landmark id or a place card's). */
export const CITY_POSTCARD_NEAR: Record<string, string> = !ALL ? {} : Object.fromEntries(CITY_POSTCARD_IDS.map(id => [id, ALL[id].near]));
