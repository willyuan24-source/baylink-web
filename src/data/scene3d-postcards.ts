import type { GuideImage } from './guide-media';
import { ladderSrcSet, readExtraLadder } from './image-ladder';

/**
 * 3D-world postcards for San Francisco places (plan D7 tier 4, RC-16). They are the Opus Bay postcards — miniature
 * diorama illustrations of BAYLINK's own 3D San Francisco, generated on Higgsfield (Nano Banana Pro) and picked by hand
 * (src/opus-bay/ASSETS-LEDGER.md, public/opus-bay/README.md) — copied byte for byte into public/guides/3d/ by
 * `npm run images:variants`, which adds the 480/800 rungs there. public/opus-bay/** is never written.
 *
 * Not part of GUIDE_IMAGES, so no page ships them until a W2 surface asks: getCover() reads them through a lookup such
 * as `key => GUIDE_IMAGES[key] ?? SCENE3D_POSTCARD_IMAGES[key]` with `postcardKey`, and only for SF places. The label is
 * always 3D 场景插图 (getImageProvenance, `scene3d`); captions also say plainly that the picture is AI-generated art.
 */
export type Scene3dPostcard = GuideImage & {
  key: string;
  scene3d: true;
  /** The reference file in public/opus-bay/postcards/ the copy is made from. */
  source: string;
  /** What the postcard shows, for card copy. */
  subject: { zh: string; en: string };
  /** Existing ids the postcard can stand in for: attraction ids (src/data/attractions.ts), monthly place ids, guide slugs. */
  places: readonly string[];
  /** English alt, caption and credit (records outside the editorial dictionaries carry their own). */
  en: { alt: string; caption: string; credit: string };
};

const credit = 'BAYLINK 3D 旧金山场景插图 · AI 生成（Higgsfield Nano Banana Pro），人工挑选';
const creditEn = 'BAYLINK 3D San Francisco scene illustration · AI-generated (Higgsfield Nano Banana Pro), hand-picked';
const caption = (place: string) => `BAYLINK 3D 旧金山里的${place}，黏土微缩风格的 AI 生成插图；不是实景照片，不代表现场天气、开放情况或活动安排。`;
const captionEn = (place: string) => `${place} in BAYLINK's 3D San Francisco: an AI-generated clay-miniature illustration, not a photograph; it does not show current weather, opening hours or events.`;

const postcard = (id: string, subject: Scene3dPostcard['subject'], places: readonly string[], alt: string, altEn: string): Scene3dPostcard => ({
  key: `scene3d-${id}`,
  src: `/guides/3d/${id}.webp`,
  source: `/opus-bay/postcards/${id}-1200.webp`,
  width: 1200,
  height: 900,
  kind: 'illustration',
  scene3d: true,
  alt,
  caption: caption(subject.zh),
  credit,
  coverOk: true,
  rights: { basis: 'owner', scope: 'BAYLINK-generated art; covers for San Francisco places only', promoAllowed: true },
  subject,
  places,
  en: { alt: altEn, caption: captionEn(subject.en), credit: creditEn },
});

const RECORDS: readonly Scene3dPostcard[] = [
  postcard('sf-golden-gate-fog', { zh: '雾中的金门大桥', en: 'the Golden Gate Bridge in fog' }, ['golden-gate', 'sf-golden-gate-bridge-fort-point-guide'],
    '黏土微缩风格的金门大桥，桥塔间飘着一团白雾，海湾里有一艘帆船', 'A clay-miniature Golden Gate Bridge with a puff of fog between its towers and a sailboat on the bay'),
  postcard('sea-lions', { zh: 'PIER 39 的海狮', en: 'the sea lions at PIER 39' }, ['pier39', 'sf-fishermans-wharf-pier39-guide'],
    '黏土微缩风格的海狮趴在码头浮台上晒太阳，背后停着帆船', 'Clay-miniature sea lions resting on floating docks, with sailboats moored behind them'),
  postcard('sf-chinatown-lanterns', { zh: '唐人街的红灯笼', en: 'the lanterns over Chinatown' }, ['chinatown', 'sf-chinatown-north-beach-walk-guide'],
    '黏土微缩风格的唐人街街道，楼宇之间挂满红灯笼，行人在街上散步', 'A clay-miniature Chinatown street strung with red lanterns between the buildings, with people walking below'),
  postcard('sf-palace-fine-arts', { zh: '艺术宫与湖', en: 'the Palace of Fine Arts and its lagoon' }, ['palace', 'sf-palace-fine-arts-marina-guide'],
    '黏土微缩风格的艺术宫圆顶与柱廊，倒映在湖面上，湖边有柳树和天鹅', 'The clay-miniature Palace of Fine Arts rotunda and colonnade reflected in its lagoon, with a willow and swans'),
  postcard('ferry-building-dawn', { zh: '清晨的渡轮大厦', en: 'the Ferry Building at dawn' }, ['ferry-plaza-morning'],
    '黏土微缩风格的渡轮大厦钟楼，清晨的广场上搭着白色市集帐篷', 'The clay-miniature Ferry Building clock tower at dawn, with white market tents on the plaza'),
  postcard('sf-painted-ladies', { zh: '阿拉莫广场的彩色维多利亚房子', en: 'the Painted Ladies at Alamo Square' }, [],
    '黏土微缩风格的一排彩色维多利亚式房子，前面是草坪，远处是市中心高楼', 'A clay-miniature row of colourful Victorian houses above a lawn, with downtown towers behind'),
  postcard('sf-lands-end', { zh: 'Lands End 海岸步道', en: 'the Lands End coastal trail' }, ['sf-lands-end-sutro-baths-walk-guide'],
    '黏土微缩风格的海岸悬崖步道，柏树和行人，远处是金门大桥', 'A clay-miniature cliffside trail with cypress trees and walkers, the Golden Gate Bridge in the distance'),
  postcard('sf-music-concourse', { zh: '金门公园音乐广场', en: 'the Music Concourse in Golden Gate Park' }, ['golden-gate-park', 'golden-gate-park-free-car-free-day-guide'],
    '黏土微缩风格的金门公园音乐广场，整齐的树阵围着喷泉，两侧是博物馆建筑', 'The clay-miniature Music Concourse in Golden Gate Park: rows of trees around a fountain between museum buildings'),
];

export const SCENE3D_POSTCARDS: readonly Scene3dPostcard[] = RECORDS.map(record => {
  const entry = readExtraLadder(record.src);
  return entry ? { ...record, srcSet: ladderSrcSet(record.src, record.width, entry), lqip: entry.lqip } : { ...record, srcSet: `${record.src} ${record.width}w` };
});

/** Lookup for getCover(): `postcardKey` → image. */
export const SCENE3D_POSTCARD_IMAGES: Readonly<Record<string, Scene3dPostcard>> = Object.fromEntries(SCENE3D_POSTCARDS.map(record => [record.key, record]));

/** Place, attraction or guide id → postcard key, for SF items that have no real photo. */
export const SCENE3D_POSTCARD_FOR: Readonly<Record<string, string>> = Object.fromEntries(SCENE3D_POSTCARDS.flatMap(record => record.places.map(place => [place, record.key])));
