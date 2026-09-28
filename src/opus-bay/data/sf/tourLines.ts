import type { Bilingual, Mood } from '../../core/types';
import type { LineSource } from './lines';

/**
 * Wave 4 · lane C · W4-C3: what BAYBAY says on the new lines and the Grand Tour (plan sf-w4-plan.md §3.2 narration,
 * §3.3, §3.5, §4.2 arrival moments). Data only (type imports): the narration module (game/arrival.ts, the tour engine)
 * picks the lines, lane V records them (plan §6 H-6: qwen TTS, Pixie preset), lane G shows the bubbles.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 * │ FROZEN 2026-09-27 (TOUR_LINES_FROZEN; git tag `w4-tourlines-frozen`). Lane V records exactly these texts:     │
 * │ an id never changes its words once pushed — a new wording is a NEW id (and a new recording).                  │
 * │ Voice clip names: `<lang>-<id>` (zh / en), as the wave-3 lines (data/voiceLinesSf.ts).                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Sets (every text: one idea, zh ≤ 45 bubble width, en ≤ 110; a fact carries a `source`; VOICE.md glossary):
 * - LOOP_STOP_LINES   the 16 sightseeing-loop stops (lane T's station ids `loop-*`, data/sf/stationNames.ts):
 *                     `approach` (≈ 60 u before the stop, with the 4 s look-at bias toward `look`), `arrive` (during the
 *                     8 s dwell), `hopOffTip` (the hop-off hint); `look` = lane P's Attraction id (data/sf/attractions.ts). "左手边 / 右手边" only where the measured bearing of the
 *                     sight is clearly to that side 45 u before the stop (C:/Users/willy/opus-qa/w4/w4-c/sides.mjs on
 *                     the plan's measured loop); elsewhere "前面".
 * - METRO_LINES       N / M boarding, the subway, portals, the stops with a sight (tunnel facts: lane T's stationNames).
 * - CHAPTER_LINES     the Grand Tour's 5 chapter intros and outros (data/sf/tours.ts `sf-grand`).
 * - ARRIVAL_LINES     the arrival-moment line of each NEW tier-1 / tier-2 attraction: the same text as its card's
 *                     `bark` (data/sf/placeCards.ts; tested equal). The built landmarks keep their card barks as text
 *                     bubbles (not recorded in wave 4).
 * - QUIET_LINES       memorials and places of worship passed on the tour: said softly (mood 'thinking', no emote).
 * - TOUR_LINES_2      lines added after the freeze (new ids; lane V records them later) and RETIRED_LINES, the
 *                     recorded ids they replace in the narration (the frozen texts and clips stay).
 */

export const TOUR_LINES_FROZEN = '2026-09-27';

export interface TourLine {
  /** voice-line id (clip `<lang>-<id>`) */
  id: string;
  zh: string;
  en: string;
  mood: Mood;
  /** where a fact in the line comes from (checked on `verifiedAt`) */
  source?: LineSource;
}

export interface LoopStopLines {
  /** the attraction id the approach look-at bias points at (the `transit approach` event's `attraction`) */
  look: string;
  /** side of the bus the sight is on 45 u before the stop (measured), for the camera bias */
  side: 'left' | 'right' | 'ahead';
  approach: TourLine;
  arrive: TourLine;
  hopOffTip: TourLine;
}

const V = TOUR_LINES_FROZEN;
const src = (url: string): LineSource => ({ url, verifiedAt: V });
const L = (id: string, zh: string, en: string, mood: Mood, url?: string): TourLine => ({ id, zh, en, mood, ...(url ? { source: src(url) } : {}) });

// ---------------------------------------------------------------------------------------------------------------
// The sightseeing loop, clockwise from the Ferry Building (plan §3.2)
// ---------------------------------------------------------------------------------------------------------------

const stop = (key: string, look: string, side: LoopStopLines['side'], approach: [string, string, Mood, string?], arrive: [string, string, Mood, string?], tip: [string, string, Mood, string?]): [string, LoopStopLines] => [
  `loop-${key}`,
  {
    look, side,
    approach: L(`loop-${key}-approach`, ...approach),
    arrive: L(`loop-${key}-arrive`, ...arrive),
    hopOffTip: L(`loop-${key}-tip`, ...tip),
  },
];

