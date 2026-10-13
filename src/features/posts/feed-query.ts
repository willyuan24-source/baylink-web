import { matchesCategory } from '../../lib/constants';
import { filterPostsByBlockedUsers } from '../../lib/format';
import type { PostData, PostType } from '../../lib/types';

/** One request of the 邻里 feed: `/api/posts` filters by type, category, city, keyword and availability. */
export type FeedQuery = {
  type: PostType;
  page: number;
  limit: number;
  /** `?recent=1`: only what the poster confirmed recently (the API's `current`). */
  recentOnly: boolean;
  keyword: string;
  categoryFilter: string;
  regionFilter: string;
};

export function feedQueryString({ type, page, limit, recentOnly, keyword, categoryFilter, regionFilter }: FeedQuery): string {
  let query = `?type=${type}&page=${page}&limit=${limit}&availability=${recentOnly ? 'current' : 'all'}`;
  if (keyword) query += `&keyword=${encodeURIComponent(keyword)}`;
  if (categoryFilter !== '全部') query += `&category=${encodeURIComponent(categoryFilter)}`;
  if (regionFilter !== '全部') query += `&city=${encodeURIComponent(regionFilter)}`;
  return query;
}

/** The posts of a page the board shows: the area and category again on the client, no closed posts, no blocked authors. */
export function visibleFeedPosts(posts: PostData[], { regionFilter, categoryFilter, userId, blockedUserIds }: {
  regionFilter: string; categoryFilter: string; userId?: string; blockedUserIds: string[];
}): PostData[] {
  let visible = posts;
  if (regionFilter !== '全部') visible = visible.filter((post) => (post.city || '').includes(regionFilter));
  visible = visible.filter((post) => matchesCategory(post.category, categoryFilter) && post.status !== 'closed');
  if (userId && blockedUserIds.length) visible = filterPostsByBlockedUsers(visible, blockedUserIds);
  return visible;
}
