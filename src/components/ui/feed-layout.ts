import { useCallback, useEffect, useState } from 'react';

/** Feed layout: `auto` follows the text size (one column at 大/特大 on phones); `grid` and `list` are the reader's choice. */
export type FeedLayout = 'auto' | 'grid' | 'list';
export const FEED_LAYOUT_KEY = 'baylink.feed-layout.v1';

const isLayout = (value: unknown): value is FeedLayout => value === 'auto' || value === 'grid' || value === 'list';

/** Storage can be missing or throw (private mode, blocked site data); the feed then stays automatic. */
export function readFeedLayout(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): FeedLayout {
  try {
    const value = storage?.getItem(FEED_LAYOUT_KEY);
    return isLayout(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}
export function writeFeedLayout(layout: FeedLayout, storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined = globalThis.localStorage): void {
  try {
    if (layout === 'auto') storage?.removeItem(FEED_LAYOUT_KEY);
    else storage?.setItem(FEED_LAYOUT_KEY, layout);
  } catch {
    // The choice still applies for this visit.
  }
}

const LARGE_TEXT = new Set(['large', 'extra-large']);
/** What `auto` resolves to right now: one column for 大/特大 text below the desktop breakpoint. */
export function automaticLayout(reading: string | undefined, narrow: boolean): Exclude<FeedLayout, 'auto'> {
  return narrow && LARGE_TEXT.has(reading || '') ? 'list' : 'grid';
}

/**
 * The reader's feed layout. The first render is always `auto` (matches the prerendered HTML); the saved choice
 * and the live text size are read after mount. `effective` tells a layout toggle which button to show pressed.
 */
export function useFeedLayout() {
  const [layout, setLayoutState] = useState<FeedLayout>('auto');
  const [effectiveAuto, setEffectiveAuto] = useState<Exclude<FeedLayout, 'auto'>>('grid');
  useEffect(() => {
    setLayoutState(readFeedLayout());
    const root = document.documentElement;
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 1023px)') : undefined;
    const update = () => setEffectiveAuto(automaticLayout(root.dataset.reading, media?.matches ?? true));
    update();
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(update) : undefined;
    observer?.observe(root, { attributes: true, attributeFilter: ['data-reading'] });
    media?.addEventListener?.('change', update);
    return () => { observer?.disconnect(); media?.removeEventListener?.('change', update); };
  }, []);
  const setLayout = useCallback((next: FeedLayout) => { setLayoutState(next); writeFeedLayout(next); }, []);
  return { layout, effective: layout === 'auto' ? effectiveAuto : layout, setLayout };
}
