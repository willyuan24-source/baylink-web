import type { Bilingual } from '../core/types';
import type { EggArea, EggSource } from './registry';

/**
 * Wave 5 · lane D (W5-D6, should) · BAYBAY's pebbles: 48 smooth little stones, six in each of the eight areas (plan
 * MF8), lying on open ground a walker reaches (each spot judged like lane F's static sweep: open three ways, on the
 * walking network — searched near a known place on the published city, 2026-09-28). BAYBAY sniffs one out: a happy
 * wiggle within PEBBLE_SNIFF, a point within PEBBLE_POINT; walking over it puts it in her pouch (3 金币). Tricks at 10,
 * 25 and 40; the golden pebble when all 48 are in. The pouch is BAYBAY's own quirk; the card says only what the
 * Monterey Bay Aquarium says about otters and rocks.
 *
 * APPEND-ONLY. `PEBBLE_IDS[i]` is bit `i` of `play.g.pebble`; the reward source is `pebble:<id>`. Pure data.
 */

export interface PebbleDef {
  /** `<area prefix>-<n>` */
  id: string;
  area: EggArea;
  /** the place it lies by (the notebook, a hint) */
  near: Bilingual;
  x: number;
  z: number;
}

export const PEBBLE_COINS = 3;
/** BAYBAY wiggles within this distance of an unfound pebble (u), points within this one, and a pebble is picked up here. */
export const PEBBLE_SNIFF = 25;
export const PEBBLE_POINT = 8;
export const PEBBLE_PICK = 1.5;
/** the tricks she learns at these counts, and the golden pebble when the pouch is full */
export const PEBBLE_TRICKS = [
  { at: 10, id: 'tap', name: { zh: '肚皮敲石子', en: 'Tummy tapping' } },
  { at: 25, id: 'balance', name: { zh: '头顶石子', en: 'Balancing act' } },
  { at: 40, id: 'dance', name: { zh: '石子舞', en: 'Pebble dance' } },
] as const;
export type PebbleTrick = (typeof PEBBLE_TRICKS)[number]['id'];

const p = (id: string, area: EggArea, zh: string, en: string, x: number, z: number): PebbleDef => ({ id, area, near: { zh, en }, x, z });