export const LOOP_STOP_LINES: Readonly<Record<string, LoopStopLines>> = Object.fromEntries([
  stop('ferry-building', 'ferry-building-marketplace', 'ahead',
    ['前面就是渡轮大厦，钟楼 1898 年就立在这儿了。', 'Up ahead: the Ferry Building — its clock tower has stood here since 1898.', 'point', 'https://en.wikipedia.org/wiki/San_Francisco_Ferry_Building'],
    ['渡轮大厦到了！观光巴士一圈 16 站，随上随下。', 'Ferry Building! The loop has 16 stops — hop on and off anytime.', 'happy'],
    ['下车就是渡轮大厦，周二、四、六门外有农夫市集。', 'Hop off for the Ferry Building — a farmers market is outside Tue, Thu and Sat.', 'happy', 'https://www.ferrybuildingmarketplace.com/farmers-market/']),
  stop('pier-39', 'pier-39', 'ahead',
    ['前面是 39 号码头，海狮就趴在码头边的浮台上。', 'PIER 39 ahead — the sea lions lounge on the floats beside it.', 'point'],
    ['39 号码头到了！海狮不收门票，但也不保证在家。', 'PIER 39! The sea lions are free, but they keep their own hours.', 'excited'],
    ['下车往码头西边走，就能听到海狮叫。', 'Hop off and head to the west side of the pier to hear the sea lions.', 'happy']),
  stop('wharf-hyde', 'maritime-museum-bathhouse', 'ahead',
    ['前面是海德街，叮当车就在这儿掉头。', 'Hyde Street ahead — the cable cars turn around here.', 'point'],
    ['渔人码头到了！那栋像船的白楼是免费的海事博物馆。', 'Fisherman\'s Wharf! The ship-shaped white building is a free maritime museum.', 'happy', 'https://www.nps.gov/safr/learn/historyculture/aquatic-park-bathhouse.htm'],
    ['下车走几步就是叮当车转车台，九曲花街也不远。', 'Hop off: the cable-car turntable is steps away, and the crooked street isn\'t far.', 'happy']),
  stop('palace-of-fine-arts', 'palace-of-fine-arts', 'ahead',
    ['前面就是艺术宫，那座圆顶是 1915 年世博会留下的。', 'The Palace of Fine Arts ahead — its rotunda is from the 1915 world\'s fair.', 'point', 'https://en.wikipedia.org/wiki/Palace_of_Fine_Arts'],
    ['艺术宫到了！绕着湖边的柱廊走一圈吧。', 'Palace of Fine Arts! Take a stroll round the lagoon colonnade.', 'happy'],
    ['下车走一小段就到湖边；往北是海滨草地和海浪风琴。', 'A short walk to the lagoon; the Marina Green and the Wave Organ lie north.', 'happy']),
  stop('golden-gate-bridge', 'golden-gate-bridge', 'right',
    ['右手边看，金门大桥的南塔出来啦！', 'Look right — the Golden Gate Bridge\'s south tower!', 'excited'],
    ['金门大桥到了！游客中心就在旁边，桥上能走过去。', 'Golden Gate Bridge! The Welcome Center is right here, and you can walk the bridge.', 'excited'],
    ['下车去观景点；想走上桥面，走东侧的人行道。', 'Hop off for the vista point; to walk the bridge, take the east sidewalk.', 'point', 'https://www.goldengate.org/bridge/visiting-the-bridge/bikes-pedestrians/']),
  stop('legion-of-honor', 'legion-of-honor', 'ahead',
    ['前面那座白色宫殿，就是荣勋宫美术馆。', 'That white palace ahead is the Legion of Honor.', 'point'],
    ['荣勋宫到了！它在林肯公园里，俯瞰着金门海峡。', 'Legion of Honor! It sits in Lincoln Park above the Golden Gate.', 'happy', 'https://en.wikipedia.org/wiki/Lincoln_Park_(San_Francisco)'],
    ['博物馆周一闭馆；外面的公园和海景随时可看。', 'The museum is closed Mondays; the park and the sea views never are.', 'thinking', 'https://www.famsf.org/visit/legion-tickets-hours']),
  stop('lands-end-sutro', 'lands-end', 'ahead',
    ['前面就是天涯海角，悬崖下面是苏特罗浴场遗址。', 'Lands End ahead — the Sutro Baths ruins lie below the cliffs.', 'point', 'https://www.nps.gov/goga/planyourvisit/landsend.htm'],
    ['天涯海角到了！游客中心在旁边，步道沿着悬崖走。', 'Lands End! The visitor centre is here and the trail follows the cliffs.', 'happy', 'https://www.nps.gov/goga/planyourvisit/landsend.htm'],
    ['往下走一小段就是浴场遗址；岩石滑，小心大浪。', 'A short walk down to the ruins — slippery rocks, watch the waves.', 'thinking', 'https://www.nps.gov/places/000/sutro-baths.htm']),
  stop('ocean-beach-windmill', 'dutch-windmill', 'left',
    ['左手边看，荷兰风车！它当年是给公园抽水的。', 'Look left — the Dutch Windmill! It once pumped water for the park.', 'point', 'https://sfrecpark.org/908/Golden-Gate-Park---Queen-Wilhelmina-Gard'],
    ['海洋海滩到了！浪很大，我们只看不下水。', 'Ocean Beach! Big surf — we watch, we don\'t swim.', 'happy', 'https://www.nps.gov/places/000/ocean-beach.htm'],
    ['风车就在路边，郁金香一般 3 月开；N 线终点在南边不远。', 'The windmill\'s by the road, tulips about March; the N terminus is a short walk south.', 'happy', 'https://sfrecpark.org/908/Golden-Gate-Park---Queen-Wilhelmina-Gard']),
  stop('golden-gate-park', 'de-young-tower', 'left',
    ['左手边那座铜色的塔，是迪扬博物馆的观景塔。', 'On the left, the copper tower — the de Young\'s observation tower.', 'point'],
    ['金门公园音乐广场到了！科学院和迪扬面对面。', 'Golden Gate Park\'s Music Concourse! The Academy and the de Young face each other.', 'happy'],
    ['观景塔免费上；日本茶园就在音乐广场旁边。', 'The tower is free to go up; the Japanese Tea Garden is right beside the concourse.', 'happy', 'https://www.famsf.org/']),
  stop('haight-ashbury', 'haight-ashbury', 'ahead',
    ['前面就是海特和阿什伯里的路口，爱之夏从这儿出名。', 'Haight and Ashbury ahead — the Summer of Love made it famous.', 'point', 'https://en.wikipedia.org/wiki/Haight-Ashbury'],
    ['海特街到了！彩色老房子和古着店一路排开。', 'Haight-Ashbury! Painted Victorians and vintage shops all the way.', 'happy'],
    ['沿海特街往西走到底就是金门公园；N 线在 Carl & Cole。', 'Walk Haight west into the park; the N stops at Carl & Cole.', 'happy']),
  stop('painted-ladies', 'alamo-square-painted-ladies', 'left',
    ['左手边看！坡下那排彩色房子，就是彩绘女士。', 'Look left! That row of painted houses below the hill — the Painted Ladies.', 'excited'],
    ['彩绘女士到了！从阿拉莫广场的坡上拍最好看。', 'The Painted Ladies! The best photo is from the Alamo Square slope.', 'happy'],
    ['房子是私人住宅，在广场这边拍照就好。', 'They are private homes: take your photos from the square.', 'thinking']),
  stop('castro', 'castro-theatre', 'ahead',
    ['前面就是卡斯特罗，看那面大彩虹旗！', 'The Castro ahead — look at that giant rainbow flag!', 'excited'],
    ['卡斯特罗到了！剧院 2026 年 2 月整修后重新开放。', 'The Castro! The theatre reopened in February 2026 after its renovation.', 'happy', 'https://localnewsmatters.org/2026/02/05/sf-castro-theatre-reopening-friday-after-rehabilitation/'],
    ['下车就是卡斯特罗剧院；M 线的车站在广场下面。', 'The Castro Theatre is right here; the M station is under the plaza.', 'happy']),
  stop('twin-peaks', 'twin-peaks', 'ahead',
    ['我们在往双峰爬坡，快到山顶停车场了！', 'We\'re climbing Twin Peaks — nearly at the summit lot!', 'excited'],
    ['双峰到了！跟我走上观景台，整座城都在脚下。', 'Twin Peaks! Follow me up to the overlook — the whole city below.', 'proud'],
    ['走一小段就到观景台；部分步道在施工，观景台照常开。', 'A short walk up to the overlook; some trails are under works, the overlook is open.', 'thinking', 'https://www.sfrecpark.org/634/Twin-Peaks-Trails-Improvement-Promenade-']),
  stop('mission-dolores', 'mission-dolores', 'ahead',
    ['前面那座白墙小教堂，是全城最古老的建筑。', 'The little white church ahead is the oldest building in the city.', 'point', 'https://www.missiondolores.org/'],
    ['多洛雷斯传教站到了！它 1776 年就建立了。', 'Mission Dolores! Founded in 1776.', 'happy', 'https://www.missiondolores.org/'],
    ['往南走两个路口就是多洛雷斯公园，看天际线。', 'Two blocks south is Dolores Park and its skyline view.', 'happy']),
  stop('civic-center', 'city-hall', 'ahead',
    ['前面那个金色圆顶，就是市政厅！', 'That golden dome ahead — City Hall!', 'point'],
    ['市政中心到了！市政厅的圆顶比美国国会大厦还高。', 'Civic Center! City Hall\'s dome is taller than the US Capitol\'s.', 'excited', 'https://www.sf.gov/location/san-francisco-city-hall'],
    ['工作日可以免费进市政厅；亚洲艺术博物馆就在对面。', 'City Hall is free to enter on weekdays; the Asian Art Museum is across the plaza.', 'happy', 'https://www.sf.gov/location/san-francisco-city-hall']),
  stop('chinatown', 'chinatown-dragon-gate', 'ahead',
    ['前面就是唐人街龙门，门后面是都板街。', 'The Chinatown Dragon Gate ahead — Grant Avenue lies behind it.', 'point'],
    ['唐人街到了！它是北美最老的唐人街。', 'Chinatown! The oldest Chinatown in North America.', 'excited', 'https://en.wikipedia.org/wiki/Chinatown,_San_Francisco'],
    ['穿过龙门是唐人街；往西南走两个路口是联合广场。', 'Through the gate is Chinatown; Union Square is two blocks south-west.', 'happy']),
]);

