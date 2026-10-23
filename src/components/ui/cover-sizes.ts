/**
 * `sizes` per slot (design.md §4.6): feed card 173 → 286, hero, detail hero, row thumbnail. They are the first guess, for a
 * prerendered page before its script runs: CoverImage replaces them with the width a picture is drawn at once it is laid out
 * (N21: a cover crop is wider than its frame; a row thumbnail can be a 358 px card in 特大). A thumbnail's short label
 * follows the picture's own width (covers.css, ≤ 200 px), never this value (followup 27).
 */
export const COVER_SIZES = {
  feed: '(max-width: 767px) calc(50vw - 22px), (max-width: 1023px) calc(33vw - 24px), 286px',
  single: '(max-width: 767px) calc(100vw - 32px), 50vw',
  hero: '(max-width: 767px) calc(100vw - 32px), 380px',
  detail: '(max-width: 767px) 100vw, 800px',
  thumb: '88px',
} as const;
