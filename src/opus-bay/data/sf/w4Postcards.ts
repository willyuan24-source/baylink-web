import type { Bilingual, PostcardDef, Vec2 } from '../../core/types';

/**
 * Four wave-4 postcards (lane V + lane C, W4-C9 / plan §6 H-7) for the new areas: the SF State Quad, the Music
 * Concourse, the Lands End cliff trail with the Golden Gate, and the M coming out of the Twin Peaks Tunnel at West
 * Portal. With them the city shows 24 postcards (the district's 8 + 12 + 4).
 *
 * - Art: nano_banana_pro 4:3 2k with the references and prompt recipe of the 12 shipped SF postcards (ASSETS-LEDGER
 *   T1-1…13), centre-cropped to 4:3 and saved as 1200 + 600 WebP q82 (scripts/opus-sf/assets/w4/postcards.py);
 *   prompts in scripts/opus-sf/assets/w4/prompts.py, jobs in docs/opus-bay/ledger/w4-V.md. No text, signs or logos
 *   (checked at full size; the West Portal draw had a logo-like mark and a lit display on the train: painted out).
 * - Facts: re-checked on the web on 2026-09-27 (`sourceUrl`); none repeats its place card's bark or summary.
 * - Spots: standable, a walking-graph node within 12 u reachable from ferry-gate, ≥ 6.5 u from every card spot (the
 *   24 landmark cards, lane C's place cards, lane P's attraction points and arrivals) and > 20 u from every other
 *   postcard, measured with the wave-4 sites registered (tests/opus-bay-w4-postcards.test.ts).
 * - `near`: the landmark / wave-4 site whose card shows the art once found (the Music Concourse has no card of its
 *   own: the de Young's, 14 u away, shows it); `attraction`: lane P's attraction id. West Portal has no site yet
 *   (lane L's P3 `west-portal`): its `near` is that id, and lane C's `west-portal` place card shows the art.
 *
 * Not registered yet (early phase). Integration: data/assets.ts `SF_POSTCARD_ART_IDS` gains `W4_POSTCARD_IDS` (lane V),
 * data/sf/postcards.ts `CARDS` gains `W4_POSTCARDS` (lane C). Dependency-free at runtime.
 */

export const W4_POSTCARDS_VERIFIED_AT = '2026-09-27';

export const W4_POSTCARD_IDS = ['sf-state-quad', 'sf-music-concourse', 'sf-lands-end', 'sf-west-portal'] as const;
export type W4PostcardId = (typeof W4_POSTCARD_IDS)[number];

export interface W4Postcard {
  title: Bilingual;
  fact: Bilingual;
  /** where to look, zh ≤ 45 (bubble width: CJK 1, ASCII 0.5, spaces 0) */
  hint: Bilingual;
  sourceUrl: string;
  position: Vec2;
  near: string;
  attraction: string;
}

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

export const W4_POSTCARDS: Readonly<Record<W4PostcardId, W4Postcard>> = {
  'sf-state-quad': {
    title: bi('州立大学的草坪', 'The Quad at SF State'),
    fact: bi('州立大学 1899 年诞生时叫“旧金山州立师范学校”，专门培养老师。', 'SF State began in 1899 as the San Francisco State Normal School, a college for training teachers.'),
    hint: bi('州立大学的中央草坪上，学生们常在这儿晒太阳。', 'On the Quad at SF State, where students sit in the sun.'),
    sourceUrl: 'https://en.wikipedia.org/wiki/San_Francisco_State_University',
    position: { x: 226.5, z: 1550.6 }, near: 'sfsu', attraction: 'sf-state-university',
  },
  'sf-music-concourse': {
    title: bi('音乐广场的午后', 'An Afternoon at the Music Concourse'),
    fact: bi('广场尽头的音乐台是糖业大亨 Claus Spreckels 送给加州人民的礼物，1900 年落成。', 'The bandshell at its end was sugar magnate Claus Spreckels’s gift to the people of California, dedicated in 1900.'),
    hint: bi('金门公园里，迪扬博物馆和科学院中间的下沉广场。', 'In Golden Gate Park, the sunken plaza between the de Young and the Academy.'),
    sourceUrl: 'https://en.wikipedia.org/wiki/Spreckels_Temple_of_Music',
    position: { x: -228.5, z: 927 }, near: 'de-young-tower', attraction: 'de-young-tower',
  },
  'sf-lands-end': {
    title: bi('天涯海角望金门', 'The Golden Gate from Lands End'),
    fact: bi('这条海边步道差不多就是当年观光火车走的老路，1925 年冬天的山崩冲断了铁轨。', 'The cliff trail follows the route of an old scenic railway, given up after landslides in the winter of 1925.'),
    hint: bi('天涯海角的海边步道上，找一处能望见金门大桥的地方。', 'On the Lands End cliff trail, where the Golden Gate Bridge comes into view.'),
    sourceUrl: 'https://www.sfmta.com/blog/line-lands-end-san-franciscos-lost-scenic-railway',
    position: { x: -721, z: 1180 }, near: 'lands-end', attraction: 'lands-end',
  },
  'sf-west-portal': {
    title: bi('钻出隧道的轻轨', 'Out of the Twin Peaks Tunnel'),
    fact: bi('西门这个街区，名字就来自双峰隧道的西口；这条隧道 1918 年通车，长约 3.6 公里。', 'West Portal is named for the Twin Peaks Tunnel’s west mouth; the tunnel opened in 1918 and runs about 3.6 km.'),
    hint: bi('坐 M 线钻出双峰隧道，在 West Portal 大道边上找找。', 'Ride the M out of the Twin Peaks Tunnel and look along West Portal Avenue.'),
    sourceUrl: 'https://en.wikipedia.org/wiki/Twin_Peaks_Tunnel',
    position: { x: 125, z: 1259 }, near: 'west-portal', attraction: 'west-portal',
  },
};

/** The art files: `large` 1200 × 900 (hi-dpi), `small` 600 × 450 (the journal and cards), as data/assets POSTCARD_ART. */
export const W4_POSTCARD_ART: Readonly<Record<W4PostcardId, { large: string; small: string }>> = Object.fromEntries(
  W4_POSTCARD_IDS.map(id => [id, { large: `/opus-bay/postcards/${id}-1200.webp`, small: `/opus-bay/postcards/${id}-600.webp` }]),
) as Record<W4PostcardId, { large: string; small: string }>;

/** The four as PostcardDefs (ids = the art ids, `image` = the small art), in W4_POSTCARD_IDS order. */
export function w4PostcardDefs(): PostcardDef[] {
  return W4_POSTCARD_IDS.map(id => {
    const c = W4_POSTCARDS[id];
    return { id, title: c.title, fact: c.fact, hint: c.hint, sourceUrl: c.sourceUrl, position: { ...c.position }, image: W4_POSTCARD_ART[id].small };
  });
}

/** Every art file (for data/assets `listAssetUrls()` at integration). */
export const w4PostcardUrls = (): string[] => W4_POSTCARD_IDS.flatMap(id => [W4_POSTCARD_ART[id].large, W4_POSTCARD_ART[id].small]);