// ---------------------------------------------------------------------------------------------------------------
// Muni Metro: N Judah and M Ocean View (plan §3.3)
// ---------------------------------------------------------------------------------------------------------------

/** Keys the narration asks for (the ride module maps transit events / portal cuts onto them). */
export type MetroLineKey =
  | 'board-n' | 'board-m' | 'subway' | 'duboce-portal' | 'sunset-tunnel' | 'carl-cole' | 'ucsf-window' | '9th-irving'
  | 'la-playa' | 'twin-peaks-tunnel' | 'west-portal' | 'stonestown-next' | 'sfsu-next' | 'balboa-park';

export const METRO_LINES: Readonly<Record<MetroLineKey, TourLine>> = {
  'board-n': L('metro-board-n', '上 N 线咯！它从海边一路开到市中心。', 'All aboard the N! It runs from the ocean all the way downtown.', 'excited', 'https://en.wikipedia.org/wiki/N_Judah'),
  'board-m': L('metro-board-m', '上 M 线咯！它穿过双峰隧道，连起市中心和城南。', 'All aboard the M! Through the Twin Peaks Tunnel, it links downtown and the south.', 'excited', 'https://en.wikipedia.org/wiki/M_Ocean_View'),
  subway: L('metro-subway', '我们在市场街地下，Muni 地铁 1980 年起就在这下面跑。', 'We\'re under Market Street — Muni Metro has run down here since 1980.', 'point', 'https://en.wikipedia.org/wiki/Market_Street_subway'),
  'duboce-portal': L('metro-duboce-portal', '出隧道啦！N 线从这儿钻出地面。', 'Out of the tunnel! The N comes up to the street here.', 'excited'),
  'sunset-tunnel': L('metro-sunset-tunnel', '前面是日落隧道，1928 年通车，只有 N 线走。', 'The Sunset Tunnel ahead: opened in 1928, used only by the N.', 'point', 'https://en.wikipedia.org/wiki/Sunset_Tunnel'),
  'carl-cole': L('metro-carl-cole', '钻出日落隧道！这里是 Carl & Cole，海特街在北边不远。', 'Out of the Sunset Tunnel! This is Carl & Cole, a few blocks south of the Haight.', 'excited'),
  'ucsf-window': L('metro-ucsf-window', '窗外山坡上那片楼群，就是 UCSF 帕纳萨斯校区。', 'Out the window, the buildings on the hill: UCSF Parnassus.', 'point', 'https://en.wikipedia.org/wiki/University_of_California,_San_Francisco'),
  '9th-irving': L('metro-9th-irving', '9th & Irving 到了！走过去就是金门公园和植物园。', '9th & Irving! The park and the Botanical Garden are a short walk away.', 'happy'),
  'la-playa': L('metro-la-playa', '终点站，海洋海滩！海风好大～', 'End of the line: Ocean Beach! Feel that wind~', 'excited'),
  'twin-peaks-tunnel': L('metro-twin-peaks-tunnel', '我们在双峰隧道里：1918 年通车，从卡斯特罗钻到西门。', 'We\'re in the Twin Peaks Tunnel — opened 1918, from the Castro to West Portal.', 'point', 'https://en.wikipedia.org/wiki/Twin_Peaks_Tunnel'),
  'west-portal': L('metro-west-portal', '出隧道啦！这里是西门，外面就是 West Portal 大道。', 'Out of the tunnel! This is West Portal, right on West Portal Avenue.', 'excited', 'https://en.wikipedia.org/wiki/West_Portal_station'),
  'stonestown-next': L('metro-stonestown-next', '下一站 19th Ave & Winston，石镇购物中心就在门口！', 'Next stop 19th Ave & Winston — Stonestown is right by the door!', 'excited'),
  'sfsu-next': L('metro-sfsu-next', '下一站 Holloway，州立大学到了！', 'Next stop Holloway — SF State!', 'excited'),
  'balboa-park': L('metro-balboa-park', '终点站 Balboa Park，城市学院就在旁边。', 'End of the line: Balboa Park, next to City College.', 'happy'),
};

