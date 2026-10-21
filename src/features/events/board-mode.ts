import { useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useReadingSize, useSimpleDisplay } from '../../lib/reading-preferences';
import { saveRegion } from './events-model';
import type { MonthlyRegion } from './events-index-types';

/* The 免费与优惠 and 新店 boards' hooks (UI9-FREE), kept apart from RegionFilter's components so that file exports
   components only (react-refresh/only-export-components). */

/** Sets the region the way 本周末 does: in the address (?region=…, so Back and a shared link keep it) and remembered. */
export function useSetRegion() {
  const [, setParams] = useSearchParams();
  return (region: MonthlyRegion | 'all') => {
    saveRegion(region);
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('region', region);
      return next;
    }, { replace: true, preventScrollReset: true });
  };
}

/** The feed grid's phone breakpoint (feed-layout.ts PHONE_QUERY, tokens.css --feed-cols); written here so the boards' lazy
 * chunk does not make the shared feed-layout chunk export it. */
const PHONE_QUERY = '(max-width: 767px)';
const subscribePhone = (listener: () => void) => {
  const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_QUERY) : undefined;
  media?.addEventListener?.('change', listener);
  return () => media?.removeEventListener?.('change', listener);
};
// Without matchMedia (tests, very old browsers) the boards take the phone layout, as useFeedLayout does.
const phoneNow = () => typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia(PHONE_QUERY).matches;

/**
 * How the boards lay out (client-only views: EventsShell loads them lazily, so the first render can read the device).
 * - `phone`: ≤ 767 px (the feed grid's breakpoint): 4 cards per section instead of 8.
 * - `roomy`: a phone at 大 / 特大 or in 简洁显示: the filter row becomes two Sheet chips ([整个湾区 ▾] [全部条件 ▾]), so no
 *   chip row scrolls sideways (N25).
 * - `rows`: the cards are rows (88 px thumbnail and text) where the feed would be one column: a 1:1 cover at 特大 cannot
 *   finish above the tab bar (N18).
 * - `simple`: 简洁显示 (and 家人版): `simpleSize` cards per section, no sold-out cards, no ♡ or provenance words (DECISIONS 16).
 * - `simpleSize`: 3 in 简洁; 2 in 家人版 (简洁 at 特大), where a row is 160–280 px tall: nine rows made the 免费与优惠 page
 *   1.11× standard's height, six keep it under 1.0× (the critic's 家人版 target). Each section's 再看 N 条 lists the rest.
 */
export function useBoardMode() {
  const reading = useReadingSize(), simple = useSimpleDisplay();
  const phone = useSyncExternalStore(subscribePhone, phoneNow, () => true);
  const roomy = phone && (reading !== 'standard' || simple);
  return { phone, roomy, rows: roomy, simple, simpleSize: reading === 'extra-large' ? 2 : 3 };
}
