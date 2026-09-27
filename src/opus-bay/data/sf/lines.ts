import type { Bilingual, Mood } from '../../core/types';

/**
 * BAYBAY's city lines (lane G2, plan G2-4). Data only (type imports): game/baybayLines.ts schedules them, lane H2b
 * records them, lane F reads nothing here (its hooks are dialogue nodes in data/script.ts).
 *
 *   BARK_SCRIPT          the recording script: one short phrase per line id, ≤ 2 s spoken, zh + en. A bubble that
 *                        speaks a line STARTS with its phrase (the rest of the bubble is text only), and the game emits
 *                        `{ type: 'voice-line', id }` next to it: audio plays the clip `<lang>-<id>` when H2b lists it in
 *                        data/voiceLinesSf.ts, else a chirp.
 *   EVENT_LINES          what BAYBAY says when something happens (first bike / car, hard bump, first hill, crest hop,
 *                        glide start / land / no landing, pant, stairs, cable-car bell and first ride, turntable push,
 *                        ferry, F-line): the first entry of a list is said once per save, the next one (if any) repeats.
 *   NEIGHBOURHOOD_LINES  the first arrival in a DataSF neighbourhood (far.zones id); any other neighbourhood gets
 *                        neighbourhoodGreeting(name).
 *
 * Voice and glossary: data/VOICE.md ("City lines"). Facts carry a source and the date they were checked.
 */

export interface BarkLine {
  /** voice-line id (clip `<lang>-<id>`) */
  id: string;
  /** the spoken phrase; ≤ 2 s */
  zh: string;
  en: string;
  mood: Mood;
}

/** Where a fact in a line comes from (checked on the web on `verifiedAt`). */
export interface LineSource { url: string; verifiedAt: string }

const V = '2026-09-27';
const src = (url: string): LineSource => ({ url, verifiedAt: V });

// ---------------------------------------------------------------------------------------------------------------
// BARK_SCRIPT — FROZEN (wave 3, 2026-09-27). Ids and phrases never change once recorded: a new wording is a new id.
// ---------------------------------------------------------------------------------------------------------------

/**
 * Recorded by lane H2b (commit a2dbfe4, data/voiceLinesSf.ts SF_VOICE_LINES): exactly those phrases (tested).
 * 8 firsts (once per save) and 12 neighbourhood greetings on real far.zones ids.
 */
export const BARK_SCRIPT_RECORDED: readonly BarkLine[] = [
  { id: 'first-bike', zh: '骑车出发！', en: 'Bike time!', mood: 'excited' },
  { id: 'first-car', zh: '开车兜风咯！', en: "Let's go for a drive!", mood: 'excited' },
  { id: 'first-cable-car', zh: '坐上叮当车啦！', en: 'Cable car! Ding ding!', mood: 'excited' },
  { id: 'first-streetcar', zh: '坐老电车咯！', en: 'All aboard the streetcar!', mood: 'happy' },
  { id: 'first-ferry', zh: '开船啦！', en: 'All aboard the ferry!', mood: 'excited' },
  { id: 'first-glide', zh: '抓稳，飞咯！', en: "Hold on, we're flying!", mood: 'excited' },
  { id: 'first-hill', zh: '呼…这坡好陡！', en: 'Phew, what a hill!', mood: 'happy' },
  { id: 'first-crest', zh: '哇，飞过坡顶！', en: 'Whee, over the top!', mood: 'excited' },
  { id: 'zone-chinatown', zh: '你好，唐人街！', en: 'Hello, Chinatown!', mood: 'wave' },
  { id: 'zone-north-beach', zh: '你好，北滩！', en: 'Hello, North Beach!', mood: 'wave' },
  { id: 'zone-mission', zh: '你好，教会区！', en: 'Hello, the Mission!', mood: 'wave' },
  { id: 'zone-castro-upper-market', zh: '你好，卡斯特罗！', en: 'Hello, the Castro!', mood: 'wave' },
  { id: 'zone-haight-ashbury', zh: '你好，海特街！', en: 'Hello, Haight-Ashbury!', mood: 'wave' },
  { id: 'zone-marina', zh: '你好，马里纳区！', en: 'Hello, the Marina!', mood: 'wave' },
  { id: 'zone-twin-peaks', zh: '登上双峰啦！', en: 'Twin Peaks — we made it!', mood: 'proud' },
  { id: 'zone-golden-gate-park', zh: '你好，金门公园！', en: 'Hello, Golden Gate Park!', mood: 'wave' },
  { id: 'zone-financial-district-south-beach', zh: '你好，金融区！', en: 'Hello, downtown!', mood: 'wave' },
  { id: 'zone-presidio', zh: '你好，要塞公园！', en: 'Hello, the Presidio!', mood: 'wave' },
  { id: 'zone-nob-hill', zh: '你好，诺布山！', en: 'Hello, Nob Hill!', mood: 'wave' },
  { id: 'zone-sunset-parkside', zh: '你好，日落区！', en: 'Hello, the Sunset!', mood: 'wave' },
];