// ---------------------------------------------------------------------------------------------------------------
// The Grand Tour's chapters (data/sf/tours.ts sf-grand)
// ---------------------------------------------------------------------------------------------------------------

export const GRAND_CHAPTER_IDS = ['bay', 'coast', 'sunset-n', 'south-m', 'peaks-downtown'] as const;
export type GrandChapterId = (typeof GRAND_CHAPTER_IDS)[number];

export const CHAPTER_LINES: Readonly<Record<GrandChapterId, { intro: TourLine; outro: TourLine }>> = {
  bay: {
    intro: L('grand-bay-intro', '第一章·海湾：坐观光巴士，从渡轮大厦去金门大桥！', 'Chapter 1, The Bay: the sightseeing bus from the Ferry Building to the Golden Gate!', 'excited'),
    outro: L('grand-bay-outro', '海湾这章完成！下一章，我们去看太平洋。', 'The Bay, done! Next chapter: the Pacific.', 'proud'),
  },
  coast: {
    intro: L('grand-coast-intro', '第二章·海岸：荣勋宫、天涯海角，一路到海洋海滩。', 'Chapter 2, The Coast: the Legion, Lands End, then Ocean Beach.', 'happy'),
    outro: L('grand-coast-outro', '海岸这章完成！接下来坐 N 线穿过日落区。', 'The Coast, done! Next we ride the N across the Sunset.', 'proud'),
  },
  'sunset-n': {
    intro: L('grand-sunset-n-intro', '第三章·N 线：从海边坐回城里，经过金门公园和 UCSF。', 'Chapter 3, the N: from the sea back to town, past the park and UCSF.', 'happy'),
    outro: L('grand-sunset-n-outro', 'N 线这章完成！接下来坐 M 线去石镇和州立大学。', 'The N, done! Next: the M to Stonestown and SF State.', 'proud'),
  },
  'south-m': {
    intro: L('grand-south-m-intro', '第四章·M 线：穿过双峰隧道，去石镇和州立大学！', 'Chapter 4, the M: through the Twin Peaks Tunnel to Stonestown and SF State!', 'excited'),
    outro: L('grand-south-m-outro', '石镇和州大都去过啦！最后一章：双峰和市中心。', 'Stonestown and SF State, done! Last chapter: Twin Peaks and downtown.', 'proud'),
  },
  'peaks-downtown': {
    intro: L('grand-peaks-downtown-intro', '最后一章：登上双峰，再坐叮当车回渡轮大厦！', 'Last chapter: up Twin Peaks, then a cable car back to the Ferry!', 'excited'),
    outro: L('grand-peaks-downtown-outro', '一日游完成！整座城你都走过一遍啦～', 'Grand Tour complete! You\'ve seen the whole city~', 'proud'),
  },
};

