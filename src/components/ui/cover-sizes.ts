/** `sizes` per slot (design.md §4.6): feed card 173 → 286, hero, detail hero, row thumbnail. */
export const COVER_SIZES = {
  feed: '(max-width: 767px) calc(50vw - 22px), (max-width: 1023px) calc(33vw - 24px), 286px',
  single: '(max-width: 767px) calc(100vw - 32px), 50vw',
  hero: '(max-width: 767px) calc(100vw - 32px), 380px',
  detail: '(max-width: 767px) 100vw, 800px',
  thumb: '88px',
} as const;
