import type { Bilingual, Vec2 } from '../../core/types';
import { bayNow, bayParts } from '../../game/bayNow';
import { halloweenPhase } from '../../halloween/season';
import { CALENDAR, type CalendarRow } from '../../realsf/calendar';

/**
 * Wave 9 · lane L · what the map search finds besides places: the games (R§5 #11 / lane L (1): "crab / 螃蟹 / 钓螃蟹,
 * claw / 抓娃娃 … land on the right game spot") and the season's events (万圣 / Halloween / 讨糖 → the trick-or-treat
 * streets and the Chinatown festival). Pure data, read by data/sf/placeSearch.ts `spotEntries` and the map list's rows.
 *
 * Every point is the game's own prompt (or the place BAYBAY offers it), copied from the play modules so that the map's
 * chunk does not pull them in — tests/opus-bay-w9-l-search.test.ts pins each one to its source constant:
 *
 *   claw / fortune / crab / sourdough   play/sfgames.ts CLAW_SPOT, FORTUNE_SPOT, CRAB_SPOT, DOUGH_SPOT
 *   foghorn / the two buskers           play/sfgames8.ts FOG_SPOT, buskAt(BUSK_HAIGHT | BUSK_MISSION)
 *   slides / stairs / sea lions / fire  play/zones.ts slidesIt, stairsIts (courseFoot); play/zones3.ts LION_SPOT, FIRE_RINGS[0]
 *   kite                                play/kiteZone.ts MARINA_STRIP (its middle): 问 BAYBAY → 放风筝 on the lawn
 *
 * `go` is what goTo() resolves first (an interactable id `play:…` registered in city mode, or an attraction id); the
 * point is the fallback. `ask` is the 问 BAYBAY item that starts it where it may be played anywhere (it runs at once when
 * the item is offered where the player stands). `where` is the small line under the name.
 */

export type SpotGroup = 'play' | 'event';

export interface SearchSpot {
  id: string;
  group: SpotGroup;
  name: Bilingual;
  where: Bilingual;
  aliases: readonly string[];
  /** where it is (absent: anywhere — only `ask`) */
  at?: Vec2;
  /** goTo's id: an interactable (`play:…`), an attraction or a place-index id */
  go?: string;
  /** the 问 BAYBAY item id that starts it (ui/slots registerAskItem) */
  ask?: string;
  /** the tie-break among equal scores (default 60): the calendar's dated rows 70 before the treat streets 50 */
  fame?: number;
}

const STAIR_WORDS = ['stairs', 'steps', 'stair race', 'race', '台阶', '爬台阶', '台阶赛跑', '赛跑', '爬楼梯', '比赛'];
const BUSK_WORDS = ['busker', 'buskers', 'busking', 'street musician', 'guitar', 'jam', 'music', '街头艺人', '卖艺', '弹吉他', '吉他', '合奏', '街头音乐'];

