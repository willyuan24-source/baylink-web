import type { Bilingual, Vec2 } from '../core/types';

/**
 * Wave 7 · lane S (W7-S3) · a Chase Center event ticket includes that day's Muni buses and light rail (SFMTA's rule,
 * BAYLINK's offer page `chase-center-ticket-muni-included`, a purchase deal: never a live.json row). realsf/HowToGo.tsx
 * adds the line to a card whose point is at Chase Center (its events' board, its place card) — not Thrive City's free
 * plaza events.
 */

/** Chase Center's venue point (realsf/eventVenues.ts `chase-center`) and the radius a card's point may be from it (u) */
export const CHASE_MUNI = { at: { x: 479.3, z: 264.0 }, r: 15, offerId: 'chase-center-ticket-muni-included' } as const;
export const CHASE_MUNI_NOTE: Bilingual = {
  zh: '持大通中心活动票，当天可坐 Muni 公交和轻轨（不含缆车）',
  en: 'A Chase Center event ticket includes that day’s Muni buses and light rail (not cable cars)',
};
export const chaseMuniAt = (p: Vec2) => Math.hypot(p.x - CHASE_MUNI.at.x, p.z - CHASE_MUNI.at.z) <= CHASE_MUNI.r;
