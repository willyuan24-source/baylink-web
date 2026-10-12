// The 邻里 feed (WEB-SHELL2, split out of AppLayout; frontend lens FA-08). Its state lives in the layout so it survives tab
// switches and post overlays, but it is fetched only while a feed page is on screen: the home page, a category board, or
// the page under a post / profile overlay (route-table page 'home'). /guides, /events and the rest never request it.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Location, NavigateFunction } from 'react-router-dom';
import { api } from '../lib/api';
import { filterPostsByBlockedUsers } from '../lib/format';
import { readFeedCache, writeFeedCache } from '../lib/feedCache';
import { feedQueryString, visibleFeedPosts } from '../features/posts/feed-query';
import type { PostData } from '../lib/types';
import { getCategoryFromSlug, isHomePath } from '../routing';
import { matchRoute } from './route-table';
import { feedPageLocation, useFeedFilters } from './useFeedFilters';

/** True when the page on screen (under any overlay) is a feed page: it renders HomePage, the feed's only reader. */
export const isFeedPage = (location: Location) => matchRoute(feedPageLocation(location).pathname)?.page === 'home';

export function useCommunityFeed({ location, navigate, userId, blockedUserIds }: {
  /** The real location (an overlay's URL); the feed reads its filters from the page under it. */
  location: Location;
  navigate: NavigateFunction;
  userId: string | undefined;
  blockedUserIds: string[];
}) {
  const enabled = isFeedPage(location);
  const feedPage = feedPageLocation(location);
  // Every post by default, older ones included (WEB-COMMUNITY, FC3-04: each card says how current it is); `?recent=1`
  // keeps only what the poster confirmed recently (the API's `current`).
  const recentOnly = new URLSearchParams(feedPage.search).get('recent') === '1';
  const categorySlug = feedPage.pathname.startsWith('/category/')
    ? feedPage.pathname.split('/category/')[1]?.split('/')[0]
    : undefined;
  const { feedType, setFeedType, keyword, setKeyword, regionFilter, setRegionFilter, feedLocation } = useFeedFilters(location, navigate);
  // The last session's cached feed renders first (the first fetch replaces it). Only the default "all categories" view is
  // cached: a cold /category/:slug does not read it, so the first frame never shows another category's posts.
  const [posts, setPosts] = useState<PostData[]>(() => (categorySlug || keyword || regionFilter !== '全部' || recentOnly ? [] : readFeedCache(feedType)));
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword.trim());
  const [feedError, setFeedError] = useState(false);
  const fetchSeqRef = useRef(0);
  // A direct /category/:slug load starts from the URL, which saves a first fetch for "all".
  const [categoryFilter, setCategoryFilter] = useState<string>(() =>
    isHomePath(feedPage.pathname) ? getCategoryFromSlug(categorySlug) : '全部');
  const feedQueryKey = JSON.stringify([feedType, regionFilter, categoryFilter, debouncedKeyword, recentOnly, userId || 'guest']);
  const feedQueryKeyRef = useRef(feedQueryKey);

  // URL → category filter
  useEffect(() => {
    if (isHomePath(location.pathname)) setCategoryFilter(getCategoryFromSlug(categorySlug));
  }, [location.pathname, categorySlug]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword.trim()), 400);
    return () => clearTimeout(t);
  }, [keyword]);

  const fetchPosts = useCallback(async (pageNum: number, isRefresh: boolean = false, keywordOverride?: string) => {
    // Each call supersedes the ones in flight, so a stale response never overwrites a newer filter's list or paging.
    const seq = ++fetchSeqRef.current;
    const searchKw = keywordOverride ?? debouncedKeyword;
    try {
      if (!isRefresh) setIsLoadingMore(true);
      else { setIsInitialLoading(true); setFeedError(false); }
      // The server pages 5 posts while region / category filter on the client, so a filtered page can come back empty
      // ("load more" that adds nothing). Keep paging until a batch is visible or the feed ends.
      const MIN_VISIBLE_PER_LOAD = 5;
      const MAX_PAGES_PER_LOAD = 4;
      const hasClientFilter = regionFilter !== '全部' || categoryFilter !== '全部' || (!!userId && blockedUserIds.length > 0);
      const collected: PostData[] = [];
      const seenIds = new Set<string>();
      let currentPage = pageNum;
      let more = true;
      let pagesFetched = 0;
      while (true) {
        const res = await api.request(`/posts${feedQueryString({ type: feedType, page: currentPage, limit: 6, recentOnly, keyword: searchKw, categoryFilter, regionFilter })}`);
        if (fetchSeqRef.current !== seq) return;
        const newPosts: PostData[] = res.posts || [];
        more = res.hasMore;
        pagesFetched += 1;
        for (const p of visibleFeedPosts(newPosts, { regionFilter, categoryFilter, userId, blockedUserIds })) {
          if (!seenIds.has(p.id)) { seenIds.add(p.id); collected.push(p); }
        }
        if (!more || !hasClientFilter || collected.length >= MIN_VISIBLE_PER_LOAD || pagesFetched >= MAX_PAGES_PER_LOAD) break;
        // Advance only when another page will be fetched, so `page` is the last page actually read.
        currentPage += 1;
      }
      setPage(currentPage);
      if (isRefresh) {
        setPosts(collected);
        // Only the default view (no keyword, no filter) is cached for the next visit.
        if (!searchKw && regionFilter === '全部' && categoryFilter === '全部' && !recentOnly) writeFeedCache(feedType, collected);
      } else {
        // A post published between two pages shifts the server's paging; de-duplicate by id.
        setPosts(prev => {
          const prevIds = new Set(prev.map(p => p.id));
          return [...prev, ...collected.filter(p => !prevIds.has(p.id))];
        });
      }
      setHasMore(more);
      setFeedError(false);
    } catch (e) {
      if (fetchSeqRef.current !== seq) return;
      console.error(e);
      setFeedError(true);
      if (isRefresh) setHasMore(false);
    } finally {
      // Clear only this call's loading flags, even when a newer call took over.
      if (fetchSeqRef.current === seq) { setIsLoadingMore(false); setIsInitialLoading(false); }
    }
  }, [feedType, regionFilter, categoryFilter, debouncedKeyword, recentOnly, userId, blockedUserIds]);

  // Fetch when a feed page is on screen and the query (or the reader) changed. Coming back to the feed with the same query
  // keeps what was loaded instead of fetching again.
  const loadedFetchRef = useRef<typeof fetchPosts | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (feedQueryKeyRef.current !== feedQueryKey) { setPosts([]); feedQueryKeyRef.current = feedQueryKey; }
    if (loadedFetchRef.current === fetchPosts) return;
    loadedFetchRef.current = fetchPosts;
    setPage(1); setHasMore(true); void fetchPosts(1, true);
  }, [fetchPosts, feedQueryKey, enabled]);

  const retryFeed = () => {
    setPage(1);
    setHasMore(true);
    fetchPosts(1, true);
  };

  const searchPostsNow = () => {
    const kw = keyword.trim();
    setPage(1);
    setHasMore(true);
    // An unchanged keyword does not trigger the effect: refresh by hand. A new one goes through the debounced keyword, so
    // one search sends one request.
    if (kw === debouncedKeyword) fetchPosts(1, true, kw);
    else setDebouncedKeyword(kw);
  };

  const handleLoadMore = () => { if (!isLoadingMore && !isInitialLoading && hasMore) fetchPosts(page + 1, false); };

  /** Drops the previous reader's feed (sign-out, another account): in-flight responses are ignored. */
  const resetFeed = useCallback(() => { ++fetchSeqRef.current; loadedFetchRef.current = null; setPosts([]); }, []);
  const hideBlockedAuthors = useCallback((ids: string[]) => setPosts(prev => filterPostsByBlockedUsers(prev, ids)), []);

  return {
    enabled, categorySlug,
    posts, setPosts, feedType, setFeedType, keyword, setKeyword, regionFilter, setRegionFilter, feedLocation, categoryFilter,
    feedError, isInitialLoading, isLoadingMore, hasMore,
    fetchPosts, retryFeed, searchPostsNow, handleLoadMore, resetFeed, hideBlockedAuthors,
  };
}