// ---------------------------------------------------------------------------------------------------------------
// Arrival moments of the new tier-1 / tier-2 attractions (= the card barks, tested equal)
// ---------------------------------------------------------------------------------------------------------------

const arrive = (attraction: string, zh: string, en: string, mood: Mood): [string, TourLine] => [attraction, L(`arrive-${attraction}`, zh, en, mood)];

export const ARRIVAL_LINES: Readonly<Record<string, TourLine>> = Object.fromEntries([
  // tier 1
  arrive('stonestown-galleria', '石镇到啦！1952 年就开业了，城西人逛街、看电影都来这儿。', 'Stonestown! Open since 1952 — the west side comes here to shop and catch a film.', 'excited'),
  arrive('sf-state-university', '到州立大学啦！1899 年建校，1953 年搬到默塞德湖边这片校园。', 'SF State! Founded in 1899, it moved to this campus by Lake Merced in 1953.', 'proud'),
  arrive('union-square', '联合广场！中间那根柱子顶上站着胜利女神，1903 年立的。', 'Union Square! Victory tops the column in the middle — it went up in 1903.', 'point'),
  arrive('ferry-building-marketplace', '渡轮大厦里是一整条美食走廊，周二、四、六门外还有农夫市集！', 'Inside the Ferry Building: a hall of local food. Outside, a farmers market Tue, Thu and Sat!', 'happy'),
  // tier 2 · campuses
  arrive('ucsf-parnassus', '这是 UCSF 的老校区，1898 年就在苏特罗山脚下了。', 'UCSF\'s original campus — here below Mount Sutro since 1898.', 'point'),
  arrive('university-of-san-francisco', '旧金山大学到啦！1855 年建校，是城里的耶稣会大学。', 'USF! The city\'s Jesuit university, founded in 1855.', 'happy'),
  arrive('ccsf-ocean-campus', '城市学院到啦！它是旧金山唯一的社区学院，本市居民免学费。', 'City College! San Francisco\'s only community college — tuition-free for city residents.', 'happy'),
  arrive('ucsf-mission-bay', 'UCSF 米慎湾校区！这里是医院和实验室，我们安静走过。', 'UCSF Mission Bay! Hospitals and labs — let\'s walk through quietly.', 'thinking'),
  arrive('st-ignatius-church', '看那两座尖塔！圣依纳爵堂 1914 年落成，我们轻声参观。', 'Those twin spires! St Ignatius Church, finished in 1914 — let\'s visit quietly.', 'point'),
  // tier 2 · museums, parks, views
  arrive('cal-academy', '加州科学院！屋顶上种满了植物，足足 2.5 英亩。', 'The Cal Academy! Its living roof of plants covers 2.5 acres.', 'excited'),
  arrive('japanese-tea-garden', '日本茶园！它是美国最古老的公共日式庭园。', 'The Japanese Tea Garden — the oldest public Japanese garden in the US.', 'point'),
  arrive('sf-zoo', '动物园到啦！100 英亩的园子就挨着大海。', 'The Zoo! A hundred acres right by the ocean.', 'excited'),
  arrive('sfmoma', '现代艺术博物馆！后面那栋白色波浪楼是 2016 年加建的。', 'SFMOMA! The rippled white wing behind was added in 2016.', 'point'),
  arrive('dolores-park', '多洛雷斯公园！西南坡上看市中心天际线，跟明信片一样。', 'Dolores Park! The downtown skyline from the south-west slope is pure postcard.', 'happy'),
  arrive('haight-ashbury', '海特和阿什伯里的路口！1967 年的「爱之夏」就从这儿出名。', 'Haight and Ashbury! The 1967 Summer of Love made this corner famous.', 'excited'),
  arrive('lands-end', '天涯海角！沿着悬崖步道走，一路都能看到金门大桥。', 'Lands End! Follow the cliff trail — the Golden Gate Bridge stays in view.', 'happy'),
  arrive('ocean-beach', '海洋海滩！浪又大又急，我们只看不下水哦。', 'Ocean Beach! The surf is big and wild — we look, we don\'t swim.', 'happy'),
  arrive('yerba-buena-gardens', '芳草地花园！四周一圈都是博物馆，草坪随便坐。', 'Yerba Buena Gardens! Museums all round, and the lawn is for everyone.', 'happy'),
  arrive('salesforce-tower', '抬头看！Salesforce 大楼高 326 米，是旧金山最高的楼。', 'Look up! Salesforce Tower, 326 m, is the tallest building in San Francisco.', 'point'),
  arrive('transamerica-pyramid', '这座尖尖的泛美金字塔 1972 年建成，是天际线上最好认的楼。', 'The pointy Transamerica Pyramid, finished in 1972 — the skyline\'s easiest shape to spot.', 'point'),
  arrive('cable-car-museum', '叮当车博物馆！三条线的钢缆，全靠这里的大轮子拉着跑。', 'The Cable Car Museum! The big wheels here pull the cables of all three lines.', 'excited'),
  arrive('baker-beach', '贝克海滩！从这里低角度看金门大桥，最经典。', 'Baker Beach! The classic low-angle view of the Golden Gate Bridge.', 'excited'),
  arrive('bernal-heights-park', '伯纳尔山顶视野 360 度，全城天际线都在眼前！', 'Bernal Hill: 360 degrees, the whole skyline in front of you!', 'excited'),
  arrive('blue-heron-lake', '蓝鹭湖以前叫斯托湖，湖中间的小岛就是草莓山。', 'Blue Heron Lake used to be Stow Lake — the island in the middle is Strawberry Hill.', 'point'),
  arrive('corona-heights-randall-museum', '科罗娜高地的红岩山顶，看市中心特别近！', 'Corona Heights\' red-rock summit — downtown looks so close!', 'excited'),
  arrive('harvey-milk-plaza', '看那面大彩虹旗！路口的彩虹斑马线是 2014 年画上的。', 'That giant rainbow flag! The rainbow crosswalks went down in 2014.', 'excited'),
  arrive('lake-merced', '默塞德湖有 650 英亩，湖边一圈都是步道。', 'Lake Merced covers 650 acres, ringed by a walking path.', 'happy'),
  arrive('presidio-tunnel-tops', '隧道顶公园！脚下是公路隧道，眼前是金门大桥。', 'Tunnel Tops! Road tunnels underfoot, the Golden Gate Bridge ahead.', 'excited'),
  arrive('stern-grove', '斯特恩林的大树底下，每年夏天都有免费音乐会！', 'Under Stern Grove\'s tall trees, free concerts every summer!', 'happy'),
  arrive('salesforce-park', '空中公园！它建在公交中心的屋顶上，种了 600 棵树。', 'A park in the sky! It sits on the Transit Center roof with 600 trees.', 'excited'),
  // tier 2 · a memorial: quiet
  arrive('mount-davidson', '戴维森山 928 英尺，是旧金山天然的最高点。', 'Mount Davidson, 928 ft — the highest natural point in San Francisco.', 'thinking'),
]);