/**
 * The later block (written after H2b's first recording pass). H2b recorded it the same day, word for word, as
 * data/voiceLinesSf.ts SF_VOICE_EXTRA (commit e60eec4; its clips are in SF_VOICE_CLIPS, so they play). The two blocks
 * stay apart until the lead merges SF_VOICE_EXTRA into SF_VOICE_LINES (H2b's request 1; then they preload too): H2b's
 * test pins this block to SF_VOICE_EXTRA. A line without a clip would still be a bubble with a chirp.
 */
export const BARK_SCRIPT_TODO: readonly BarkLine[] = [
  // reactions (repeat, 60 s per key)
  { id: 'bump-hard', zh: '哎呀！', en: 'Oops!', mood: 'thinking' },
  { id: 'stairs', zh: '楼梯上不去！', en: 'No stairs on wheels!', mood: 'thinking' },
  { id: 'pant', zh: '呼…歇口气！', en: 'Phew, catch your breath!', mood: 'happy' },
  { id: 'crest-again', zh: '再飞一个！', en: 'Wheee, again!', mood: 'excited' },
  { id: 'glide-again', zh: '起飞！', en: 'Up we go!', mood: 'excited' },
  { id: 'glide-land', zh: '安全降落！', en: 'Safe landing!', mood: 'proud' },
  { id: 'glide-no-landing', zh: '这儿降落不了！', en: "Can't land here!", mood: 'thinking' },
  // transit
  { id: 'cable-bell', zh: '叮叮！叮当车来啦！', en: 'Ding ding! A cable car!', mood: 'excited' },
  { id: 'turntable-push', zh: '一起推！嘿咻！', en: 'Push together! Heave!', mood: 'excited' },
  // neighbourhoods without a recorded greeting yet, and the template's opener
  { id: 'zone-new', zh: '新街区！', en: 'New neighbourhood!', mood: 'wave' },
  { id: 'zone-hayes-valley', zh: '你好，海斯谷！', en: 'Hello, Hayes Valley!', mood: 'wave' },
  { id: 'zone-japantown', zh: '你好，日本城！', en: 'Hello, Japantown!', mood: 'wave' },
  { id: 'zone-russian-hill', zh: '你好，俄罗斯山！', en: 'Hello, Russian Hill!', mood: 'wave' },
  { id: 'zone-south-of-market', zh: '你好，南市场！', en: 'Hello, SoMa!', mood: 'wave' },
  { id: 'zone-potrero-hill', zh: '你好，波特雷罗山！', en: 'Hello, Potrero Hill!', mood: 'wave' },
  { id: 'zone-lincoln-park', zh: '你好，林肯公园！', en: 'Hello, Lincoln Park!', mood: 'wave' },
  { id: 'zone-mission-bay', zh: '你好，米慎湾！', en: 'Hello, Mission Bay!', mood: 'wave' },
  { id: 'zone-outer-richmond', zh: '你好，外列治文！', en: 'Hello, the Outer Richmond!', mood: 'wave' },
];

/** The whole script (recorded first). */
export const BARK_SCRIPT: readonly BarkLine[] = [...BARK_SCRIPT_RECORDED, ...BARK_SCRIPT_TODO];
export const barkLine = (id: string): BarkLine | undefined => BARK_SCRIPT.find(line => line.id === id);

// ---------------------------------------------------------------------------------------------------------------
// Event lines
// ---------------------------------------------------------------------------------------------------------------

