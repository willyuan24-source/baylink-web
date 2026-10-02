import type { Bilingual, PostcardDef } from '../core/types';
import type { PostcardText } from './postcardTexts';
import { byMode } from './contentMode';
import { anchorAt, SRC } from './pois';
import { CITY_POSTCARDS, CITY_POSTCARD_NEAR } from './sf/postcards';
import { cityPoiId } from './sf/cityPois';

/**
 * Eight illustrated postcards (virtual collectibles — a game item, not a real souvenir).
 * Ids match the illustrations at /opus-bay/postcards/<id>-600.webp and <id>-1200.webp (assets agent).
 * Positions come from anchors `postcard-<id>` (DESIGN.md §11). Each fact is verified at `sourceUrl`.
 */

export const POSTCARD_IDS = [
  'ferry-building-dawn', 'pier7-sunset', 'exploratorium', 'filbert-steps', 'coit-tower', 'bay-bridge-night', 'sea-lions', 'streetcar',
] as const;
export type PostcardId = (typeof POSTCARD_IDS)[number];

export const postcardImage = (id: string, size: 600 | 1200 = 600) => `/opus-bay/postcards/${id}-${size}.webp`;

/**
 * W8-P4 (lane P): a card's words (title, fact, hint) live in data/postcardTexts.ts and come with the play layer
 * (data/scriptLoad.ts): each card starts with empty words that `fillPostcardTexts` fills in place — the same objects, so
 * an interactable built before Start (its name is the card's title object) reads them too. Node fills them at load.
 */
const words = (): Bilingual => ({ zh: '', en: '' });
const card = (id: PostcardId, sourceUrl: string): PostcardDef => ({
  id,
  position: anchorAt(`postcard-${id}`),
  image: postcardImage(id),
  title: words(),
  fact: words(),
  hint: words(),
  sourceUrl,
});

export const DISTRICT_POSTCARDS: PostcardDef[] = [
  card('ferry-building-dawn', SRC.ferryAbout),
  card('pier7-sunset', SRC.cdfwPiers),
  card('exploratorium', SRC.exploratoriumHistory),
  card('filbert-steps', SRC.coitTower),
  card('coit-tower', SRC.coitTower),
  card('bay-bridge-night', SRC.mtcBayBridge),
  card('sea-lions', SRC.pier39SeaLions),
  card('streetcar', SRC.sfmtaHistoric),
];

/**
 * The active world's postcards (plan G2-0 / G2-2): the district's 8 in district mode (v1, unchanged); in city mode the
 * district's 8 plus the 12 whole-SF cards (data/sf/postcards.ts), 20 in all.
 */
export const POSTCARDS: PostcardDef[] = byMode(DISTRICT_POSTCARDS, [...DISTRICT_POSTCARDS, ...CITY_POSTCARDS]);

/**
 * Which postcard illustrates a place card that has no licensed photo (moved here from ui/format.ts, plan G2-2). The card
 * shows the art once that postcard is collected. City mode adds each SF landmark card → its city postcard.
 */
export const DISTRICT_POSTCARD_FOR_POI: Record<string, string> = {
  'ferry-building': 'ferry-building-dawn',
  'farmers-market': 'ferry-building-dawn',
  'weekly-board': 'ferry-building-dawn',
  pier14: 'bay-bridge-night',
  pier7: 'pier7-sunset',
  exploratorium: 'exploratorium',
  'filbert-steps': 'filbert-steps',
  'levis-plaza': 'filbert-steps',
  'coit-tower': 'coit-tower',
  'coit-murals': 'coit-tower',
  'sea-lions': 'sea-lions',
  'pier39-carousel': 'sea-lions',
  'streetcar-ferry': 'streetcar',
  'streetcar-green': 'streetcar',
  'streetcar-pier39': 'streetcar',
};
/** SF landmark card (`sf:<landmarkId>`) → the city postcard that stands beside it (the last one wins for shared landmarks). */
export const CITY_POSTCARD_FOR_POI: Record<string, string> = Object.fromEntries(Object.entries(CITY_POSTCARD_NEAR).map(([card, landmark]) => [cityPoiId(landmark), card]));
export const POSTCARD_FOR_POI: Record<string, string> = byMode(DISTRICT_POSTCARD_FOR_POI, { ...DISTRICT_POSTCARD_FOR_POI, ...CITY_POSTCARD_FOR_POI });

/** Postcard facts are verified on this date (see data/pois.ts VERIFIED_AT). */
export { VERIFIED_AT as POSTCARDS_VERIFIED_AT } from './pois';

/**
 * Day-0 counting hooks (G2-3): a save may hold postcard ids of both world modes, so every "n / total" and the
 * all-found check count only the cards of the active set (POSTCARDS, which G2 resolves by world mode).
 */
export function activePostcardCount(collected: readonly string[]): number {
  let n = 0;
  for (const id of collected) if (POSTCARDS.some(card => card.id === id)) n++;
  return n;
}
/** Size of the active postcard set. */
export const activePostcardTotal = (): number => POSTCARDS.length;
/** Every active postcard collected (false while the set is empty). */
export function allPostcardsFound(collected: readonly string[]): boolean {
  return POSTCARDS.length > 0 && activePostcardCount(collected) >= POSTCARDS.length;
}

let textsFilled = false;
/** W8-P4: fill the district cards' words in place (data/postcardTexts.ts); once per page (the play layer / node). */
export function fillPostcardTexts(texts: Readonly<Record<string, PostcardText>>): void {
  if (textsFilled) return;
  textsFilled = true;
  for (const c of DISTRICT_POSTCARDS) {
    const t = texts[c.id];
    if (!t) continue;
    Object.assign(c.title, t.title);
    Object.assign(c.fact, t.fact);
    if (c.hint) Object.assign(c.hint, t.hint);
  }
}
/** Whether the cards' words are in (tests / QA). */
export const postcardTextsFilled = () => textsFilled;

// W8-P4: node (tests, scripts: no Vite build, no import.meta.env) reads the cards' words at once
if ((import.meta.env as object | undefined) === undefined) fillPostcardTexts((await import('./postcardTexts')).DISTRICT_POSTCARD_TEXTS);