// ---------------------------------------------------------------------------------------------------------------
// Quiet lines: memorials and places of worship on or near the tour (said softly; no stamp fanfare)
// ---------------------------------------------------------------------------------------------------------------

export const QUIET_LINES: Readonly<Record<string, TourLine>> = Object.fromEntries([
  arrive('national-aids-memorial-grove', '这里是国家艾滋病纪念园，我们轻轻走过就好。', 'This is the National AIDS Memorial Grove. Let\'s walk softly.', 'thinking'),
  arrive('holy-virgin-cathedral', '那五个金色洋葱顶就是圣母大教堂，我们轻声走过。', 'Five golden onion domes: the Holy Virgin Cathedral. Let\'s pass quietly.', 'thinking'),
  arrive('saints-peter-and-paul-church', '北滩的白色双塔教堂，正对着华盛顿广场，我们轻声看看。', 'North Beach\'s white twin-spired church, facing Washington Square. Softly now.', 'thinking'),
  ['mission-dolores-cemetery', L('quiet-mission-dolores-cemetery', '传教站旁边的墓园是安息之地，我们小声一点。', 'The mission\'s cemetery is a resting place — let\'s keep our voices low.', 'thinking', 'https://www.missiondolores.org/')],
]);

// ---------------------------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------------------------