export const PEBBLES: readonly PebbleDef[] = [
  // 北滩 · 电报山
  p('nb-1', 'north-beach', '科伊特塔下', 'below Coit Tower', -45.4, 49.7),
  p('nb-2', 'north-beach', '华盛顿广场边', 'by Washington Square', -73.5, 101.9),
  p('nb-3', 'north-beach', '伊娜·库尔布里斯公园', 'Ina Coolbrith Park', -63.8, 170.2),
  p('nb-4', 'north-beach', '麦康德雷巷口', 'Macondray Lane', -90.5, 170.4),
  p('nb-5', 'north-beach', '九曲花街坡顶', 'the top of Lombard St', -173.9, 168.1),
  p('nb-6', 'north-beach', '李维斯广场的草地', 'the Levi’s Plaza lawn', -5.2, 18.6),
  // 渔人码头 · 海湾
  p('wf-1', 'wharf', '39 号码头东边', 'PIER 39’s east side', -158.7, 20.9),
  p('wf-2', 'wharf', '螃蟹摊旁', 'by the crab stands', -191.4, 64),
  p('wf-3', 'wharf', '水上公园的沙滩', 'Aquatic Park beach', -252.7, 163.9),
  p('wf-4', 'wharf', '15 号码头', 'Pier 15', 27.2, 13.1),
  p('wf-5', 'wharf', '梅森堡的草坡', 'the Fort Mason lawn', -327.7, 233.5),
  p('wf-6', 'wharf', '海德街码头口的沙滩', 'the beach by Hyde St Pier', -247.6, 133.1),
  // 唐人街 · 市中心
  p('dt-1', 'downtown', '联合广场', 'Union Square', 100.9, 219.9),
  p('dt-2', 'downtown', '芳草地花园', 'Yerba Buena Gardens', 181.7, 209.4),
  p('dt-3', 'downtown', '亨廷顿公园', 'Huntington Park', 6, 213.1),
  p('dt-4', 'downtown', '唐人街牌坊里', 'inside the Dragon Gate', 91.4, 169.1),
  p('dt-5', 'downtown', '林康公园', 'Rincon Park', 200.7, 35.1),
  p('dt-6', 'downtown', '市政厅前的草坪', 'the lawn before City Hall', 97.9, 427.7),
  // 马里纳区 · 要塞
  p('mp-1', 'marina-presidio', '码头绿地', 'Marina Green', -377.3, 299.3),
  p('mp-2', 'marina-presidio', '艺术宫的湖边', 'the Palace of Fine Arts lagoon', -421.4, 429.2),
  p('mp-3', 'marina-presidio', '要塞隧道顶公园', 'Presidio Tunnel Tops', -480.5, 486),
  p('mp-4', 'marina-presidio', '里昂街台阶顶', 'the top of the Lyon St Steps', -296.6, 515.2),
  p('mp-5', 'marina-presidio', '拉法耶特公园', 'Lafayette Park', -120.2, 359.8),
  p('mp-6', 'marina-presidio', '贝克海滩', 'Baker Beach', -609.2, 847.9),
  // 金门公园 · 日落区
  p('gp-1', 'golden-gate-park', '嬉皮山', 'Hippie Hill', -137.9, 849.6),
  p('gp-2', 'golden-gate-park', '斯托湖边', 'by Stow Lake', -265, 1030.9),
  p('gp-3', 'golden-gate-park', '植物园', 'the Botanical Garden', -218.6, 1008.9),
  p('gp-4', 'golden-gate-park', '音乐广场', 'the Music Concourse', -220.2, 943.6),
  p('gp-5', 'golden-gate-park', '斯普雷克尔斯湖', 'Spreckels Lake', -445.4, 1167),
  p('gp-6', 'golden-gate-park', '大景公园', 'Grand View Park', -100.5, 1133.5),
  // 西海岸
  p('wc-1', 'west-coast', '海洋海滩', 'Ocean Beach', -426.2, 1473.6),
  p('wc-2', 'west-coast', '苏特罗高地', 'Sutro Heights', -673.7, 1249.7),
  p('wc-3', 'west-coast', '荣勋宫前', 'before the Legion of Honor', -658.6, 1084),
  p('wc-4', 'west-coast', '荷兰风车旁', 'by the Dutch Windmill', -575.9, 1310.5),
  p('wc-5', 'west-coast', '日落沙丘', 'Sunset Dunes', -345.6, 1528.1),
  p('wc-6', 'west-coast', '墨菲风车旁', 'by the Murphy Windmill', -510.2, 1361.1),
  // 教会区 · 卡斯特罗 · 双峰
  p('mc-1', 'mission-castro', '多洛雷斯公园', 'Dolores Park', 246.8, 696.6),
  p('mc-2', 'mission-castro', '科罗娜高地', 'Corona Heights', 100.9, 746.7),
  p('mc-3', 'mission-castro', '布埃纳维斯塔公园', 'Buena Vista Park', 32.4, 722.8),
  p('mc-4', 'mission-castro', '诺伊谷小广场', 'Noe Valley Town Square', 317.8, 797.6),
  p('mc-5', 'mission-castro', '伯纳尔高地', 'Bernal Heights', 530.4, 776.5),
  p('mc-6', 'mission-castro', '巴尔米巷附近', 'near Balmy Alley', 465.1, 643.4),
  // 城南 · 湾景
  p('so-1', 'south', '印第安盆地海滨公园', 'India Basin Waterfront Park', 990.6, 534.7),
  p('so-2', 'south', '烛台角', 'Candlestick Point', 1096.2, 760.7),
  p('so-3', 'south', '麦克拉伦公园', 'McLaren Park', 769.2, 1073.2),
  p('so-4', 'south', '格伦峡谷公园', 'Glen Canyon Park', 344.8, 1049.1),
  p('so-5', 'south', '斯特恩林', 'Stern Grove', 60.8, 1409.8),
  p('so-6', 'south', '芬斯顿堡的沙丘', 'the Fort Funston dunes', 97.9, 1838.1),
];

export const PEBBLE_IDS: readonly string[] = PEBBLES.map(q => q.id);
const BY_ID = new Map(PEBBLES.map(q => [q.id, q] as const));
export const pebbleById = (id: string): PebbleDef | undefined => BY_ID.get(id);
export const pebbleRewardSource = (id: string): string => `pebble:${id}`;
/** Tricks known with `count` pebbles in the pouch (in order). */
export const tricksAt = (count: number): PebbleTrick[] => PEBBLE_TRICKS.filter(t => count >= t.at).map(t => t.id);
export const GOLDEN_AT = PEBBLES.length;

/** The first pebble's card (and the golden pebble's): only what the aquarium says; the pouch of stones is BAYBAY's own. */
export const PEBBLE_CARD = {
  name: { zh: '海獭和石头', en: 'Otters and rocks' } as Bilingual,
  fact: {
    zh: '海獭前肢下有松松的皮肤"口袋"，潜水时用来装食物；碰上螃蟹、蛤蜊，可能拿石头把壳敲开。收集小石子是 BAYBAY 自己的爱好。',
    en: 'A sea otter has pockets of loose skin under each forearm to stash prey during a dive, and may crack a crab or clam open with a rock. Collecting pebbles is BAYBAY’s own hobby.',
  } as Bilingual,
  sources: [{ url: 'https://www.montereybayaquarium.org/animals/animals-a-to-z/sea-otter', verifiedAt: '2026-09-28', note: 'pockets of loose skin under each forearm; may use a rock to crack hard-shelled prey' }] as readonly EggSource[],
};
export const GOLDEN_CARD = {
  name: { zh: '金色小石子', en: 'The golden pebble' } as Bilingual,
  fact: { zh: '48 块小石子全找齐啦！这块金色的是 BAYBAY 最宝贝的一块，她会一直带着。', en: 'All 48 pebbles found! This golden one is BAYBAY’s greatest treasure — she’ll keep it with her always.' } as Bilingual,
};
