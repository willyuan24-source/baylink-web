import { useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import type { Location, NavigateFunction } from 'react-router-dom';
import { REGIONS } from '../lib/constants';
import type { PostType } from '../lib/types';
import { isHomePath } from '../routing';

export type FeedFilters = { keyword: string; regionFilter: string; feedType: PostType };
export function feedPageLocation(location: Location): Location {
  const background = location.state?.backgroundLocation as Location | undefined;
  return background && typeof background.pathname === 'string' && isHomePath(background.pathname) ? background : location;
}
export function parseFeedFilters(search: string): FeedFilters {
  const params = new URLSearchParams(search);
  const region = params.get('region') || '全部';
  return { keyword: (params.get('q') || '').slice(0, 80), regionFilter: REGIONS.includes(region) ? region : '全部', feedType: params.get('type') === 'client' ? 'client' : 'provider' };
}
export function feedSearch(filters: FeedFilters, search = '') {
  const params = new URLSearchParams(search);
  if (filters.keyword) params.set('q', filters.keyword); else params.delete('q');
  if (filters.regionFilter !== '全部') params.set('region', filters.regionFilter); else params.delete('region');
  if (filters.feedType === 'client') params.set('type', 'client'); else params.delete('type');
  return params.size ? `?${params.toString()}` : '';
}

/** The URL owns feed filters, while overlays and other pages retain the last feed context. */
export function useFeedFilters(location: Location, navigate: NavigateFunction) {
  const source = feedPageLocation(location);
  const onFeed = isHomePath(source.pathname);
  const [previous, setPrevious] = useState<FeedFilters>(() => parseFeedFilters(onFeed ? source.search : ''));
  const filters = useMemo(() => onFeed ? parseFeedFilters(source.search) : previous, [onFeed, source.search, previous]);
  const latest = useRef(filters);
  useLayoutEffect(() => {
    latest.current = filters;
    if (onFeed) setPrevious((value) => value.keyword === filters.keyword && value.regionFilter === filters.regionFilter && value.feedType === filters.feedType ? value : filters);
  }, [onFeed, filters]);
  const update = <K extends keyof FeedFilters>(key: K, value: SetStateAction<FeedFilters[K]>) => {
    const next = { ...latest.current, [key]: typeof value === 'function' ? (value as (previous: FeedFilters[K]) => FeedFilters[K])(latest.current[key]) : value };
    latest.current = next;
    setPrevious(next);
    if (onFeed) navigate({ pathname: source.pathname, search: feedSearch(next, source.search), hash: source.hash }, { replace: true, state: source.state, preventScrollReset: true });
  };
  return {
    ...filters,
    setKeyword: (value: SetStateAction<string>) => update('keyword', value),
    setRegionFilter: (value: SetStateAction<string>) => update('regionFilter', value),
    setFeedType: (value: SetStateAction<PostType>) => update('feedType', value),
    feedLocation: (pathname: string, overrides: Partial<FeedFilters> = {}) => ({ pathname, search: feedSearch({ ...latest.current, ...overrides }) }),
  };
}