/** Every frozen line, in recording order (lane V's script). */
export const TOUR_LINES: readonly TourLine[] = [
  ...Object.values(LOOP_STOP_LINES).flatMap(s => [s.approach, s.arrive, s.hopOffTip]),
  ...Object.values(METRO_LINES),
  ...GRAND_CHAPTER_IDS.flatMap(id => [CHAPTER_LINES[id].intro, CHAPTER_LINES[id].outro]),
  ...Object.values(ARRIVAL_LINES),
  ...Object.values(QUIET_LINES),
];

/**
 * Lines added AFTER the freeze (part 2, 2026-09-27): a new wording is a new id, never new words for a frozen id.
 * Lane V records them as `<lang>-<id>`; until a clip exists they play as text bubbles (game/linePacer.ts sees no clip
 * and emits no voice). Snapshot-tested like TOUR_LINES (tests/opus-bay-sf-tours.test.ts TOUR_LINES_2_SNAPSHOT).
 */
export const TOUR_LINES_2_ADDED = '2026-09-27';
const SFSU_NEXT_2 = L('metro-sfsu-next-2', '下一站 Holloway，就是州立大学。', 'Next stop Holloway — that\'s SF State.', 'happy');
export const TOUR_LINES_2: readonly TourLine[] = [
  // replaces metro-sfsu-next ("下一站 Holloway，州立大学到了！" mixes 下一站 and 到了: lane C's review O2)
  SFSU_NEXT_2,
];

/** Recorded frozen lines no longer picked by the narration, and the id that replaced each. */
export const RETIRED_LINES: Readonly<Record<string, string>> = { 'metro-sfsu-next': SFSU_NEXT_2.id };

const BY_ID = new Map([...TOUR_LINES, ...TOUR_LINES_2].map(line => [line.id, line]));
/** A frozen or added tour line by id. */
export const tourLine = (id: string): TourLine | undefined => BY_ID.get(id);
export const tourLineText = (line: TourLine): Bilingual => ({ zh: line.zh, en: line.en });

