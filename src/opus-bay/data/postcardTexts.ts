import type { Bilingual } from '../core/types';
import type { PostcardId } from './postcards';

/**
 * W8-P4 (lane P; sf-w8-lead.md §3 row P: GameRoot ≤ 255 KB gzip) · the district postcards' words — title, fact, hint —
 * moved verbatim out of `data/postcards.ts`. They come with the play layer's chunk (`data/scriptLoad.ts`, imported by
 * ui/playParts.tsx, fills them in place before GameRoot lets Start through: every reader — the E prompt's name, the
 * collected-card line, the journal, the album, the map — reads them during play); node fills them when
 * `data/postcards.ts` loads. Sources and dates stay in `data/postcards.ts` / `data/pois.ts` (SRC).
 */
export interface PostcardText { title: Bilingual; fact: Bilingual; hint: Bilingual }

export const DISTRICT_POSTCARD_TEXTS: Readonly<Record<PostcardId, PostcardText>> = {
  'ferry-building-dawn': {
    title: { zh: '清晨的渡轮大厦', en: 'Ferry Building at Dawn' },
    fact: {
      zh: '渡轮大厦 1898 年 7 月 13 日开张；经过四年修缮，2003 年重新开放成了美食市场。',
      en: 'The Ferry Building opened on July 13, 1898, and reopened as a food marketplace in 2003 after a four-year restoration.',
    },
    hint: { zh: '钟楼附近，靠海湾的那一侧找找。', en: 'Look near the clock tower, on the bay side.' },
  },
  'pier7-sunset': {
    title: { zh: 'Pier 7 的日落', en: 'Sunset on Pier 7' },
    fact: {
      zh: '在加州公共码头钓鱼不需要钓鱼执照，但尺寸、数量和季节规定照样适用。',
      en: 'You don’t need a fishing license on a California public pier — but size limits, bag limits and seasons still apply.',
    },
    hint: { zh: '沿着 Pier 7 的长椅往尽头走。', en: 'Follow the benches out along Pier 7.' },
  },
  'exploratorium': {
    title: { zh: '探索馆的午后', en: 'An Afternoon at the Exploratorium' },
    fact: {
      zh: 'Exploratorium 1969 年在艺术宫开馆，2013 年 4 月搬到了 Pier 15。',
      en: 'The Exploratorium opened in 1969 at the Palace of Fine Arts and moved to Pier 15 in April 2013.',
    },
    hint: { zh: 'Pier 15 门前的海边找找。', en: 'Search the waterfront in front of Pier 15.' },
  },
  'filbert-steps': {
    title: { zh: '花园里的台阶', en: 'Steps Through the Garden' },
    fact: {
      zh: '电报山得名于 1850 年山顶的旗语电报站，它用来通报进港的船只。',
      en: 'Telegraph Hill is named for an 1850 semaphore telegraph on its summit that announced arriving ships.',
    },
    hint: { zh: 'Filbert Steps 半路的花园里。', en: 'In the garden halfway up the Filbert Steps.' },
  },
  'coit-tower': {
    title: { zh: '山顶的 Coit Tower', en: 'Coit Tower on the Hill' },
    fact: {
      zh: 'Coit Tower 1933 年建成，以消防队的热心资助者 Lillie Hitchcock Coit 命名；官方说它不是照着消防水枪设计的。',
      en: 'Finished in 1933 and named for firefighter patron Lillie Hitchcock Coit — and officially not designed to look like a fire hose nozzle.',
    },
    hint: { zh: '绕着塔走一圈看看。', en: 'Take a lap around the tower.' },
  },
  'bay-bridge-night': {
    title: { zh: '夜色里的海湾大桥', en: 'Bay Bridge at Night' },
    fact: {
      zh: '旧金山–奥克兰海湾大桥 1936 年 11 月 12 日通车，比金门大桥早了半年。',
      en: 'The San Francisco–Oakland Bay Bridge opened on November 12, 1936 — six months before the Golden Gate Bridge.',
    },
    hint: { zh: '去看得见海湾大桥的码头上找找。', en: 'Try a pier with a clear view of the Bay Bridge.' },
  },
  'sea-lions': {
    title: { zh: '海狮开会中', en: 'Sea Lions in Session' },
    fact: {
      zh: '1989 年地震后不久，海狮开始爬上 PIER 39 的 K-Dock；2024 年 5–6 月曾超过 2,100 只。',
      en: 'Sea lions began hauling out on PIER 39’s K-Dock soon after the 1989 earthquake; in May–June 2024 there were over 2,100.',
    },
    hint: { zh: '海狮观景处附近，跟着叫声走。', en: 'Near the sea lion viewing spot — follow the barking.' },
  },
  'streetcar': {
    title: { zh: 'F 线老电车', en: 'The F-line Streetcar' },
    fact: {
      zh: 'F 线 2000 年起开到渔人码头，线上还跑着 1928 年造的米兰「Peter Witt」老电车。',
      en: 'The F line has run to Fisherman’s Wharf since 2000, and some of its cars are 1928 “Peter Witt” streetcars from Milan.',
    },
    hint: { zh: '海边马路的电车站附近。', en: 'Near a streetcar stop on The Embarcadero.' },
  },
};
