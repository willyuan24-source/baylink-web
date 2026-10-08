import { useCallback, useEffect, useState } from 'react';

/**
 * Feed layout: `auto` follows the text size (one column at 大/特大 or in 简洁显示 on phones); `grid` (2–4 columns) and
 * `list` (one column) are the reader's choice.
 */
export type FeedLayout = 'auto' | 'grid' | 'list';
export const FEED_LAYOUT_KEY = 'baylink.feed-layout.v1';
/** Phones: the same breakpoint as tokens.css `--feed-cols` (WEB-TOKENS-A) and the `ui.css` feed grid. */
export const PHONE_QUERY = '(max-width: 767px)';

const isLayout = (value: unknown): value is FeedLayout => value === 'auto' || value === 'grid' || value === 'list';

/**
 * Storage can be missing or throw (private mode, blocked site data); the feed then stays automatic. With blocked
 * site data the `localStorage` getter itself throws, so the default store is read inside the `try`.
 */
export function readFeedLayout(storage?: Pick<Storage, 'getItem'>): FeedLayout {
  try {
    const value = (storage ?? globalThis.localStorage)?.getItem(FEED_LAYOUT_KEY);
    return isLayout(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}
export function writeFeedLayout(layout: FeedLayout, storage?: Pick<Storage, 'setItem' | 'removeItem'>): void {
  try {
    const store = storage ?? globalThis.localStorage;
    if (layout === 'auto') store?.removeItem(FEED_LAYOUT_KEY);
    else store?.setItem(FEED_LAYOUT_KEY, layout);
  } catch {
    // The choice still applies for this visit.
  }
}

const LARGE_TEXT = new Set(['large', 'extra-large']);
/** What `auto` resolves to right now: one column for 大/特大 text or 简洁显示 on a phone. */
export function automaticLayout(reading: string | undefined, phone: boolean, simple = false): Exclude<FeedLayout, 'auto'> {
  return phone && (simple || LARGE_TEXT.has(reading || '')) ? 'list' : 'grid';
}

/**
 * The reader's feed layout. The first render is always `auto` (matches the prerendered HTML); the saved choice,
 * the live text size and 简洁显示 are read after mount. `effective` tells a layout toggle which button to show
 * pressed. Choosing the layout that `auto` would pick anyway clears the saved choice, so the reader can always get
 * back to the automatic switch.
 */
export function useFeedLayout() {
  const [layout, setLayoutState] = useState<FeedLayout>('auto');
  const [automatic, setAutomatic] = useState<Exclude<FeedLayout, 'auto'>>('grid');
  useEffect(() => {
    setLayoutState(readFeedLayout());
    const root = document.documentElement;
    const media = typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_QUERY) : undefined;
    const update = () => setAutomatic(automaticLayout(root.dataset.reading, media?.matches ?? true, root.hasAttribute('data-simple')));
    update();
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(update) : undefined;
    observer?.observe(root, { attributes: true, attributeFilter: ['data-reading', 'data-simple'] });
    media?.addEventListener?.('change', update);
    return () => { observer?.disconnect(); media?.removeEventListener?.('change', update); };
  }, []);
  const setLayout = useCallback((next: FeedLayout) => {
    const stored = next === automatic ? 'auto' : next;
    setLayoutState(stored);
    writeFeedLayout(stored);
  }, [automatic]);
  return { layout, automatic, effective: layout === 'auto' ? automatic : layout, setLayout };
}