/**
 * What a tour says, ready for the pacer (game/linePacer.ts `PacedLine`): a frozen / added line id → its text, voice id
 * and mood; a plain bubble → text only (mood `happy`). Null for an unknown id (never a silent voice id).
 */
export function sayLine(say: string | Bilingual, ttl?: number): { text: Bilingual; voice: string | null; mood: Mood; ttl?: number; key: string; repeatGap?: number } | null {
  if (typeof say !== 'string') return { text: { zh: say.zh, en: say.en }, voice: null, mood: 'happy', key: `text:${say.zh}`, ...(ttl !== undefined ? { ttl } : {}) };
  const line = BY_ID.get(say);
  if (!line) return null;
  return { text: tourLineText(line), voice: line.id, mood: line.mood, key: line.id, ...(ttl !== undefined ? { ttl } : {}) };
}

/**
 * The loop narration for a `transit` event on `sf-loop` (lane T emits `approach` ≈ 60 u before a stop and `arrive`
 * at the dwell, with `station` = the stop id): the line to say, or null (other lines / unknown stops / other whats).
 */
export function loopNarration(event: { what: string; line: string; station?: string }): TourLine | null {
  if (event.line !== 'sf-loop' || !event.station) return null;
  const s = LOOP_STOP_LINES[event.station];
  if (!s) return null;
  if (event.what === 'approach') return s.approach;
  if (event.what === 'arrive') return s.arrive;
  return null;
}

/** The hop-off hint of a loop stop (RideBanner / the hop-off chip), or null. */
export const loopHopOffTip = (station: string): TourLine | null => LOOP_STOP_LINES[station]?.hopOffTip ?? null;

/**
 * The Metro narration for a `transit` event on the N / M (lane T emits `board`, `approach` ≈ 60 u before a stop and
 * `arrive`, with `station` = the stop id; `dir` = the ride's direction along the line's arc, +1 = outbound from
 * Embarcadero). Null when BAYBAY has nothing to say there. The portal lines ("出隧道啦" / "前面是日落隧道") need the
 * direction: without `dir` (the frozen transit event has none until the lead adds it) she says nothing there rather
 * than guess — the Grand Tour rides the N and the M inbound, where the outbound words would be wrong.
 */
export function metroNarration(event: { what: string; line: string; station?: string; dir?: 1 | -1 }): TourLine | null {
  const { what, line, station, dir } = event;
  if (line !== 'n-judah' && line !== 'm-ocean-view') return null;
  if (what === 'board') return line === 'n-judah' ? METRO_LINES['board-n'] : METRO_LINES['board-m'];
  if (what === 'approach') {
    if (line === 'm-ocean-view' && station === 'muni-19th-winston') return METRO_LINES['stonestown-next'];
    if (line === 'm-ocean-view' && station === 'muni-19th-holloway') return SFSU_NEXT_2;
    if (line === 'n-judah' && station === 'muni-carl-hillway') return METRO_LINES['ucsf-window'];
    return null;
  }
  if (what !== 'arrive') return null;
  if (line === 'n-judah') {
    if (station === 'muni-9th-irving') return METRO_LINES['9th-irving'];
    if (station === 'muni-judah-la-playa') return METRO_LINES['la-playa'];
    if (station === 'muni-carl-cole') return dir === -1 ? METRO_LINES['sunset-tunnel'] : dir === 1 ? METRO_LINES['carl-cole'] : null;
    if (station === 'muni-duboce-church' && dir === 1) return METRO_LINES['duboce-portal'];
    return null;
  }
  if (station === 'muni-west-portal' && dir === 1) return METRO_LINES['west-portal'];
  if (station === 'muni-san-jose-geneva') return METRO_LINES['balboa-park'];
  return null;
}

/**
 * The line for the subway overlay (lane T's SubwayOverlay) when a ride goes under ground on the arc span
 * [fromAt, toAt] (either order): the Twin Peaks Tunnel on an M ride that passes between the Castro (661) and West Portal
 * (1164), else the Market Street subway. The short Sunset Tunnel says nothing itself: the arrive at Carl & Cole does
 * ("前面是日落隧道" inbound, "钻出日落隧道" outbound).
 */
export function tunnelNarration(line: string, fromAt: number, toAt: number): TourLine | null {
  const a = Math.min(fromAt, toAt), b = Math.max(fromAt, toAt);
  if (line === 'm-ocean-view') return a < 1100 && b > 700 ? METRO_LINES['twin-peaks-tunnel'] : METRO_LINES.subway;
  if (line === 'n-judah') return a < 516 ? METRO_LINES.subway : null;
  return null;
}