/** Game moments BAYBAY reacts to (game/baybayLines.ts maps core events onto them). */
export type LineEvent =
  | 'bike' | 'car' | 'bump' | 'hill' | 'crest' | 'glide' | 'glide-land' | 'glide-no-landing' | 'pant' | 'stairs'
  | 'cable-bell' | 'cable-ride' | 'push' | 'ferry' | 'fline';

/** BAYBAY's little gesture with a line (runtime Emote; only while she walks beside you). */
export type LineEmote = 'wave' | 'point' | 'hop' | 'clap' | 'shrug' | 'think';

export interface SpokenLine {
  /** cooldown key and line-memory key (a `once` line is said once per save) */
  key: string;
  /** BARK_SCRIPT id: the text starts with its phrase and a `voice-line` event goes with the bubble */
  voice: string;
  text: Bilingual;
  once?: boolean;
  /** seconds between two of this key (default 60) */
  cooldown?: number;
  /** how long the line may wait for a free moment (s); a reaction is stale fast, a first is worth waiting for */
  ttl: number;
  /** higher plays first when several wait */
  priority: number;
  /** seconds to wait before speaking (the glide lines let audio's take-off "wow" finish first) */
  after?: number;
  emote?: LineEmote;
  source?: LineSource;
}

const REACT = { ttl: 3, priority: 1 } as const;
const FIRST = { once: true, ttl: 12, priority: 3 } as const;

/**
 * Per event: the first line whose `once` key is not in the save's line memory (a list is "first time, then …");
 * nothing when every entry is a spent `once`. Texts start with their BARK_SCRIPT phrase (tested), zh ≤ 45.
 */
export const EVENT_LINES: Record<LineEvent, readonly SpokenLine[]> = {
  bike: [{ key: 'first-bike', voice: 'first-bike', ...FIRST, emote: 'hop', text: { zh: '骑车出发！我坐前面的篮子～', en: "Bike time! I'll ride in the basket~" } }],
  car: [{ key: 'first-car', voice: 'first-car', ...FIRST, emote: 'hop', text: { zh: '开车兜风咯！系好安全带～', en: "Let's go for a drive! Buckle up~" } }],
  // hard bumps only (vehicle:bump with hard: true); soft ones are just a sound
  bump: [{ key: 'bump', voice: 'bump-hard', ...REACT, emote: 'shrug', text: { zh: '哎呀！慢点慢点～', en: 'Oops! Easy does it~' } }],
  hill: [{ key: 'first-hill', voice: 'first-hill', ...FIRST, emote: 'point', text: { zh: '呼…这坡好陡！旧金山的坡就是这样～', en: "Phew, what a hill! That's San Francisco for you~" } }],
  crest: [
    { key: 'first-crest', voice: 'first-crest', ...FIRST, ttl: 4, text: { zh: '哇，飞过坡顶！', en: 'Whee, over the top!' } },
    { key: 'crest', voice: 'crest-again', ...REACT, cooldown: 180, text: { zh: '再飞一个！抓稳咯～', en: 'Wheee, again! Hold on~' } },
  ],
  glide: [
    { key: 'first-glide', voice: 'first-glide', ...FIRST, ttl: 6, after: 0.9, text: { zh: '抓稳，飞咯！整座城都在下面～', en: "Hold on, we're flying! The whole city's below us~" } },
    { key: 'glide', voice: 'glide-again', ...REACT, cooldown: 120, after: 0.9, text: { zh: '起飞！想飞去哪儿？', en: 'Up we go! Where to?' } },
  ],
  'glide-land': [{ key: 'glide-land', voice: 'glide-land', ...REACT, emote: 'clap', text: { zh: '安全降落！', en: 'Safe landing!' } }],
  'glide-no-landing': [{ key: 'glide-no-landing', voice: 'glide-no-landing', ...REACT, priority: 2, text: { zh: '这儿降落不了！再往前飞一点～', en: "Can't land here! Fly on a little~" } }],
  pant: [{ key: 'pant', voice: 'pant', ...REACT, emote: 'think', text: { zh: '呼…歇口气！风景又不会跑～', en: "Phew, catch your breath! The view isn't going anywhere~" } }],
  stairs: [{ key: 'stairs', voice: 'stairs', ...REACT, emote: 'point', text: { zh: '楼梯上不去！下车走上去吧～', en: 'No stairs on wheels! Hop off and walk up~' } }],
  // a car rings nearby while you are on foot: the first time, the fact
  'cable-bell': [{
    key: 'cable-bell', voice: 'cable-bell', ...FIRST, emote: 'point',
    text: { zh: '叮叮！叮当车来啦！全世界只剩这里的还靠人手开。', en: "Ding ding! A cable car! The world's last hand-operated ones." },
    source: src('https://en.wikipedia.org/wiki/San_Francisco_cable_car_system'),
  }],
  // your car pulls away from the stop
  'cable-ride': [{
    key: 'first-cable-car', voice: 'first-cable-car', ...FIRST, emote: 'hop',
    text: { zh: '坐上叮当车啦！1873 年，第一条线就在旧金山开通。', en: "Cable car! Ding ding! San Francisco's first line opened in 1873." },
    source: src('https://en.wikipedia.org/wiki/San_Francisco_cable_car_system'),
  }],
  push: [{ key: 'turntable-push', voice: 'turntable-push', ...REACT, emote: 'clap', text: { zh: '一起推！嘿咻！', en: 'Push together! Heave!' } }],
  ferry: [{ key: 'first-ferry', voice: 'first-ferry', ...FIRST, emote: 'hop', text: { zh: '开船啦！海风吹着好舒服～', en: 'All aboard the ferry! Feel that sea breeze~' } }],
  fline: [{ key: 'first-streetcar', voice: 'first-streetcar', ...FIRST, emote: 'hop', text: { zh: '坐老电车咯！叮叮～', en: 'All aboard the streetcar! Ding ding~' } }],
};

