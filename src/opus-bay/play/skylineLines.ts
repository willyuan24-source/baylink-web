import type { Bilingual } from '../core/types';

/**
 * Wave 7 · lane W2 · 那是什么？ the skyline quiz's words and landmarks (a tiny module: the entry and the quiz read it).
 * Every BAYBAY line is a FIXED bubble (zh + en, no template) so lane X's binder can voice it by its text (sf-w7-lead §4);
 * a landmark's fact is its own fixed line (it names the landmark, so a wrong answer needs no templated correction).
 *
 * Aim points: world x, z and the y the camera looks at (a little under the top): the Golden Gate Bridge's south tower,
 * Sutro Tower, City Hall's dome, the cellhouse (world/sf/landmarks tall parts, measured tops); Coit Tower, the Transamerica
 * Pyramid, Salesforce Tower, the Ferry Building's clock tower (the hero district's models, actors/glideTall heroTall); the
 * Bay Bridge's first tower (glideTall bayBridgeTall). tests/opus-bay-w7-w2-skyline.test.ts checks them against those sources.
 *
 * Facts (checked on the web 2026-09-29): GGB towers 746 ft above the water, opened 27 May 1937 —
 * https://presidio.gov/explore/blog/golden-gate-bridge-fun-facts ; Sutro Tower 977 ft, finished 4 July 1973 —
 * https://www.sutrotower.com/tower-history ; City Hall's dome 307 ft, 42 ft taller than the US Capitol's —
 * https://www.sf.gov/location--san-francisco-city-hall ; Coit Tower 210 ft, 1933, murals inside —
 * https://sfrecpark.org/facilities/facility/details/Coit-Tower-290 ; Transamerica Pyramid 853 ft, 1972, the tallest in
 * the city until 2017 — https://en.wikipedia.org/wiki/Transamerica_Pyramid ; Salesforce Tower 1,070 ft, 2018, the
 * tallest — https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_San_Francisco ; the Ferry Building 1898, a 245 ft
 * clock tower — https://en.wikipedia.org/wiki/San_Francisco_Ferry_Building ; the Bay Bridge opened 12 Nov 1936, six
 * months before the Golden Gate — https://blog.bayareametro.gov/posts/happy-85th-bay-bridge ; Alcatraz's lighthouse
 * (1854) the first on the US West Coast — https://www.nps.gov/places/000/alcatraz-lighthouse.htm .
 */

export const SKYLINE_ID = 'skyline';
export const SKYLINE_NAME: Bilingual = { zh: '那是什么？', en: 'What’s that?' };

export interface SkylineSpot { id: string; name: Bilingual; x: number; z: number; y: number; top: number; r: number; fact: Bilingual }

export const SKYLINE_SPOTS: readonly SkylineSpot[] = [
  {
    id: 'golden-gate-bridge', name: { zh: '金门大桥', en: 'Golden Gate Bridge' }, x: -797.7, z: 566.4, y: 38, top: 43, r: 3,
    fact: { zh: '那是金门大桥！1937 年通车，桥塔高出水面 227 米。', en: 'That’s the Golden Gate Bridge! It opened in 1937; its towers rise 746 feet above the water.' },
  },
  {
    id: 'sutro-tower', name: { zh: '苏特罗塔', en: 'Sutro Tower' }, x: 72.4, z: 975.2, y: 88, top: 96.6, r: 6,
    fact: { zh: '那是苏特罗塔！1973 年建成的电视塔，高 298 米。', en: 'That’s Sutro Tower, the TV tower: 977 feet tall since 1973.' },
  },
  {
    id: 'city-hall', name: { zh: '市政厅', en: 'City Hall' }, x: 91.8, z: 418.9, y: 19, top: 21.5, r: 4,
    fact: { zh: '那是市政厅的圆顶！比美国国会大厦的圆顶还高 13 米。', en: 'That’s City Hall’s dome, 42 feet taller than the US Capitol’s!' },
  },
  {
    id: 'coit-tower', name: { zh: '科伊特塔', en: 'Coit Tower' }, x: -50.25, z: 51.1, y: 33, top: 36, r: 3,
    fact: { zh: '那是科伊特塔！1933 年建成，塔里画满了壁画。', en: 'That’s Coit Tower! Built in 1933, with murals painted all around inside.' },
  },
  {
    id: 'transamerica-pyramid', name: { zh: '泛美金字塔', en: 'Transamerica Pyramid' }, x: 56.02, z: 101.68, y: 36, top: 41, r: 4,
    fact: { zh: '那是泛美金字塔！1972 年建成，当了四十多年全城最高楼。', en: 'That’s the Transamerica Pyramid! Built in 1972, the city’s tallest for over forty years.' },
  },
  {
    id: 'salesforce-tower', name: { zh: 'Salesforce 大楼', en: 'Salesforce Tower' }, x: 166.32, z: 107.54, y: 50, top: 56.5, r: 4,
    fact: { zh: '那是 Salesforce 大楼，现在旧金山最高的楼，326 米！', en: 'That’s Salesforce Tower, the tallest in San Francisco: 1,070 feet!' },
  },
  {
    id: 'ferry-building', name: { zh: '渡轮大厦', en: 'Ferry Building' }, x: 133.89, z: -11.75, y: 26, top: 30, r: 3,
    fact: { zh: '那是渡轮大厦！1898 年建成，钟楼高 75 米。', en: 'That’s the Ferry Building! Built in 1898, with a 245-foot clock tower.' },
  },
  {
    id: 'bay-bridge', name: { zh: '海湾大桥', en: 'Bay Bridge' }, x: 232.27, z: -0.24, y: 28, top: 31.5, r: 5,
    fact: { zh: '那是海湾大桥！1936 年通车，比金门大桥还早半年。', en: 'That’s the Bay Bridge! It opened in 1936, six months before the Golden Gate.' },
  },
  {
    id: 'alcatraz', name: { zh: '恶魔岛', en: 'Alcatraz' }, x: -467.9, z: -58.3, y: 11, top: 13.7, r: 8,
    fact: { zh: '那是恶魔岛！岛上的灯塔是美国西海岸的第一座灯塔。', en: 'That’s Alcatraz! Its lighthouse was the first on the US West Coast.' },
  },
];

export const SKYLINE_LINES = {
  start: { zh: '考考你！我指的那个是什么？', en: 'Quiz time! What’s that I’m pointing at?' },
  next: { zh: '下一个！那个呢？', en: 'Next one! And that?' },
  right: { zh: '答对啦！', en: 'That’s right!' },
  wrong: { zh: '差一点！', en: 'Not quite!' },
  allRight: { zh: '全答对了，你是旧金山通！', en: 'All correct: you know your San Francisco!' },
  done: { zh: '又认识了几个地标！', en: 'A few more landmarks you know now!' },
  noView: { zh: '从这儿看不到大地标呢，去附近的观景点看看吧！', en: 'No big landmarks in sight from here. Let’s try a lookout nearby!' },
} satisfies Record<string, Bilingual>;