/** The games with a place (lane G's 游乐图鉴 lists all of them; these are the ones a search can take you to). */
export const PLAY_SPOTS: readonly SearchSpot[] = [
  { id: 'claw', group: 'play', name: { zh: '抓娃娃机', en: 'Claw machine' }, where: { zh: '机械博物馆 · 45 号码头', en: 'Musée Mécanique · Pier 45' },
    aliases: ['claw', 'claw machine', 'crane game', 'arcade', '抓娃娃', '夹娃娃', '娃娃机', '抓娃娃机', '夹娃娃机', '游戏机', '街机'], at: { x: -202.8, z: 71.8 }, go: 'play:claw' },
  { id: 'fortune', group: 'play', name: { zh: '算命婆婆', en: 'The fortune teller' }, where: { zh: '机械博物馆 · 45 号码头', en: 'Musée Mécanique · Pier 45' },
    aliases: ['fortune', 'fortune teller', 'fortune-teller', 'tarot', '算命', '算一卦', '算卦', '占卜', '运势'], at: { x: -199.4, z: 70.8 }, go: 'play:fortune' },
  { id: 'crab', group: 'play', name: { zh: '捞螃蟹', en: 'Crabbing' }, where: { zh: '7 号码头', en: 'Pier 7' },
    aliases: ['crab', 'crabs', 'crabbing', 'crab net', '螃蟹', '捞螃蟹', '钓螃蟹', '抓螃蟹', '蟹', '钓鱼码头'], at: { x: 73.6, z: -24.3 }, go: 'play:crab' },
  { id: 'sourdough', group: 'play', name: { zh: '捏酸面包', en: 'Shape a sourdough' }, where: { zh: '渔人码头的面包店', en: 'The Wharf’s bakery' },
    aliases: ['sourdough', 'bread', 'bakery', 'baking', 'bake', '酸面包', '面包', '捏面包', '做面包', '烤面包', '面包店'], at: { x: -193.4, z: 66.4 }, go: 'play:sourdough' },
  { id: 'foghorn', group: 'play', name: { zh: '雾笛对答', en: 'Foghorn call and answer' }, where: { zh: '金门大桥南端 · Fort Point', en: 'Fort Point, under the Golden Gate' },
    aliases: ['foghorn', 'foghorns', 'fog horn', 'fog', 'horn', '雾笛', '雾号', '号角', '雾', '汽笛'], at: { x: -743.71, z: 590.25 }, go: 'play:foghorn' },
  { id: 'busk-haight', group: 'play', name: { zh: '和街头艺人合奏', en: 'Jam with the busker' }, where: { zh: '海特街 · 阿什伯里街口', en: 'Haight & Ashbury' },
    aliases: [...BUSK_WORDS, 'tambourine', '铃鼓', 'haight'], at: { x: -36.97, z: 757.32 }, go: 'play:busk-haight' },
  { id: 'busk-mission', group: 'play', name: { zh: '和街头艺人合奏', en: 'Jam with the busker' }, where: { zh: '24 街 · Balmy 巷旁', en: '24th St by Balmy Alley' },
    aliases: [...BUSK_WORDS, 'maracas', '沙锤', 'mission'], at: { x: 455, z: 636.47 }, go: 'play:busk-mission' },
  { id: 'kite', group: 'play', name: { zh: '放风筝', en: 'Kite flying' }, where: { zh: '码头绿地 · 到了问 BAYBAY', en: 'Marina Green · then ask BAYBAY' },
    aliases: ['kite', 'kites', 'kite flying', 'fly a kite', '风筝', '放风筝'], at: { x: -381.95, z: 300.85 }, ask: 'play-kite' },
  { id: 'slides', group: 'play', name: { zh: '纸板滑梯', en: 'Cardboard slides' }, where: { zh: 'Seward 街小公园', en: 'Seward Mini Park' },
    aliases: ['slide', 'slides', 'cardboard', '滑梯', '纸板', '滑滑梯'], at: { x: 154.34, z: 838.5 }, go: 'play:slides' },
  { id: 'stairs-filbert', group: 'play', name: { zh: '和 BAYBAY 比爬台阶', en: 'Race BAYBAY up the steps' }, where: { zh: '菲尔伯特台阶 → 科伊特塔', en: 'Filbert Steps → Coit Tower' },
    aliases: [...STAIR_WORDS, 'filbert'], at: { x: -23.5, z: 24.5 }, go: 'play:stairs:filbert' },
  { id: 'stairs-tiled', group: 'play', name: { zh: '和 BAYBAY 比爬台阶', en: 'Race BAYBAY up the steps' }, where: { zh: '16 街马赛克阶梯', en: '16th Avenue Tiled Steps' },
    aliases: [...STAIR_WORDS, '马赛克'], at: { x: -117, z: 1147.5 }, go: 'play:stairs:tiled' },
  { id: 'stairs-lyon', group: 'play', name: { zh: '和 BAYBAY 比爬台阶', en: 'Race BAYBAY up the steps' }, where: { zh: '里昂街台阶', en: 'Lyon Street Steps' },
    aliases: [...STAIR_WORDS, 'lyon'], at: { x: -312.49, z: 498.05 }, go: 'play:stairs:lyon' },
  { id: 'sealions', group: 'play', name: { zh: '数海狮', en: 'Count the sea lions' }, where: { zh: '39 号码头 · K 码头', en: 'PIER 39 · K-Dock' },
    aliases: ['sea lion', 'sea lions', 'count', '海狮', '数海狮'], at: { x: -202.94, z: -0.47 }, go: 'play:sealions' },
  { id: 'marshmallow', group: 'play', name: { zh: '烤棉花糖', en: 'Toast marshmallows' }, where: { zh: '海洋海滩的篝火圈', en: 'Ocean Beach fire rings' },
    aliases: ['marshmallow', 'marshmallows', 'bonfire', 'fire', 'fire ring', 'fire rings', 'smores', '棉花糖', '烤棉花糖', '篝火', '生火', '营火'], at: { x: -579.74, z: 1345.95 }, go: 'play:fire:1' },
  { id: 'cable-car', group: 'play', name: { zh: '叮当车摇铃 · 拉闸', en: 'Ring the cable-car bell · work the grip' }, where: { zh: '鲍威尔街叮当车上', en: 'On a Powell St cable car' },
    aliases: ['bell', 'cable car bell', 'grip', 'gripman', '摇铃', '敲铃', '拉闸', '铃铛'], go: 'cable-car-powell-market' },
  { id: 'turntable', group: 'play', name: { zh: '嘿咻推转盘', en: 'Heave-ho turntable' }, where: { zh: '鲍威尔街 · 市场街转车台', en: 'Powell & Market turntable' },
    aliases: ['turntable', 'heave', 'heave-ho', 'push', '推转盘', '转盘', '嘿咻', '推车'], go: 'cable-car-powell-market' },
  { id: 'frisbee', group: 'play', name: { zh: '和 BAYBAY 玩飞盘', en: 'Frisbee with BAYBAY' }, where: { zh: '草坪或沙滩上问 BAYBAY', en: 'On a lawn or a beach, ask BAYBAY' },
    aliases: ['frisbee', 'disc', '飞盘'], go: 'dolores-park', ask: 'play-frisbee' },
  { id: 'beachball', group: 'play', name: { zh: '颠沙滩球', en: 'Beach-ball rally' }, where: { zh: '沙滩上问 BAYBAY', en: 'On the sand, ask BAYBAY' },
    aliases: ['beach ball', 'ball', 'volleyball', '沙滩球', '排球', '颠球'], go: 'ocean-beach', ask: 'play-ball' },
  { id: 'skyline', group: 'play', name: { zh: '那是什么？', en: 'What’s that?' }, where: { zh: '有风景的地方问 BAYBAY', en: 'Anywhere with a view, ask BAYBAY' },
    aliases: ['quiz', 'what is that', 'whats that', 'landmark quiz', 'skyline', '那是什么', '猜地标', '问答', '考考我'], go: 'twin-peaks', ask: 'play-skyline' },
  // (W9-L7) the games of lane G's 游乐图鉴 that had no search row (ui/playDexData.ts DEX_GAMES: sled, crests, crooked,
  // ggb-rings; their points are the dex's own, pinned by the test). Never named after the landmark they sit by, so 金门 /
  // Golden Gate / 九曲花街 still answer the landmark first.
  { id: 'sled', group: 'play', name: { zh: '纸板滑草', en: 'Cardboard grass slide' }, where: { zh: '多洛雷斯公园的陡草坡', en: 'Dolores Park’s steep lawn' },
    aliases: ['sled', 'sledding', 'grass sled', 'grass slide', 'cardboard sled', '滑草', '纸板滑草', '草坡', '坐纸板'], at: { x: 240, z: 696 } },
  { id: 'crests', group: 'play', name: { zh: '坡顶飞跃', en: 'Crest hops' }, where: { zh: '全城 12 个插小旗的坡顶 · 骑车或开车', en: 'Twelve pennanted crests · on the bike or the toy car' },
    aliases: ['crest', 'crests', 'crest hop', 'jump', 'hill jump', 'bike jump', '坡顶', '飞跃', '冲坡', '小旗', '骑车飞'], at: { x: -154.2, z: 240.4 } },
  { id: 'crooked', group: 'play', name: { zh: '慢慢开下弯弯街', en: 'Gently down a crooked street' }, where: { zh: '九曲花街坡顶 · 骑车或开车', en: 'The top of Lombard St · on the bike or the toy car' },
    aliases: ['crooked ride', 'gently down', 'speed sign', 'slowly', '慢慢开', '弯弯街', '开下坡', '限速'], at: { x: -163.02, z: 177.29 } },
  { id: 'ggb-rings', group: 'play', name: { zh: '鹈鹕穿金圈', en: 'Pelican ring run' }, where: { zh: '金门大桥上空 · 骑鹈鹕（G）', en: 'Over the Golden Gate · on the pelican (G)' },
    aliases: ['rings', 'ring run', 'pelican', 'flying', 'fly', '金圈', '穿圈', '鹈鹕', '飞行', '骑鹈鹕'], go: 'golden-gate-bridge' },
  { id: 'hide-seek', group: 'play', name: { zh: '捉迷藏', en: 'Hide & seek' }, where: { zh: '问 BAYBAY（Q）就能玩', en: 'Ask BAYBAY (Q) to play' },
    aliases: ['hide and seek', 'hide & seek', 'hide-and-seek', 'hide', '捉迷藏', '躲猫猫', '藏起来'], ask: 'play-hide-seek' },
];

