import type { MonthlyEvent } from '../data/monthly-types';
import type { TimeWindow } from './planner-core';
import { isFreeToAttend } from './monthly';

/**
 * 长辈友好 (H06 / HOMEIA13-01): which events an adult child can bring a parent to, read from facts the record states — the
 * audience line, the title, the venue, the price and the session times. Nothing is guessed from a photo. The home circle
 * (its weekend count is computed at build time, scripts/generate-home-catalog.ts) and the /events story chip share this
 * rule, so the circle never opens an empty list the chip would hide.
 *
 * An event qualifies when it names seniors, or — when it is neither 21+ nor a children's program, and not evening-only —
 * when it is accessible (无障碍, wheelchair, adaptive), in Chinese (中文, 普通话, 粤语 …), at a library, or a free daytime
 * event for everyone (全龄, 社区居民, 邻里 …).
 */
export type SeniorFriendlyInput = {
  title: string;
  aliases?: readonly string[];
  audience: readonly string[];
  venue?: string;
  cost: MonthlyEvent['cost'];
  costLabel?: string;
  sessions?: readonly { date: string; start?: string }[];
  planning?: {
    minAge?: number | null;
    schedule?: { weekly?: Partial<Record<number, readonly TimeWindow[]>>; dates?: Record<string, readonly TimeWindow[]>; sessions?: readonly { date: string; start?: string }[] };
  };
};

const SENIORS = /长者|长辈|老人|乐龄|樂齡|長者|長輩|senior|elder/i;
const ADULTS_ONLY = /21\s*\+|21\s*岁以上|21\s*歲以上|21 and over|21 and up/i;
const CHILDREN = /儿童|兒童|幼儿|幼兒|少儿|少兒|学龄前|學齡前|婴儿|嬰兒|宝宝|寶寶|故事会|故事會|故事时间|岁及以下|歲及以下|\d+\s*[–-]\s*\d+\s*[岁歲]|toddler|bab(?:y|ies)|preschool|story ?time|\bkids?\b|\bteens?\b|青少年/i;
const ADULTS = /成人|成年|全龄|全齡|全年龄|全年齡|所有年龄|所有年齡|老少|长者|長者|长辈|長輩|乐龄|樂齡|all ages|all-ages|adults?\b|senior/i;
const ACCESSIBLE = /无障碍|無障礙|轮椅|輪椅|坐式|wheelchair|accessib|adaptive/i;
/**
 * In the audience line access counts only as a fact about the event (无障碍运动, wheelchair users), not as an interest:
 * "关注无障碍创作的人" (people who follow accessible art) says who it is for, not that a parent can get around.
 */
const ACCESSIBLE_AUDIENCE = /(?:无障碍|無障礙)(?:运动|運動|体育|體育|场地|場地|设施|設施|座位|入口|通道)|轮椅|輪椅|坐式|wheelchair|adaptive/i;
const CHINESE = /中文|华语|華語|普通话|普通話|国语|國語|粤语|粵語|广东话|廣東話|台语|台語|mandarin|cantonese|chinese-language|in chinese/i;
const LIBRARY = /图书馆|圖書館|分馆|分館|librar/i;
const EVERYONE = /全龄|全齡|全年龄|全年齡|所有年龄|所有年齡|老少|all ages|all-ages|everyone|社区居民|社區居民|邻里|鄰里/i;
/** Sessions starting at or after this hour are evening programs. */
const EVENING = '17:00';

/** Whether a known session starts before the evening: true, false (every known start is in the evening), or unknown. */
export function startsInDaytime(event: Pick<SeniorFriendlyInput, 'sessions' | 'planning'>): boolean | undefined {
  const schedule = event.planning?.schedule;
  const starts = [
    ...(event.sessions ?? []).map(session => session.start),
    ...(schedule?.sessions ?? []).map(session => session.start),
    ...Object.values(schedule?.weekly ?? {}).flatMap(windows => (windows ?? []).map(window => window.open)),
    ...Object.values(schedule?.dates ?? {}).flatMap(windows => windows.map(window => window.open)),
  ].filter((start): start is string => !!start && /^\d{2}:\d{2}$/.test(start));
  if (!starts.length) return undefined;
  return starts.some(start => start < EVENING);
}

/** A children's program (storytime, 0–5 岁, 儿童 …) that does not also name adults or all ages. */
const forChildren = (title: string, audience: string) => CHILDREN.test(`${title} ${audience}`) && !ADULTS.test(`${title} ${audience}`);

export function isSeniorFriendly(event: SeniorFriendlyInput): boolean {
  const audience = event.audience.join(' ');
  const words = [event.title, ...(event.aliases ?? []), audience].join(' ');
  if (SENIORS.test(words)) return true;
  if (ADULTS_ONLY.test(words) || (event.planning?.minAge ?? 0) >= 21) return false;
  if (forChildren(event.title, audience)) return false;
  const daytime = startsInDaytime(event);
  if (daytime === false) return false;
  const named = [event.title, ...(event.aliases ?? [])].join(' ');
  if (ACCESSIBLE.test(named) || ACCESSIBLE_AUDIENCE.test(audience)) return true;
  if (CHINESE.test(words) || LIBRARY.test(`${event.venue ?? ''} ${event.title}`)) return true;
  return daytime === true && EVERYONE.test(audience) && isFreeToAttend(event);
}
