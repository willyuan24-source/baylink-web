import type { PostData, PostType } from '../../lib/types';

/**
 * Copy and small rules for the 邻里信息 board (plan WEB-COMMUNITY, D20): category names as readers say them, the
 * publish button of each board (it never presets 提供 / 需求, E2E+2), the 站长发布 label and the count rule.
 */
type Copy = { zh: string; en: string };

/** Data categories keep their stored names (租屋, 闲置); the board says what readers say (租房, 二手). */
const CATEGORY_NAMES: Record<string, Copy> = {
  全部: { zh: '邻里信息', en: 'Neighborhood board' },
  租屋: { zh: '租房', en: 'Housing' },
  闲置: { zh: '二手', en: 'Secondhand' },
  本地服务: { zh: '本地服务', en: 'Local services' },
  维修: { zh: '维修', en: 'Repairs' },
  清洁: { zh: '清洁', en: 'Cleaning' },
  搬家: { zh: '搬家', en: 'Moving' },
  接送: { zh: '接送', en: 'Rides' },
  翻译: { zh: '翻译', en: 'Translation' },
  兼职: { zh: '兼职', en: 'Part-time work' },
  其他: { zh: '其他', en: 'Other' },
};
export const categoryName = (category: string): Copy => CATEGORY_NAMES[category] || { zh: category || '湾区生活', en: 'Bay Area life' };

/** The five areas posts are filed under, as the site names them (中半岛 → 半岛, the naming table). Other places as written. */
export const REGION_NAMES: Record<string, Copy> = {
  旧金山: { zh: '旧金山', en: 'San Francisco' }, 中半岛: { zh: '半岛', en: 'Peninsula' }, 东湾: { zh: '东湾', en: 'East Bay' },
  南湾: { zh: '南湾', en: 'South Bay' }, 北湾: { zh: '北湾', en: 'North Bay' },
};
export const regionName = (city: string): Copy => REGION_NAMES[city] || { zh: city, en: city };

/** The boards a reader can switch to (the service trades share 本地服务). */
export const BOARD_CATEGORIES = ['租屋', '闲置', '本地服务', '接送', '兼职', '其他'];

/** The two kinds of post, named for the board they are on (出租 / 求租 on 租房). */
export function feedTypeNames(category: string): Record<PostType, Copy> {
  if (category === '租屋') return { provider: { zh: '出租', en: 'For rent' }, client: { zh: '求租', en: 'Looking to rent' } };
  if (category === '闲置') return { provider: { zh: '出售', en: 'For sale' }, client: { zh: '求购', en: 'Wanted' } };
  return { provider: { zh: '提供', en: 'Offering' }, client: { zh: '需要', en: 'Looking for' } };
}

/** The publish button of a board. It opens the composer on 提供 / 需求 (step 1), never on a preset type. */
export function publishLabel(category: string): Copy {
  if (category === '租屋') return { zh: '发布房源或求租', en: 'Post a rental or a request' };
  if (category === '闲置') return { zh: '出售或求购', en: 'Sell or ask for an item' };
  if (category === '全部' || category === '其他') return { zh: '发布信息', en: 'Post something' };
  return { zh: '提供或寻找服务', en: 'Offer or find a service' };
}

/**
 * The founder's own account and the platform admin account he posts the seed listings from (D20: 站长发布). Like
 * src/lib/ad-disclosure.ts, the ids are listed here — only these two: another admin account (a moderator) is not the
 * site owner, and the post sheet names its posts 「BAYLINK 平台账号发布」 instead.
 */
const FOUNDER_ACCOUNT_IDS = new Set(['1779316048437', 'admin']);
export const isFounderPost = (post: Pick<PostData, 'authorId'>) => FOUNDER_ACCOUNT_IDS.has(post.authorId);
export const FOUNDER_LABEL: Copy = { zh: '站长发布', en: 'Posted by the site owner' };

/** Counts under 3 are not shown (D20: no numbers that make a quiet board look emptier or busier than it is). */
export const showCount = (count: number | undefined | null): count is number => typeof count === 'number' && count >= 3;

const DAY = 86_400_000;
/** A post created in the last 30 days is 新信息. */
export const isNewPost = (post: Pick<PostData, 'createdAt'>, now = Date.now()) => now - post.createdAt <= 30 * DAY && post.createdAt <= now;

/** "6/13" this year, "2025/6/13" before; en "Jun 13" / "Jun 13, 2025". Pacific time. */
export function postDate(createdAt: number, english: boolean, now = Date.now()): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(date).map(part => [part.type, part.value]));
  const thisYear = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric' }).format(new Date(now));
  if (english) {
    const text = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', ...(parts.year === thisYear ? {} : { year: 'numeric' }) }).format(date);
    return text;
  }
  return parts.year === thisYear ? `${parts.month}/${parts.day}` : `${parts.year}/${parts.month}/${parts.day}`;
}

/** 「6/12 发布」; en "Posted Jun 12". */
export function postedOn(createdAt: number, english: boolean, now = Date.now()): string {
  const date = postDate(createdAt, english, now);
  if (!date) return '';
  return english ? `Posted ${date}` : `${date} 发布`;
}