/**
 * The six trick-or-treat streets (halloween/treatStreets.ts TREAT_STREETS; each point = the street's first door's knock
 * spot, halloween/treatDoors.ts, pinned by the test): searchable while the Halloween season runs (1–31 October).
 */
const TREAT_WORDS = ['讨糖', '万圣', '万圣节', '讨糖街', '不给糖就捣蛋', '南瓜', 'halloween', 'trick or treat', 'trick-or-treat', 'trick or treating', 'candy', 'treats'];
export const TREAT_SPOTS: readonly SearchSpot[] = [
  { id: 'treat-belvedere', group: 'event', fame: 50, name: { zh: '万圣节讨糖 · 贝尔维德街', en: 'Trick-or-treat · Belvedere St' }, where: { zh: '科尔谷', en: 'Cole Valley' }, aliases: [...TREAT_WORDS, 'belvedere'], at: { x: 54.59, z: 860.83 } },
  { id: 'treat-chenery', group: 'event', fame: 50, name: { zh: '万圣节讨糖 · Chenery 街', en: 'Trick-or-treat · Chenery St' }, where: { zh: '格伦公园', en: 'Glen Park' }, aliases: [...TREAT_WORDS, 'chenery'], at: { x: 427.72, z: 1049.82 } },
  { id: 'treat-fair-oaks', group: 'event', fame: 50, name: { zh: '万圣节讨糖 · Fair Oaks 街', en: 'Trick-or-treat · Fair Oaks St' }, where: { zh: '诺伊谷', en: 'Noe Valley' }, aliases: [...TREAT_WORDS, 'fair oaks'], at: { x: 365.87, z: 755.58 } },
  { id: 'treat-jordan', group: 'event', fame: 50, name: { zh: '万圣节讨糖 · Jordan 大道', en: 'Trick-or-treat · Jordan Ave' }, where: { zh: '乔丹公园', en: 'Jordan Park' }, aliases: [...TREAT_WORDS, 'jordan'], at: { x: -259.84, z: 721.23 } },
  { id: 'treat-sea-cliff', group: 'event', fame: 50, name: { zh: '万圣节讨糖 · 海崖大道', en: 'Trick-or-treat · Sea Cliff Ave' }, where: { zh: '海崖区', en: 'Sea Cliff' }, aliases: [...TREAT_WORDS, 'sea cliff'], at: { x: -576.86, z: 900.85 } },
  { id: 'treat-hearst', group: 'event', fame: 50, name: { zh: '万圣节讨糖 · Hearst 大道', en: 'Trick-or-treat · Hearst Ave' }, where: { zh: '阳光谷', en: 'Sunnyside' }, aliases: [...TREAT_WORDS, 'hearst'], at: { x: 363.62, z: 1217.48 } },
];