// ---------------------------------------------------------------------------------------------------------------
// Neighbourhood lines (the first arrival in a far.zones neighbourhood, once per save)
// ---------------------------------------------------------------------------------------------------------------

export interface NeighbourhoodLine {
  /** far.zones id (DataSF analysis neighbourhood) */
  zone: string;
  voice: string;
  text: Bilingual;
  /** only near this landmark (the Twin Peaks greeting waits for the summit, not the zone's lower edge) */
  near?: { landmark: string; r: number };
  source?: LineSource;
}

const hood = (zone: string, zh: string, en: string, url?: string, near?: NeighbourhoodLine['near']): NeighbourhoodLine => ({
  zone, voice: `zone-${zone}`, text: { zh, en }, ...(near ? { near } : {}), ...(url ? { source: src(url) } : {}),
});

export const NEIGHBOURHOOD_LINES: readonly NeighbourhoodLine[] = [
  // recorded greetings (H2b)
  hood('chinatown', '你好，唐人街！它是北美最老的唐人街。', 'Hello, Chinatown! The oldest Chinatown in North America.', 'https://en.wikipedia.org/wiki/Chinatown,_San_Francisco'),
  hood('north-beach', '你好，北滩！这里是旧金山的「小意大利」。', "Hello, North Beach! This is San Francisco's Little Italy.", 'https://en.wikipedia.org/wiki/North_Beach,_San_Francisco'),
  hood('mission', '你好，教会区！街区名来自 1776 年建的多洛雷斯传教站。', "Hello, the Mission! It's named for the mission founded here in 1776.", 'https://en.wikipedia.org/wiki/Mission_District,_San_Francisco'),
  hood('castro-upper-market', '你好，卡斯特罗！路口那面超大的彩虹旗是这里的地标。', "Hello, the Castro! That giant rainbow flag is the neighbourhood's icon.", 'https://en.wikipedia.org/wiki/Castro_District,_San_Francisco'),
  hood('haight-ashbury', '你好，海特街！街区名来自 Haight 和 Ashbury 两条街的路口。', "Hello, Haight-Ashbury! It's named for the corner of Haight and Ashbury streets.", 'https://en.wikipedia.org/wiki/Haight-Ashbury'),
  hood('marina', '你好，马里纳区！1915 年的世博会就在这儿办的。', "Hello, the Marina! The 1915 world's fair was held right here.", 'https://en.wikipedia.org/wiki/Marina_District,_San_Francisco'),
  hood('twin-peaks', '登上双峰啦！整座城都在脚下～', 'Twin Peaks — we made it! The whole city at our feet~', undefined, { landmark: 'twin-peaks', r: 45 }),
  hood('golden-gate-park', '你好，金门公园！约 1017 英亩，是全城最大的公园。', "Hello, Golden Gate Park! About 1,017 acres — the city's biggest park.", 'https://sfrecpark.org/770/Golden-Gate-Park'),
  hood('financial-district-south-beach', '你好，金融区！尖尖的泛美金字塔 1972 年建成。', 'Hello, downtown! The pointy Transamerica Pyramid was finished in 1972.', 'https://en.wikipedia.org/wiki/Transamerica_Pyramid'),
  hood('presidio', '你好，要塞公园！这里当了 218 年军营，现在是国家公园。', 'Hello, the Presidio! An army post for 218 years, now a national park.', 'https://www.nps.gov/prsf/index.htm'),
  hood('nob-hill', '你好，诺布山！山名来自当年住在山顶的铁路富豪。', "Hello, Nob Hill! It's named for the railroad tycoons who built mansions up top.", 'https://en.wikipedia.org/wiki/Nob_Hill,_San_Francisco'),
  hood('sunset-parkside', '你好，日落区！挨着大海，Karl 最爱来这儿。', "Hello, the Sunset! Right by the ocean — Karl the Fog's favourite spot.", 'https://en.wikipedia.org/wiki/Sunset_District,_San_Francisco'),
  // greetings of the later block (BARK_SCRIPT_TODO, recorded by H2b as SF_VOICE_EXTRA)
  hood('hayes-valley', '你好，海斯谷！1989 年地震后拆了高架路，才有这条林荫大道。', 'Hello, Hayes Valley! A quake-damaged freeway came down, and a tree-lined boulevard went in.', 'https://en.wikipedia.org/wiki/Hayes_Valley,_San_Francisco'),
  hood('japantown', '你好，日本城！五层的和平塔是大阪人民送的礼物。', 'Hello, Japantown! The five-tiered Peace Pagoda was a gift from the people of Osaka.', 'https://en.wikipedia.org/wiki/Japantown,_San_Francisco'),
  hood('russian-hill', '你好，俄罗斯山！九曲花街就在这座山上，一共八个急弯。', 'Hello, Russian Hill! The crooked block of Lombard Street is up here: eight sharp turns.', 'https://en.wikipedia.org/wiki/Russian_Hill,_San_Francisco'),
  hood('south-of-market', '你好，南市场！大家叫它 SoMa，现代艺术博物馆就在这儿。', 'Hello, SoMa! SFMOMA, the modern art museum, is right here.', 'https://en.wikipedia.org/wiki/South_of_Market,_San_Francisco'),
  hood('potrero-hill', '你好，波特雷罗山！这里是全城阳光最好的街区之一。', 'Hello, Potrero Hill! One of the sunniest neighbourhoods in the city.', 'https://en.wikipedia.org/wiki/Potrero_Hill,_San_Francisco'),
  hood('lincoln-park', '你好，林肯公园！荣勋宫美术馆就在公园里。', 'Hello, Lincoln Park! The Legion of Honor museum is right inside the park.', 'https://en.wikipedia.org/wiki/Lincoln_Park_(San_Francisco)'),
  hood('mission-bay', '你好，米慎湾！勇士队的大通中心 2019 年在这里开馆。', "Hello, Mission Bay! The Warriors' Chase Center opened here in 2019.", 'https://en.wikipedia.org/wiki/Chase_Center'),
  hood('outer-richmond', '你好，外列治文！海边的苏特罗浴场，1896 年开张。', 'Hello, the Outer Richmond! The Sutro Baths by the sea opened in 1896.', 'https://en.wikipedia.org/wiki/Sutro_Baths'),
];

export const neighbourhoodLine = (zone: string): NeighbourhoodLine | undefined => NEIGHBOURHOOD_LINES.find(line => line.zone === zone);

/** Any other neighbourhood: the zone's HUD name (far.zones zh / en) after the recorded-later opener "新街区！". */
export function neighbourhoodGreeting(zone: string, name: Bilingual): NeighbourhoodLine {
  return { zone, voice: 'zone-new', text: { zh: `新街区！这里是${name.zh}～`, en: `New neighbourhood! This is ${name.en}.` } };
}

/** How long a bubble stays up for a text (ms): time to read the longer language, 2.6–5.6 s. */
export function lineMs(text: Bilingual): number {
  const zh = [...text.zh].length, en = text.en.length;
  return Math.round(Math.min(5600, Math.max(2600, 1400 + Math.max(zh * 110, en * 42))));
}
