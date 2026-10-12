import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { PostData } from '../../lib/types';
import { feedQueryString, visibleFeedPosts, type FeedQuery } from './feed-query';

/**
 * FC3-04: when the board's list comes back empty, is the other kind of post (求租 when 出租 is empty) there under the same
 * area, keyword and 近期确认 filters? Only `false` lets the empty state speak for the whole board ("租房还没有信息");
 * `true` offers the switch; `null` (checking, inconclusive, or the check failed) keeps the claim to the kind on screen. One small
 * request, only while the board is empty.
 */
export function useOtherTypeHasPosts({ enabled, userId, blockedUserIds, ...query }: Omit<FeedQuery, 'page' | 'limit'> & {
  enabled: boolean; userId?: string; blockedUserIds: string[];
}): boolean | null {
  const key = JSON.stringify([query.type, query.recentOnly, query.keyword, query.categoryFilter, query.regionFilter, userId || '', blockedUserIds.join(',')]);
  const [result, setResult] = useState<{ key: string; value: boolean } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    // A short wait so typing into the search box sends one check, not one per key.
    const timer = setTimeout(() => {
      api.request(`/posts${feedQueryString({ ...query, page: 1, limit: 12 })}`).then((res: { posts?: PostData[]; hasMore?: boolean }) => {
        if (!live) return;
        const visible = visibleFeedPosts(res.posts || [], { regionFilter: query.regionFilter, categoryFilter: query.categoryFilter, userId, blockedUserIds });
        // A first page of only closed or blocked posts with more behind it proves nothing either way: unknown (null).
        setResult(visible.length > 0 ? { key, value: true } : res.hasMore ? null : { key, value: false });
      }, () => { if (live) setResult(null); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
    // `key` carries every input of the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
  return enabled && result?.key === key ? result.value : null;
}