/** A calendar row's words: its own title plus the season's (万圣 / Halloween for the festival and the night). */
const CALENDAR_WORDS: Readonly<Record<string, readonly string[]>> = {
  'halloween-2026': ['万圣', '万圣夜', '万圣节夜', 'halloween night', 'trick or treat', '讨糖', '南瓜灯'],
  'chinatown-halloween-festival-2026': ['万圣', '万圣节', 'halloween', '唐人街万圣节', '庆典', 'festival', 'waverly', '变装', 'costume contest'],
  'dia-de-los-muertos-2026': ['亡灵节', 'muertos', 'day of the dead', 'dia de los muertos', '游行', 'procession'],
  'fleet-week-parade-of-ships-2026': ['舰队周', 'fleet week', '舰船', '巡游', 'parade of ships', 'ships'],
  'fleet-week-blue-angels-2026': ['舰队周', 'fleet week', '蓝天使', 'blue angels', '飞行表演', 'air show', 'airshow'],
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-10-31' → 10 月 31 日 / 31 Oct (a span: 10 月 9–11 日 / 9–11 Oct). */
export function dateWords(from: string, to: string): Bilingual {
  const [, m1, d1] = from.split('-').map(Number), [, m2, d2] = to.split('-').map(Number);
  if (from === to) return { zh: `${m1} 月 ${d1} 日`, en: `${d1} ${MONTHS[m1 - 1]}` };
  if (m1 === m2) return { zh: `${m1} 月 ${d1}–${d2} 日`, en: `${d1}–${d2} ${MONTHS[m1 - 1]}` };
  return { zh: `${m1} 月 ${d1} 日–${m2} 月 ${d2} 日`, en: `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]}` };
}

/** Calendar rows ahead (visible, not over, starting within `days`) with a place to go: one event spot each. */
export function calendarSpots(dateKey: string, days = 60, rows: readonly CalendarRow[] = CALENDAR): SearchSpot[] {
  const end = new Date(Date.parse(`${dateKey}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  return rows.filter(r => !r.hidden && !r.later && r.to >= dateKey && r.from <= end && (r.xz || r.placeId)).map(r => {
    const when = dateWords(r.from, r.to);
    return {
      id: `cal:${r.id}`, group: 'event', name: r.title, fame: 70, where: { zh: `${when.zh} · ${r.where.zh}`, en: `${when.en} · ${r.where.en}` },
      aliases: CALENDAR_WORDS[r.id] ?? [], ...(r.xz ? { at: r.xz } : {}), ...(r.placeId ? { go: r.placeId } : {}),
    };
  });
}

/** Everything the search adds now (Bay date): the games, the season's streets while it runs, the calendar ahead. */
export function searchSpots(now: Date = bayNow()): SearchSpot[] {
  const phase = halloweenPhase(now);
  return [...PLAY_SPOTS, ...(phase === 'season' || phase === 'night' ? TREAT_SPOTS : []), ...calendarSpots(bayParts(now).dateKey)];
}
