import type { Bilingual } from '../core/types';

/**
 * Wave 6 · lane H (W6-H2) · the pumpkin hunt's 40 places: one hidden jack-o'-lantern by each (a place of places.json,
 * lane G1's index: its id is the anchor scripts/opus-sf/halloween-place.mts moves to the nearest reachable spot, written
 * to halloween/huntSpots.ts). `n` is the reward number (`halloween:pumpkin:<n>`, halloween/rewards.ts) and never moves;
 * `dx` / `dz` nudge the search start off the place's middle (a hidden corner, not the front door). Pure data.
 */
export interface HuntPlace {
  n: number;
  /** places.json id */
  place: string;
  /** the place it hides by (the notebook, the toast) */
  near: Bilingual;
  dx?: number;
  dz?: number;
}

const h = (n: number, place: string, zh: string, en: string, dx?: number, dz?: number): HuntPlace => ({ n, place, near: { zh, en }, dx, dz });

export const HUNT_PLACES: readonly HuntPlace[] = [
  // Alamo Square, the Haight, the Castro
  h(1, 'alamo-square-painted-ladies', '阿拉莫广场', 'Alamo Square', -6, 4),
  h(2, 'haight-ashbury', '海特街和阿什伯里街口', 'Haight & Ashbury'),
  h(3, 'osm-w27092661', '格拉坦游乐场', 'Grattan Playground'),
  h(4, 'osm-w7459901', '布埃纳维斯塔公园', 'Buena Vista Park'),
  h(5, 'corona-heights', '科罗娜高地', 'Corona Heights'),
  h(6, 'castro-theatre', '卡斯特罗剧院', 'the Castro Theatre'),
  h(7, 'osm-w24562854', '杜博斯公园', 'Duboce Park'),
  h(8, 'osm-w16751151', '狭长公园', 'the Panhandle'),
  // the Mission, Bernal, Twin Peaks
  h(9, 'dolores-park', '多洛雷斯公园', 'Dolores Park'),
  h(10, 'mission-dolores', '多洛雷斯传教站', 'Mission Dolores'),
  h(11, 'osm-w8916752', '克拉里恩巷', 'Clarion Alley'),
  h(12, 'osm-w23908184', '普雷西塔公园', 'Precita Park'),
  h(13, 'bernal-heights', '伯纳尔高地', 'Bernal Heights'),
  h(14, 'osm-n599157316', '双峰观景点', 'the Twin Peaks lookout'),
  h(15, 'mount-davidson', '戴维森山', 'Mount Davidson'),
  // the west: the park, the ocean, Lands End
  h(16, 'conservatory-of-flowers', '花之温室', 'the Conservatory of Flowers'),
  h(17, 'stow-lake', '斯托湖', 'Stow Lake'),
  h(18, 'dutch-windmill', '荷兰风车', 'the Dutch Windmill'),
  h(19, 'ocean-beach', '海洋海滩', 'Ocean Beach'),
  h(20, 'sutro-baths', '苏特罗浴场遗址', 'the Sutro Baths ruins'),
  h(21, 'lands-end', '陆地尽头', 'Lands End'),
  h(22, 'legion-of-honor', '荣勋宫', 'the Legion of Honor'),
  // the Presidio and the Marina
  h(23, 'fort-point', '波因特堡', 'Fort Point'),
  h(24, 'osm-n6064744363', '国家公墓观景点', 'the National Cemetery Overlook'),
  h(25, 'palace-of-fine-arts', '艺术宫', 'the Palace of Fine Arts'),
  h(26, 'osm-n7221410485', '里昂街台阶', 'the Lyon Street Steps'),
  h(27, 'fort-mason', '梅森堡', 'Fort Mason'),
  // Pacific Heights, Japantown, Civic Center
  h(28, 'osm-w16751737', '阿尔塔广场公园', 'Alta Plaza Park'),
  h(29, 'osm-w16751838', '拉法耶特公园', 'Lafayette Park'),
  h(30, 'japantown-peace-pagoda', '日本城和平塔', 'the Peace Pagoda'),
  h(31, 'city-hall', '市政厅', 'City Hall'),
  // the northeast: the Wharf, North Beach, downtown
  h(32, 'ghirardelli-square', '吉拉德利广场', 'Ghirardelli Square'),
  h(33, 'lombard-crooked', '九曲花街', 'Lombard Street'),
  h(34, 'pier-39', '39 号码头', 'PIER 39'),
  h(35, 'coit-tower', '科伊特塔', 'Coit Tower'),
  h(36, 'north-beach-washington-sq', '华盛顿广场', 'Washington Square'),
  h(37, 'grace-cathedral', '慈恩堂', 'Grace Cathedral'),
  h(38, 'union-square', '联合广场', 'Union Square'),
  h(39, 'yerba-buena-gardens', '芳草地花园', 'Yerba Buena Gardens'),
  h(40, 'ferry-building', '渡轮大厦', 'the Ferry Building'),
];
